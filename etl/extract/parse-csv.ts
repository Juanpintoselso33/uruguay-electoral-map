/**
 * Parser CSV con soporte de campos entre comillas.
 * Necesario porque PRECANDIDATO trae comas dentro de comillas (gotcha Story 1.3).
 */
import { readFileSync } from 'node:fs';

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Lee un CSV y devuelve filas como objetos keyed por header. `encoding` por si la fuente es Latin-1. */
export function parseCsv(path: string, encoding: BufferEncoding = 'utf8'): Record<string, string>[] {
  const text = readFileSync(path, encoding);
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const cells = parseLine(lines[k]);
    if (cells.length < header.length) continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = cells[c];
    rows.push(row);
  }
  return rows;
}
