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
