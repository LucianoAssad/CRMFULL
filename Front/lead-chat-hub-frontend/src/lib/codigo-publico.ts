/**
 * Formata o codigo_publico (10 dígitos) em XXX-XXX-XXXX (estilo Google Ads).
 * Aceita qualquer string e retorna apenas dígitos formatados.
 */
export function formatCodigoPublico(code: string | null | undefined): string {
  if (!code) return "—";
  const digits = String(code).replace(/\D/g, "").padStart(10, "0").slice(-10);
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

/** Retorna apenas os dígitos, útil para buscar no banco. */
export function onlyDigits(code: string | null | undefined): string {
  return String(code ?? "").replace(/\D/g, "");
}
