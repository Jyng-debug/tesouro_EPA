import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/team/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { useMembership, useSession } from "@/hooks/useTeam";
import { errorMessage } from "@/lib/errors";

export default function JoinPage() {
  const session = useSession();
  const membership = useMembership(session?.user.id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session === undefined || (session && membership.isLoading)) return <Loading />;
  if (session && membership.data) return <Navigate to="/equipa" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.replace(/[^A-Za-z0-9]/g, "").length < 4) {
      setError("Escreve o código completo da equipa (ex.: EPA-7K3Q).");
      return;
    }
    setBusy(true);
    try {
      // Sessão anónima: sem email nem dados pessoais.
      let { data } = await supabase.auth.getSession();
      if (!data.session) {
        const res = await supabase.auth.signInAnonymously();
        if (res.error) throw res.error;
        data = { session: res.data.session };
      }
      const { data: result, error: rpcError } = await supabase.rpc("join_team", { p_code: code });
      if (rpcError) throw rpcError;
      const r = result as { ok: boolean; error?: string; team_name?: string };
      if (!r.ok) {
        setError(r.error ?? "Código inválido.");
        return;
      }
      await qc.invalidateQueries({ queryKey: ["membership"] });
      navigate("/equipa", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-20 w-20" />
        <h1 className="mt-3 text-3xl font-extrabold">Tesouro EPA</h1>
        <p className="text-lg text-muted-foreground">Caça ao Tesouro da Cidadania</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" aria-hidden />
            Entrar na equipa
          </CardTitle>
          <CardDescription>Escreve o código que o professor deu à tua equipa.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="code">Código da equipa</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EPA-7K3Q"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={12}
                className="h-14 text-center font-mono text-2xl tracking-widest"
                aria-invalid={!!error}
                aria-describedby={error ? "code-error" : undefined}
              />
            </div>
            {error && (
              <Alert variant="destructive" id="code-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
              {busy ? "A entrar…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Vários telemóveis podem entrar na mesma equipa com o mesmo código.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2 text-center">
        <Link to="/regras" className="font-semibold text-primary underline underline-offset-4">
          Regras e segurança
        </Link>
        <Link to="/prof" className="text-sm text-muted-foreground underline underline-offset-4">
          Área dos professores
        </Link>
      </div>
    </main>
  );
}
