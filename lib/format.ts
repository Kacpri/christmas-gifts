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
