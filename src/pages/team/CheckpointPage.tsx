import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudUpload,
  Loader2,
  MapPinOff,
  MessageSquare,
  RotateCcw,
  Send,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/team/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useOnline, useSignedUrl, useTeam, type CheckpointState } from "@/hooks/useTeam";
import { errorMessage } from "@/lib/errors";
import { formatTime } from "@/lib/format";
import { distanceMeters, formatDistance, readPositionOnce, type GpsReading } from "@/lib/geo";
import { compressImage } from "@/lib/image";
import { discardQueued, enqueueSubmission, getQueuedPhoto, processQueue } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

export default function CheckpointPage() {
  const { seq } = useParams();
  const { bySeq, nextSeq } = useTeam();
  const state = bySeq.get(Number(seq));

  if (!state) {
    return (
      <div className="space-y-4">
        <p className="text-lg">Posto não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/equipa">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  const cp = state.checkpoint;
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/equipa">
          <ArrowLeft aria-hidden /> Início
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Posto {cp.seq}</Badge>
          <Badge variant="secondary">{cp.theme}</Badge>
          {nextSeq === cp.seq && <Badge className="bg-accent text-accent-foreground">Próximo</Badge>}
        </div>
        <h1 className="text-2xl font-extrabold leading-tight">{cp.name}</h1>
        {cp.description && <p className="text-lg text-muted-foreground">{cp.description}</p>}
      </header>

      <Card className="border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" aria-hidden /> Desafio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">{cp.challenge}</p>
        </CardContent>
      </Card>

      <Alert variant="warning">
        <UserX aria-hidden />
        <AlertTitle>Fotografa locais e objetos, não pessoas.</AlertTitle>
      </Alert>

      <PhotoSection key={cp.id} state={state} />
      <QuizSection key={`quiz-${cp.id}`} state={state} />
    </div>
  );
}

// =============================================================================
// Fotografia + resposta escrita
// =============================================================================
type Dialogs = { kind: "outside"; distance: number; gps: GpsReading } | { kind: "nogps"; gps: GpsReading } | null;

function PhotoSection({ state }: { state: CheckpointState }) {
  const { team, event } = useTeam();
  const qc = useQueryClient();
  const cp = state.checkpoint;
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"idle" | "preparing" | "locating" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialogs>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Já existe submissão ativa (enviada, validada) ou na fila: mostrar estado.
  const showForm = state.status === "todo" || state.status === "rejected";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher a mesma foto de novo
    if (!file) return;
    setError(null);
    setStage("preparing");
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStage("idle");
    }
  }

  async function startSend() {
    setError(null);
    if (!photo) {
      setError("Tirem primeiro a fotografia.");
      return;
    }
    if (cp.text_prompt && text.trim().length < 3) {
      setError("Escrevam a resposta ao desafio antes de enviar.");
      return;
    }
    setStage("locating");
    const gps = await readPositionOnce();
    setStage("idle");
    if (gps.status !== "ok" || gps.lat == null || gps.lng == null) {
      setDialog({ kind: "nogps", gps });
      return;
    }
    const d = distanceMeters(gps.lat, gps.lng, cp.lat, cp.lng);
    if (d > cp.radius_m) {
      setDialog({ kind: "outside", distance: d, gps });
      return;
    }
    await send(gps);
  }

  async function send(gps: GpsReading) {
    if (!photo) return;
    setDialog(null);
    setStage("sending");
    try {
      await enqueueSubmission({
        teamId: team.id,
        eventId: event.id,
        checkpointId: cp.id,
        checkpointSeq: cp.seq,
        photo,
        challengeText: text.trim(),
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy,
        gpsStatus: gps.status,
        takenAt: new Date().toISOString(),
      });
      const result = await processQueue();
      if (result.sent > 0) {
        toast.success("Fotografia enviada! Aguardem a validação do professor.");
      } else {
        toast.warning("Sem rede: a fotografia ficou guardada e será enviada automaticamente.");
      }
      await qc.invalidateQueries({ queryKey: ["team", team.id] });
      setPhoto(null);
      setPreview(null);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Fotografia</CardTitle>
          <StatusBadge status={state.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.queued && <QueuedInfo state={state} />}
        {state.submission && <SubmissionInfo state={state} />}

        {showForm && !state.queued && (
          <>
            {state.status === "rejected" && (
              <p className="font-semibold">Podem tirar uma nova fotografia e enviar de novo.</p>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={onFile}
            />

            {preview ? (
              <figure className="space-y-2">
                <img src={preview} alt="Pré-visualização da fotografia tirada" className="w-full rounded-lg border-2" />
                <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
                  <RotateCcw aria-hidden /> Repetir fotografia
                </Button>
              </figure>
            ) : (
              <Button size="lg" className="h-20 w-full text-xl" onClick={() => inputRef.current?.click()} disabled={busy}>
                {stage === "preparing" ? <Loader2 className="animate-spin" aria-hidden /> : <Camera className="!size-7" aria-hidden />}
                {stage === "preparing" ? "A preparar fotografia…" : "Tirar fotografia"}
              </Button>
            )}

            {cp.text_prompt && (
              <div className="space-y-2">
                <Label htmlFor={`text-${cp.id}`}>{cp.text_prompt}</Label>
                <Textarea
                  id={`text-${cp.id}`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={600}
                  rows={4}
                  placeholder="Escrevam aqui a vossa resposta…"
                />
                <p className="text-right text-sm text-muted-foreground">{text.length}/600</p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button size="lg" variant="success" className="w-full" onClick={startSend} disabled={busy || !photo}>
              {stage === "locating" || stage === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {stage === "locating" ? "A obter localização…" : stage === "sending" ? "A enviar…" : "Enviar desafio"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Ao enviar, a app lê a localização uma única vez para confirmar que estão no posto.
            </p>
          </>
        )}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog?.kind === "outside" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-warning" aria-hidden /> Estão longe do posto
                </DialogTitle>
                <DialogDescription className="text-base">
                  O GPS indica que estão a <strong>{formatDistance(dialog.distance)}</strong> do posto (o limite é{" "}
                  {cp.radius_m} m). Podem aproximar-se e tentar de novo, ou enviar assim mesmo: a submissão fica marcada
                  como <strong>"fora da área"</strong> para o professor rever.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Vou aproximar-me
                </Button>
                <Button variant="accent" onClick={() => send(dialog.gps)}>
                  Enviar fora da área
                </Button>
              </DialogFooter>
            </>
          )}
          {dialog?.kind === "nogps" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPinOff className="h-6 w-6 text-warning" aria-hidden /> Sem localização
                </DialogTitle>
                <DialogDescription className="text-base">
                  {dialog.gps.status === "denied"
                    ? "A localização foi recusada neste telemóvel."
                    : "Não foi possível obter a localização (GPS desligado ou sem sinal)."}{" "}
                  Podem enviar assim mesmo — o professor verá a indicação "sem GPS".
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Cancelar
                </Button>
                <Button variant="accent" onClick={() => send(dialog.gps)}>
                  Enviar sem localização
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SubmissionInfo({ state }: { state: CheckpointState }) {
  const s = state.submission!;
  const url = useSignedUrl(s.photo_path);
  // Se há uma nova tentativa na fila depois de uma rejeição, mostrar só o essencial.
  return (
    <div className="space-y-3">
      {url.data ? (
        <img src={url.data} alt="Fotografia enviada pela equipa" className="w-full rounded-lg border-2" loading="lazy" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border-2 bg-muted" aria-hidden>
          {url.isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Enviada às {formatTime(s.created_at)}
        {s.out_of_area && s.distance_m != null && ` · fora da área (${formatDistance(s.distance_m)})`}
        {s.gps_status !== "ok" && " · sem GPS"}
      </p>
      {s.challenge_text && <blockquote className="border-l-4 border-primary pl-3 italic">{s.challenge_text}</blockquote>}
      {s.status === "approved" && (
        <Alert variant="success">
          <CheckCircle2 aria-hidden />
          <AlertTitle>Validado: +{s.challenge_points} pontos</AlertTitle>
          <AlertDescription>
            Foto {s.points_photo}/5 · Pertinência {s.points_relevance}/5 · Frase {s.points_text}/5
          </AlertDescription>
        </Alert>
      )}
      {s.status === "rejected" && (
        <Alert variant="destructive">
          <XCircle aria-hidden />
          <AlertTitle>Desafio rejeitado</AlertTitle>
        </Alert>
      )}
      {s.status === "pending" && <p className="font-semibold">A aguardar validação do professor.</p>}
      {s.teacher_comment && (
        <div className="flex gap-2 rounded-lg border-2 border-primary bg-primary/5 p-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p>
            <span className="font-semibold">Comentário do professor: </span>
            {s.teacher_comment}
          </p>
        </div>
      )}
    </div>
  );
}

function QueuedInfo({ state }: { state: CheckpointState }) {
  const q = state.queued!;
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    void getQueuedPhoto(q.id).then((blob) => {
      if (blob) {
        u = URL.createObjectURL(blob);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [q.id]);

  async function retry() {
    setBusy(true);
    const r = await processQueue();
    setBusy(false);
    if (r.sent > 0) toast.success("Fotografia enviada!");
  }

  return (
    <div className="space-y-3">
      {url && <img src={url} alt="Fotografia a aguardar envio" className="w-full rounded-lg border-2 opacity-90" />}
      {q.failed ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Não foi possível enviar</AlertTitle>
          <AlertDescription>{q.lastError}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <CloudUpload aria-hidden />
          <AlertTitle>A aguardar envio</AlertTitle>
          <AlertDescription>
            A fotografia está guardada neste telemóvel e será enviada automaticamente quando houver rede.
            {q.lastError && <span className="mt-1 block text-sm">Última tentativa: {q.lastError}</span>}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2">
        {!q.failed && (
          <Button variant="outline" onClick={retry} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />} Tentar agora
          </Button>
        )}
        <Button variant="outline" className={cn(q.failed && "col-span-2")} onClick={() => void discardQueued(q.id)} disabled={busy}>
          <Trash2 aria-hidden /> Descartar
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Quiz (uma única tentativa; a validação é feita no servidor)
// =============================================================================
const LETTERS = ["A", "B", "C", "D"] as const;

function QuizSection({ state }: { state: CheckpointState }) {
  const { team } = useTeam();
  const qc = useQueryClient();
  const online = useOnline();
  const [choice, setChoice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quiz = state.quiz;
  if (!quiz) return null;
  const options = (quiz.options ?? {}) as Record<string, string>;
  const answer = state.answer;

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("submit_quiz_answer", {
        p_checkpoint_id: state.checkpoint.id,
        p_option: choice,
      });
      if (rpcError) throw rpcError;
      const r = data as { correct: boolean; already_answered: boolean };
      if (r.already_answered) toast.info("Outro telemóvel da equipa já tinha respondido a esta pergunta.");
      else if (r.correct) toast.success("Resposta certa! +10 pontos");
      else toast.error("Resposta errada.");
      setConfirming(false);
      await qc.invalidateQueries({ queryKey: ["team", team.id] });
    } catch (err) {
      setError(errorMessage(err));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Pergunta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-semibold" id={`q-${quiz.checkpoint_id}`}>
          {quiz.question}
        </p>

        {answer ? (
          <div className="space-y-2">
            <ul className="space-y-2">
              {LETTERS.map((l) => (
                <li
                  key={l}
                  className={cn(
                    "flex gap-3 rounded-lg border-2 p-3",
                    answer.option === l && (answer.correct ? "border-success bg-success/10" : "border-destructive bg-destructive/10"),
                  )}
                >
                  <span className="font-extrabold">{l})</span> {options[l]}
                </li>
              ))}
            </ul>
            <Alert variant={answer.correct ? "success" : "destructive"}>
              {answer.correct ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
              <AlertTitle>{answer.correct ? "Resposta certa! +10 pontos" : "Resposta errada"}</AlertTitle>
              <AlertDescription>A equipa respondeu {answer.option}. Só havia uma tentativa.</AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <fieldset aria-labelledby={`q-${quiz.checkpoint_id}`} className="space-y-2">
              {LETTERS.map((l) => (
                <label
                  key={l}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 text-lg has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring",
                    choice === l ? "border-primary bg-primary/10" : "border-input",
                  )}
                >
                  <input
                    type="radio"
                    name={`quiz-${quiz.checkpoint_id}`}
                    value={l}
                    checked={choice === l}
                    onChange={() => setChoice(l)}
                    className="h-6 w-6 accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="font-extrabold">{l})</span> {options[l]}
                  </span>
                </label>
              ))}
            </fieldset>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!online && <p className="font-semibold text-warning">Sem rede: para responder ao quiz é preciso ligação.</p>}
            <Button size="lg" className="w-full" disabled={!choice || busy || !online} onClick={() => setConfirming(true)}>
              Confirmar resposta
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar a resposta {choice}?</DialogTitle>
            <DialogDescription className="text-base">
              Só há <strong>uma tentativa</strong> por equipa. Combinem a resposta antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Voltar
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
