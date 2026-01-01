export function formatDateTimeSP(value: string): string {
  const dt = new Date(value);
  return dt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function formatDateBR(value: string): string {
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}
