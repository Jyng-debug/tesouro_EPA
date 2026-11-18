/** Converte erros do Supabase/rede numa mensagem clara em português. */
export function errorMessage(err: unknown): string {
  if (!navigator.onLine) return "Sem ligação à internet. Tenta de novo quando tiveres rede.";
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string };
    if (e.message === "Failed to fetch" || e.message?.includes("NetworkError") || e.message?.includes("Load failed")) {
      return "Falha de rede. Verifica a ligação e tenta de novo.";
    }
    if (e.message?.includes("Anonymous sign-ins are disabled")) {
      return "A entrada de equipas não está ativa. Avisa o professor.";
    }
    if (e.message) return e.message;
  }
  if (typeof err === "string") return err;
  return "Ocorreu um erro inesperado. Tenta de novo.";
}

/** true se o erro é de rede/temporário (vale a pena tentar mais tarde). */
export function isTransientError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; status?: number; statusCode?: string | number };
    const msg = e.message ?? "";
    if (/fetch|network|load failed|timeout|aborted/i.test(msg)) return true;
    const status = Number(e.status ?? e.statusCode);
    if (status >= 500 || status === 429 || status === 408) return true;
    // A foto ainda não chegou ao Storage: voltar a tentar.
    if (e.code === "P0002" && msg.includes("fotografia")) return true;
  }
  return false;
}
