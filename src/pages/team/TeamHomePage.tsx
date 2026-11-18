import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Flag, Home, Loader2, MapPin, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/team/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useNow, useTeam } from "@/hooks/useTeam";
import { errorMessage } from "@/lib/errors";
import { formatDuration, formatTime } from "@/lib/format";
import { readPositionOnce } from "@/lib/geo";
import { cn } from "@/lib/utils";

export default function TeamHomePage() {
  const { team, states, bySeq, nextSeq, score, adjustments } = useTeam();
  const next = nextSeq ? bySeq.get(nextSeq) : undefined;
  const doneCount = states.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      <Countdown />

      <section aria-label="Pontuação" className="grid grid-cols-2 gap-3">
        <Card className="border-primary">
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <Trophy className="h-4 w-4" aria-hidden /> Pontuação
            </p>
            <p className="text-4xl font-extrabold tabular-nums">{score?.total ?? 0}</p>
            {score && score.pending_count > 0 && (
              <p className="text-sm text-muted-foreground">
                {score.pending_count} {score.pending_count === 1 ? "desafio" : "desafios"} por validar
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
              <Flag className="h-4 w-4" aria-hidden /> Postos
            </p>
            <p className="text-4xl font-extrabold tabular-nums">
              {doneCount}
              <span className="text-xl text-muted-foreground">/{states.length}</span>
            </p>
            <p className="text-sm text-muted-foreground">Começaram no posto {team.start_seq}</p>
          </CardContent>
        </Card>
      </section>

      {score && (score.late_penalty < 0 || adjustments.length > 0) && (
        <Card>
          <CardContent className="space-y-1 p-4 text-base">
            <p className="font-semibold">Detalhe da pontuação</p>
            <p>Quiz: {score.quiz_points} · Desafios: {score.challenge_points}</p>
            {score.teamwork_points > 0 && <p>Trabalho de equipa: +{score.teamwork_points}</p>}
            {score.presentation_points > 0 && <p>Apresentação: +{score.presentation_points}</p>}
            {adjustments
              .filter((a) => a.type === "safety")
              .map((a) => (
                <p key={a.id} className="text-destructive">
                  Regra de segurança: {a.points}
                  {a.reason ? ` — ${a.reason}` : ""}
                </p>
              ))}
            {score.late_penalty < 0 && (
              <p className="text-destructive">
                Atraso ({score.late_minutes} min): {score.late_penalty}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {next ? (
        <Card className="border-accent bg-accent/10">
          <CardHeader className="pb-2">
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Próximo posto</p>
            <CardTitle className="text-2xl">
              {next.checkpoint.seq}. {next.checkpoint.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">{next.checkpoint.theme}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild size="lg">
                <Link to={`/equipa/posto/${next.checkpoint.seq}`}>
                  Abrir posto <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/equipa/mapa">
                  <MapPin aria-hidden /> Mapa
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="success">
          <Flag aria-hidden />
          <AlertTitle>Todos os postos feitos!</AlertTitle>
          <AlertDescription>Regressem à EPA e carreguem em "Chegámos à EPA".</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="postos-title" className="space-y-2">
        <h2 id="postos-title" className="text-xl font-bold">
          Os 7 postos (pela vossa ordem)
        </h2>
        <ol className="space-y-2">
          {states.map((s) => (
            <li key={s.checkpoint.id}>
              <Link
                to={`/equipa/posto/${s.checkpoint.seq}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 bg-card p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  s.checkpoint.seq === nextSeq && "border-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold",
                    s.done ? "bg-success text-success-foreground" : "bg-secondary",
                  )}
                  aria-hidden
                >
                  {s.checkpoint.seq}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{s.checkpoint.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <StatusBadge status={s.status} />
                    {s.status === "approved" && s.submission && (
                      <span className="text-sm font-semibold text-success">+{s.submission.challenge_points}</span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      · Quiz: {s.answer ? (s.answer.correct ? "certo ✓" : "errado ✗") : "por responder"}
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <ArrivalCard />
    </div>
  );
}

function Countdown() {
  const { deadline, team } = useTeam();
  const now = useNow(1000);
  const remaining = deadline.getTime() - now;
  const late = remaining < 0;
  if (team.arrived_at) return null;
  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 p-4",
        late ? "border-destructive bg-destructive/10" : remaining < 15 * 60_000 ? "border-warning bg-warning/10" : "border-primary bg-primary/5",
      )}
    >
      <Clock className={cn("h-8 w-8 shrink-0", late ? "text-destructive" : "text-primary")} aria-hidden />
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          Regresso à EPA até às {formatTime(deadline)}
        </p>
        <p className="text-2xl font-extrabold tabular-nums">
          {late ? `Atrasados ${formatDuration(-remaining)}` : `Faltam ${formatDuration(remaining)}`}
        </p>
        {late && <p className="text-sm font-semibold text-destructive">−5 pontos por cada 5 minutos de atraso</p>}
      </div>
    </div>
  );
}

function ArrivalCard() {
  const { team, refetch } = useTeam();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (team.arrived_at) {
    return (
      <Alert variant="success">
        <Home aria-hidden />
        <AlertTitle>Chegada registada às {formatTime(team.arrived_at)}</AlertTitle>
        <AlertDescription>Bom trabalho! Aguardem as indicações dos professores.</AlertDescription>
      </Alert>
    );
  }

  async function confirm() {
    setBusy(true);
    try {
      const gps = await readPositionOnce(8000);
      const { error } = await supabase.rpc("mark_arrival", {
        p_lat: gps.lat ?? undefined,
        p_lng: gps.lng ?? undefined,
      });
      if (error) throw error;
      toast.success("Chegada registada!");
      setOpen(false);
      refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="lg" variant="success" className="w-full" onClick={() => setOpen(true)}>
        <Home aria-hidden /> Chegámos à EPA
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmam a chegada?</DialogTitle>
            <DialogDescription className="text-base">
              Só carreguem quando <strong>toda a equipa</strong> estiver na EPA. A hora fica registada uma única vez e
              conta para o desempate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Ainda não
            </Button>
            <Button variant="success" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Sim, chegámos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
