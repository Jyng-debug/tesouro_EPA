import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Página provisória (Fase 0). A entrada com código é implementada na Fase 2.
export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-20 w-20" />
        <h1 className="mt-3 text-3xl font-extrabold">Tesouro EPA</h1>
        <p className="text-lg text-muted-foreground">Caça ao Tesouro da Cidadania</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>A entrada com o código da equipa fica disponível na próxima fase.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link to="/prof">Área dos professores</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
