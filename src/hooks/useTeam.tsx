import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { queueStore, type QueueItemSummary } from "@/lib/offlineQueue";
import { nextSeq, routeOrder } from "@/lib/route";

export type Team = Tables<"teams">;
export type EventRow = Tables<"events">;
export type Checkpoint = Tables<"checkpoints">;
export type QuizQuestion = Tables<"quiz_questions">;
export type Submission = Tables<"submissions">;
export type QuizAnswer = Tables<"quiz_answers">;
export type Adjustment = Tables<"adjustments">;

export type CheckpointStatus = "todo" | "queued" | "queue_error" | "pending" | "approved" | "rejected";

export interface CheckpointState {
  checkpoint: Checkpoint;
  quiz: QuizQuestion | undefined;
  submission: Submission | undefined; // a mais recente
  queued: QueueItemSummary | undefined;
  answer: QuizAnswer | undefined;
  status: CheckpointStatus;
  photoDone: boolean;
  done: boolean; // fotografia enviada/na fila e quiz respondido
}

// ---------------------------------------------------------------- sessão
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session; // undefined = a carregar
}

/** Equipa a que este telemóvel pertence (null = nenhuma). */
export function useMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ["membership", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("team_id").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data?.team_id ?? null;
    },
  });
}

export function useQueue() {
  return useSyncExternalStore(queueStore.subscribe, queueStore.getSnapshot);
}

// ---------------------------------------------------------------- dados da equipa
async function loadTeamData(teamId: string) {
  const team = await supabase.from("teams").select("*").eq("id", teamId).single();
  if (team.error) throw team.error;

  const [event, checkpoints, quiz, submissions, answers, adjustments, score] = await Promise.all([
    supabase.from("events").select("*").eq("id", team.data.event_id).single(),
    supabase.from("checkpoints").select("*").eq("event_id", team.data.event_id).order("seq"),
    supabase.from("quiz_questions").select("*"),
    supabase.from("submissions").select("*").eq("team_id", teamId).order("created_at", { ascending: false }),
    supabase.from("quiz_answers").select("*").eq("team_id", teamId),
    supabase.from("adjustments").select("*").eq("team_id", teamId).order("created_at"),
    supabase.rpc("my_team_score"),
  ]);
  for (const r of [event, checkpoints, quiz, submissions, answers, adjustments, score]) {
    if (r.error) throw r.error;
  }
  return {
    team: team.data,
    event: event.data!,
    checkpoints: checkpoints.data ?? [],
    quiz: quiz.data ?? [],
    submissions: submissions.data ?? [],
    answers: answers.data ?? [],
    adjustments: adjustments.data ?? [],
    score: score.data?.[0] ?? null,
  };
}

type TeamData = Awaited<ReturnType<typeof loadTeamData>>;

interface TeamContextValue extends TeamData {
  states: CheckpointState[]; // pela ordem do percurso da equipa
  bySeq: Map<number, CheckpointState>;
  nextSeq: number | null;
  deadline: Date;
  queue: QueueItemSummary[];
  refetch: () => void;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam fora de TeamProvider");
  return ctx;
}

export function useOptionalTeam() {
  return useContext(TeamContext);
}

export function TeamProvider({ teamId, children, fallback }: { teamId: string; children: ReactNode; fallback: (state: { error: unknown; retry: () => void }) => ReactNode }) {
  const qc = useQueryClient();
  const queue = useQueue();
  const query = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => loadTeamData(teamId),
    refetchInterval: 60_000, // atualiza o atraso/pontuação mesmo sem eventos
  });

  // Tempo real: alterações às linhas da equipa (o RLS filtra o resto).
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["team", teamId] });
    const channel = supabase
      .channel(`team-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `team_id=eq.${teamId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_answers", filter: `team_id=eq.${teamId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "adjustments", filter: `team_id=eq.${teamId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `id=eq.${teamId}` }, invalidate)
      .subscribe();
    const off = queueStore.onSent(invalidate);
    return () => {
      off();
      void supabase.removeChannel(channel);
    };
  }, [qc, teamId]);

  const value = useMemo<TeamContextValue | null>(() => {
    const d = query.data;
    if (!d) return null;
    const order = routeOrder(d.team.start_seq, d.checkpoints.length || 7);
    const bySeq = new Map<number, CheckpointState>();
    for (const cp of d.checkpoints) {
      const submission = d.submissions.find((s) => s.checkpoint_id === cp.id);
      const queued = queue.find((q) => q.checkpointId === cp.id && q.teamId === d.team.id);
      const answer = d.answers.find((a) => a.checkpoint_id === cp.id);
      let status: CheckpointStatus = "todo";
      if (submission) status = submission.status;
      if (queued && (!submission || submission.status === "rejected")) status = queued.failed ? "queue_error" : "queued";
      const photoDone = status === "pending" || status === "approved" || status === "queued";
      bySeq.set(cp.seq, {
        checkpoint: cp,
        quiz: d.quiz.find((q) => q.checkpoint_id === cp.id),
        submission,
        queued,
        answer,
        status,
        photoDone,
        done: photoDone && !!answer,
      });
    }
    const states = order.map((s) => bySeq.get(s)).filter((s): s is CheckpointState => !!s);
    const doneSeqs = states.filter((s) => s.done).map((s) => s.checkpoint.seq);
    return {
      ...d,
      states,
      bySeq,
      nextSeq: nextSeq(d.team.start_seq, doneSeqs, d.checkpoints.length || 7),
      deadline: new Date(d.team.deadline_at ?? d.event.deadline_at),
      queue: queue.filter((q) => q.teamId === d.team.id),
      refetch: () => void query.refetch(),
    };
  }, [query, queue]);

  if (!value) return <>{fallback({ error: query.error, retry: () => void query.refetch() })}</>;
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

// ---------------------------------------------------------------- utilidades
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** URL temporária (assinada) para mostrar uma foto privada. */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("photos").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
