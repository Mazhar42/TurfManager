const formatter = new Intl.NumberFormat("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Format a decimal-string or number as ৳ with thousands separators; drops trailing .00. */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "৳0";
  return `৳${formatter.format(Math.round(n * 100) / 100)}`;
}
