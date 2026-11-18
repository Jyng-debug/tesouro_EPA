import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage, isTransientError } from "@/lib/errors";
import type { GpsStatus } from "@/lib/geo";

/**
 * Fila local de submissões (IndexedDB).
 * Cada fotografia é primeiro guardada no telemóvel e só depois enviada:
 *  1. upload da foto para o Storage (caminho fixo → reenvios não duplicam);
 *  2. registo da submissão com a RPC create_submission (id fixo → idempotente).
 * Se falhar por falta de rede, fica na fila e volta a tentar automaticamente.
 */
export interface QueuedSubmission {
  id: string; // uuid da submissão (gerado no telemóvel)
  teamId: string;
  eventId: string;
  checkpointId: string;
  checkpointSeq: number;
  path: string; // event/team/checkpoint/<timestamp>.jpg
  photo: ArrayBuffer;
  challengeText: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  gpsStatus: GpsStatus;
  takenAt: string;
  createdAt: number;
  attempts: number;
  uploaded: boolean;
  lastError: string | null;
  failed: boolean; // erro definitivo (ex.: posto já enviado por outro telemóvel)
}

export type QueueItemSummary = Omit<QueuedSubmission, "photo">;

interface QueueDB extends DBSchema {
  submissions: { key: string; value: QueuedSubmission };
}

let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;
function db() {
  dbPromise ??= openDB<QueueDB>("tesouro-epa", 1, {
    upgrade(database) {
      database.createObjectStore("submissions", { keyPath: "id" });
    },
  });
  return dbPromise;
}

// ---- estado observável (para React via useSyncExternalStore) -----------------
let snapshot: QueueItemSummary[] = [];
let processing = false;
const listeners = new Set<() => void>();
const sentListeners = new Set<(item: QueueItemSummary) => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function refreshSnapshot() {
  const all = await (await db()).getAll("submissions");
  snapshot = all
    .map(({ photo: _photo, ...rest }) => rest)
    .sort((a, b) => a.createdAt - b.createdAt);
  emit();
}

export const queueStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  isProcessing: () => processing,
  /** Chamado sempre que uma submissão da fila chega ao servidor. */
  onSent(listener: (item: QueueItemSummary) => void) {
    sentListeners.add(listener);
    return () => sentListeners.delete(listener);
  },
};

// ---- operações ----------------------------------------------------------------
export async function enqueueSubmission(
  input: Omit<QueuedSubmission, "id" | "path" | "photo" | "createdAt" | "attempts" | "uploaded" | "lastError" | "failed"> & {
    photo: Blob;
  },
): Promise<QueuedSubmission> {
  const id = crypto.randomUUID();
  const item: QueuedSubmission = {
    ...input,
    id,
    photo: await input.photo.arrayBuffer(),
    path: `${input.eventId}/${input.teamId}/${input.checkpointId}/${Date.now()}.jpg`,
    createdAt: Date.now(),
    attempts: 0,
    uploaded: false,
    lastError: null,
    failed: false,
  };
  await (await db()).put("submissions", item);
  await refreshSnapshot();
  return item;
}

export async function discardQueued(id: string) {
  await (await db()).delete("submissions", id);
  await refreshSnapshot();
}

export async function getQueuedPhoto(id: string): Promise<Blob | null> {
  const item = await (await db()).get("submissions", id);
  return item ? new Blob([item.photo], { type: "image/jpeg" }) : null;
}

/** Remove da fila itens de outra equipa (ex.: telemóvel mudou de equipa). */
export async function pruneOtherTeams(teamId: string) {
  const database = await db();
  for (const item of await database.getAll("submissions")) {
    if (item.teamId !== teamId) await database.delete("submissions", item.id);
  }
  await refreshSnapshot();
}

function isAlreadyExists(err: unknown) {
  const e = err as { message?: string; statusCode?: string | number; status?: number; error?: string };
  return (
    String(e?.statusCode) === "409" ||
    e?.status === 409 ||
    /already exists|duplicate/i.test(`${e?.message ?? ""} ${e?.error ?? ""}`)
  );
}

/** Tenta enviar tudo o que está na fila. Seguro chamar várias vezes. */
export async function processQueue(): Promise<{ sent: number; pending: number }> {
  if (processing) return { sent: 0, pending: snapshot.length };
  processing = true;
  emit();
  let sent = 0;
  try {
    const database = await db();
    const items = (await database.getAll("submissions")).filter((i) => !i.failed).sort((a, b) => a.createdAt - b.createdAt);

    for (const item of items) {
      if (!navigator.onLine) break;
      item.attempts += 1;
      try {
        if (!item.uploaded) {
          const { error } = await supabase.storage
            .from("photos")
            .upload(item.path, new Blob([item.photo], { type: "image/jpeg" }), {
              contentType: "image/jpeg",
              upsert: false,
              cacheControl: "3600",
            });
          if (error && !isAlreadyExists(error)) throw error;
          item.uploaded = true;
          await database.put("submissions", item);
        }

        const { error } = await supabase.rpc("create_submission", {
          p_id: item.id,
          p_checkpoint_id: item.checkpointId,
          p_photo_path: item.path,
          p_challenge_text: item.challengeText,
          p_lat: item.lat ?? undefined,
          p_lng: item.lng ?? undefined,
          p_accuracy_m: item.accuracy ?? undefined,
          p_gps_status: item.gpsStatus,
          p_taken_at: item.takenAt,
        });
        if (error) throw error;

        await database.delete("submissions", item.id);
        sent += 1;
        const { photo: _p, ...summary } = item;
        sentListeners.forEach((l) => l(summary));
      } catch (err) {
        item.lastError = errorMessage(err);
        item.failed = !isTransientError(err);
        await database.put("submissions", item);
        if (!item.failed) break; // problema de rede: parar e tentar mais tarde
      }
    }
  } finally {
    processing = false;
    await refreshSnapshot();
  }
  return { sent, pending: snapshot.filter((i) => !i.failed).length };
}

// ---- tentativas automáticas -----------------------------------------------------
let started = false;
export function startQueueWorker() {
  if (started) return;
  started = true;
  void refreshSnapshot().then(() => processQueue());
  window.addEventListener("online", () => void processQueue());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processQueue();
  });
  window.setInterval(() => {
    if (snapshot.some((i) => !i.failed)) void processQueue();
  }, 20_000);
}
