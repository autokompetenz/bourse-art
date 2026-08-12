import { describe, it, expect } from "vitest";
import { seededRandom, stepQuote, stepIndexQuote } from "./market";

type FakeQuote = { price: number; change: number; changePercent: number };

describe("market", () => {
  it("produit une suite pseudo-aléatoire déterministe", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("fait évoluer le cours en gardant la cohérence change/changePercent", () => {
    const rng = seededRandom(7);
    const quote: FakeQuote = { price: 232.47, change: 3.12, changePercent: 1.36 };
    const next = stepQuote(quote, rng);
    expect(next.price).not.toBe(quote.price);
    expect(next.change).toBeCloseTo(next.price - (quote.price - quote.change), 4);
    expect(next.changePercent).toBeCloseTo((next.change / (quote.price - quote.change)) * 100, 2);
  });

  it("ne descend jamais sous zéro", () => {
    const rng = seededRandom(1);
    let quote: FakeQuote = { price: 0.0001, change: 0, changePercent: 0 };
    for (let i = 0; i < 100; i++) {
      quote = stepQuote(quote, rng);
      expect(quote.price).toBeGreaterThan(0);
    }
  });

  it("fait évoluer les indices en pourcentage", () => {
    const rng = seededRandom(99);
    const index = { name: "CAC 40", value: 7842.35, change: 0.62 };
    const next = stepIndexQuote(index, rng);
    expect(next.value).not.toBe(index.value);
    const prevValue = index.value - (index.change / 100) * index.value;
    expect(next.change).toBeCloseTo(((next.value - prevValue) / prevValue) * 100, 2);
  });
});
