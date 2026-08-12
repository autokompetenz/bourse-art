import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatChf,
  formatPercent,
  formatPrice,
  formatSigned,
  initialsOf,
  round,
} from "./format";

describe("format", () => {
  it("formate les montants en francs suisses", () => {
    expect(formatChf(1234.5)).toBe("1\u202f234,50\u00a0CHF");
    expect(formatChf(0)).toBe("0,00\u00a0CHF");
  });

  it("formate les prix simples", () => {
    expect(formatPrice(7842.35)).toBe("7\u202f842,35");
  });

  it("formate les pourcentages avec signe", () => {
    expect(formatPercent(1.36)).toBe("+1,36 %");
    expect(formatPercent(-0.43)).toBe("-0,43 %");
  });

  it("formate les variations signées en francs suisses", () => {
    expect(formatSigned(3.12)).toBe("+3,12 CHF");
    expect(formatSigned(-5.2)).toBe("-5,2 CHF");
  });

  it("formate les dates", () => {
    expect(formatDate("2026-08-11")).toBe("11/08/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("invalide")).toBe("invalide");
  });

  it("calcule les initiales", () => {
    expect(initialsOf("Marie Dubois")).toBe("MD");
    expect(initialsOf("Inès")).toBe("I");
    expect(initialsOf("")).toBe("");
  });

  it("arrondit avec précision", () => {
    expect(round(1.2367, 2)).toBe(1.24);
    expect(round(1.2, 4)).toBe(1.2);
  });
});
