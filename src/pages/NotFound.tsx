import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço que abriste não existe.</p>
      <Link to="/" className="font-semibold text-primary underline">
        Ir para o início
      </Link>
    </main>
  );
}
