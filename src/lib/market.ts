import { round } from "@/utils/format";

export function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

type Quote = { price: number; change: number };

export function stepQuote<T extends Quote>(item: T, rng: () => number, volatility = 0.003): T {
  const previousClose = item.price - item.change;
  const noise = (rng() * 2 - 1) * Math.max(Math.abs(item.price) * volatility, 0.001);
  const meanReversion = -0.05 * item.change;
  const price = round(Math.max(item.price + noise + meanReversion, 0.0001), 4);
  const change = round(price - previousClose, 4);
  const changePercent = round((change / previousClose) * 100, 2);
  return { ...item, price, change, changePercent };
}

export function stepIndexQuote<T extends { value: number; change: number }>(
  item: T,
  rng: () => number
): T {
  const previousValue = item.value - (item.change / 100) * item.value;
  const noise = (rng() * 2 - 1) * item.value * 0.002;
  const value = round(Math.max(item.value + noise, 0.0001), 2);
  const change = round(((value - previousValue) / previousValue) * 100, 2);
  return { ...item, value, change };
}
