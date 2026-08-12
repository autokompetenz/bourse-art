export function formatChf(amount: number, digits = 2): string {
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPrice(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("fr-FR")} %`;
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("fr-FR")} CHF`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function maskCard(number: string): string {
  const digits = number.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
