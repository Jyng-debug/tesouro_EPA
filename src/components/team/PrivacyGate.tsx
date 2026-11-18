import { useState, type ReactNode } from "react";
import { Camera, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEY = "tesouro-epa:aviso-privacidade:v1";

function accepted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Aviso de privacidade mostrado na primeira utilização em cada telemóvel. */
export function PrivacyGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(accepted);
  if (ok) return <>{children}</>;

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* modo privado: mostra de novo na próxima vez */
    }
    setOk(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
            Antes de começar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-lg">
          <p className="flex gap-3">
            <MapPin className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <span>
              A app <strong>só lê a localização no momento em que enviam uma fotografia</strong> ou carregam em
              "Chegámos à EPA". Não há rastreamento contínuo.
            </span>
          </p>
          <p className="flex gap-3">
            <Camera className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
            <span>
              <strong>Fotografem locais e objetos, não pessoas.</strong> As fotos ficam privadas: só a vossa equipa e os
              professores as veem.
            </span>
          </p>
          <p className="text-base text-muted-foreground">
            Não pedimos nomes, emails nem números de telefone. A equipa identifica-se apenas pelo nome e turma.
          </p>
          <Button size="lg" className="w-full" onClick={accept}>
            Compreendi
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
