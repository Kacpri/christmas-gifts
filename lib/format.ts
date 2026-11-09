export function formatPrice(
  value: number | string | null | undefined
): string | null {
  if (value == null) return null;
  return (
    Number(value).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " zł"
  );
}

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const plural = (n: number, forms: [string, string, string]) => {
  if (n === 1) return forms[0];
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
};
