const formatter = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a decimal-string or number as ৳ with thousands separators; drops trailing .00. */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "৳0";
  const rounded = Math.round(n * 100) / 100;
  return `৳${formatter.format(rounded)}`;
}

/** Same as formatMoney but always shows two decimals — for ledgers / receipts. */
export function formatMoneyExact(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "৳0.00";
  return `৳${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d)\.)/g, ",")}`;
}
