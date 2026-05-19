/**
 * Gera e faz download de um arquivo CSV a partir de um array de objetos.
 * @param filename Nome do arquivo sem extensão (ex: "leads")
 * @param rows Array de objetos. A primeira linha usa as chaves como cabeçalho.
 */
export function exportToCsv<T extends Record<string, any>>(filename: string, rows: T[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const bom = "﻿"; // BOM para Excel reconhecer UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
