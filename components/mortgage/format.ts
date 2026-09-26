/** Formatting helpers shared by the calculator, the chart and the table. */

/** "$2,022.62" with cents, "$408,143" without. */
export function formatCurrency(value: number, cents = false): string {
  const rounded = cents ? value : Math.round(value);
  const formatted = Math.abs(rounded).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return `${rounded < 0 ? "-" : ""}$${formatted}`;
}

/** Groups the integer part of a raw typed string with commas: "400000" -> "400,000". */
export function groupDigits(raw: string): string {
  const [intPart = "", ...decimalParts] = raw.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalParts.length > 0 ? `${grouped}.${decimalParts.join("")}` : grouped;
}

/** Keeps only digits and at most one decimal point with two places — what a money field accepts. */
export function sanitizeMoney(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [intPart = "", ...rest] = cleaned.split(".");
  const trimmedInt = intPart.replace(/^0+(?=\d)/, "").slice(0, 12);
  const decimals = rest.join("").slice(0, 2);
  if (cleaned.startsWith(".") || (intPart === "" && rest.length > 0)) {
    return trimmedInt === "" && decimals !== "" ? `0.${decimals}` : decimals === "" ? "" : `0.${decimals}`;
  }
  return decimals !== "" ? `${trimmedInt}.${decimals}` : trimmedInt;
}

/** Keeps digits and one decimal point, several places — what a percentage field accepts. */
export function sanitizePercent(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [intPart = "", ...rest] = cleaned.split(".");
  const trimmedInt = intPart.replace(/^0+(?=\d)/, "").slice(0, 4);
  const decimals = rest.join("").slice(0, 3);
  return rest.length > 0 ? `${trimmedInt}.${decimals}` : trimmedInt;
}

/** Parses a raw field value to a number, or undefined when the field is blank or not a number. */
export function parseAmount(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
