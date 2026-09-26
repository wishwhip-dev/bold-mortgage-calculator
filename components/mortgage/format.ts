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

/** Keeps digits and at most one decimal point (two places), plus a leading minus so a typed
 * negative number can reach validation instead of being silently swallowed. */
export function sanitizeMoney(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
  const decimals = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/[^0-9]/g, "").slice(0, 2);
  const hasDot = dot !== -1;
  const negative = raw.includes("-");
  let value: string;
  if (intPart === "" && !hasDot) value = "";
  else if (intPart === "") value = hasDot ? `0.${decimals}` : "";
  else value = hasDot ? `${intPart}.${decimals}` : intPart;
  return value === "" ? (negative && hasDot ? "-" : "") : negative ? `-${value}` : value;
}

/** Keeps digits and at most one decimal point (three places), plus a leading minus. */
export function sanitizePercent(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const intPart = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, 4);
  const decimals = dot === -1 ? "" : cleaned.slice(dot + 1).replace(/[^0-9]/g, "").slice(0, 3);
  const value = dot === -1 ? intPart : `${intPart}.${decimals}`;
  return value === "" ? "" : raw.includes("-") ? `-${value}` : value;
}

/** Parses a raw field value to a number, or undefined when the field is blank or not a number. */
export function parseAmount(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
