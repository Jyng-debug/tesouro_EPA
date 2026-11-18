/** Ordem do percurso com rotação: começa no posto inicial e segue 1→7 (ex.: 4 → 4,5,6,7,1,2,3). */
export function routeOrder(startSeq: number, total = 7): number[] {
  const start = Math.min(Math.max(1, Math.round(startSeq) || 1), total);
  return Array.from({ length: total }, (_, i) => ((start - 1 + i) % total) + 1);
}

/**
 * Próximo posto pela ordem de rotação: o primeiro que ainda não está concluído.
 * Não bloqueia: se a equipa fizer um fora de ordem, simplesmente salta-o.
 */
export function nextSeq(startSeq: number, doneSeqs: Iterable<number>, total = 7): number | null {
  const done = new Set(doneSeqs);
  return routeOrder(startSeq, total).find((s) => !done.has(s)) ?? null;
}
