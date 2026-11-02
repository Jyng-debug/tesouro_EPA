import { Link } from "react-router-dom";

// Página provisória (Fase 0). O painel dos professores é implementado na Fase 4.
export default function StaffHomePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Painel dos professores</h1>
      <p className="mt-2 text-muted-foreground">Em construção.</p>
      <Link to="/" className="mt-4 inline-block font-semibold text-primary underline">
        Voltar
      </Link>
    </main>
  );
}
