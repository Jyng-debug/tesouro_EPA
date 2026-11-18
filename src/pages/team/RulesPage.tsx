import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Footprints, LogOut, MapPin, Phone, Users, Volume2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalTeam } from "@/hooks/useTeam";
import { errorMessage } from "@/lib/errors";

const RULES = [
  { Icon: Users, title: "Andem sempre juntos", text: "A equipa não se separa em momento nenhum do percurso." },
  { Icon: Footprints, title: "Atravessem nas passadeiras", text: "Respeitem os semáforos e tenham atenção às bicicletas e trotinetes." },
  { Icon: Camera, title: "Não fotografem pessoas desconhecidas", text: "Fotografem locais e objetos. Se aparecer alguém por acaso, repitam a foto." },
  { Icon: Volume2, title: "Silêncio nos serviços públicos", text: "Na Loja do Cidadão, Biblioteca e Museu há pessoas a trabalhar e a ser atendidas." },
  { Icon: Zap, title: "Segurança primeiro", text: "Nunca corram nem usem o telemóvel enquanto atravessam a rua." },
  { Icon: MapPin, title: "Respeitem a hora de regresso", text: "Cada 5 minutos de atraso custam 5 pontos. Não cumprir uma regra de segurança custa 10." },
];

/** Regras e segurança. Funciona dentro da área da equipa e também antes de entrar. */
export default function RulesPage() {
  const ctx = useOptionalTeam();
  const coordinator = ctx?.event.coordinator_name;
  const phone = ctx?.event.coordinator_phone;

  return (
    <div className={ctx ? "space-y-4" : "mx-auto max-w-xl space-y-4 p-4"}>
      {!ctx && (
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft aria-hidden /> Voltar
          </Link>
        </Button>
      )}
      <h1 className="text-2xl font-extrabold">Regras e segurança</h1>

      <ul className="space-y-3">
        {RULES.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-3 rounded-xl border-2 bg-card p-4">
            <Icon className="mt-0.5 h-7 w-7 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-lg font-bold">{title}</p>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <Card className="border-destructive">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-destructive" aria-hidden /> Em caso de problema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-lg">
          <p>
            Contactem o coordenador{coordinator ? <>: <strong>{coordinator}</strong></> : " da atividade"}.
          </p>
          {phone ? (
            <Button asChild size="lg" variant="destructive" className="w-full">
              <a href={`tel:${phone.replace(/\s/g, "")}`}>
                <Phone aria-hidden /> Ligar {phone}
              </a>
            </Button>
          ) : (
            <p className="text-base text-muted-foreground">O contacto telefónico é dado pelos professores antes da partida.</p>
          )}
          <p className="text-base">Em emergência, liguem <a className="font-bold underline" href="tel:112">112</a>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Privacidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>A localização só é lida quando enviam uma fotografia ou carregam em "Chegámos à EPA". Não há rastreamento contínuo.</p>
          <p>As fotos ficam privadas (só a equipa e os professores as veem) e são apagadas depois da atividade.</p>
          <p>Não são recolhidos nomes, emails nem números de telefone dos alunos.</p>
        </CardContent>
      </Card>

      {ctx && <LeaveTeam />}
    </div>
  );
}

function LeaveTeam() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function leave() {
    try {
      const { data } = await supabase.auth.getUser();
      const { error } = await supabase.from("team_members").delete().eq("user_id", data.user!.id);
      if (error) throw error;
      qc.clear();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <LogOut aria-hidden /> Sair da equipa neste telemóvel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair da equipa?</DialogTitle>
            <DialogDescription className="text-base">
              Os dados da equipa não são apagados. Para voltar a entrar é preciso o código da equipa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={leave}>
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
