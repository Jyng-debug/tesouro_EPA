import { describe, expect, it } from "vitest";
import { nextSeq, routeOrder } from "./route";
import { distanceMeters, formatDistance } from "./geo";
import { formatDuration } from "./format";

describe("routeOrder", () => {
  it("começa no posto inicial e dá a volta", () => {
    expect(routeOrder(4)).toEqual([4, 5, 6, 7, 1, 2, 3]);
    expect(routeOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(routeOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });
  it("corrige valores inválidos", () => {
    expect(routeOrder(0)[0]).toBe(1);
    expect(routeOrder(99)[0]).toBe(7);
  });
});

describe("nextSeq", () => {
  it("devolve o primeiro posto por fazer pela ordem", () => {
    expect(nextSeq(4, [])).toBe(4);
    expect(nextSeq(4, [4, 5])).toBe(6);
  });
  it("ignora postos feitos fora de ordem", () => {
    expect(nextSeq(4, [1, 4])).toBe(5);
    expect(nextSeq(6, [6, 7])).toBe(1);
  });
  it("devolve null quando está tudo feito", () => {
    expect(nextSeq(3, [1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });
});

describe("distanceMeters", () => {
  it("≈111 m por 0,001° de latitude (igual ao servidor)", () => {
    const d = distanceMeters(40.6438, -8.6409, 40.6448, -8.6409);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
  it("formata em português", () => {
    expect(formatDistance(74.6)).toBe("75 m");
    expect(formatDistance(1530)).toBe("1,5 km");
  });
});

describe("formatDuration", () => {
  it("usa dias, horas, minutos ou segundos conforme a duração", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(12 * 60_000 + 30_000)).toBe("12 min 30 s");
    expect(formatDuration(65 * 60_000)).toBe("1 h 05 min");
    expect(formatDuration((3 * 24 + 4) * 3600_000)).toBe("3 dias e 4 h");
  });
});
