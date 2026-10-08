import { parseGrid, filterTeam } from './parse';

export function cellValue(v) {
  if (v == null) return null;
  if (typeof v !== 'object') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if ('result' in v) return typeof v.result === 'object' ? null : v.result;
  if ('formula' in v || 'sharedFormula' in v) return null;
  if (v.richText) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return v.text;
  return null;
}

export function worksheetToGrid(ws) {
  const grid = [];
  const cols = ws.columnCount;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= cols; c++) arr.push(cellValue(row.getCell(c).value));
    grid.push(arr);
  }
  return grid;
}

export function pickSheet(wb, name) {
  const ws = (name && wb.getWorksheet(name)) || wb.worksheets[0];
  if (!ws) throw new Error('El archivo de Drive no tiene hojas.');
  return ws;
}

function setNum(cell, n, blankIfZero) {
  const v = cell.value;
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    cell.value = { ...v, result: n };
    return;
  }
  cell.value = blankIfZero && !n ? null : n;
}

// Escribe solo LIDER, DISC y TOTAL por código. LOGRO, nombres, formatos y filas no se tocan.
export function applyRecords(ws, records, team) {
  const raw = parseGrid(worksheetToGrid(ws));
  if (!raw) throw new Error(`No se encontró la cabecera LOGRO en la hoja "${ws.name}".`);
  const parsed = filterTeam(raw, team);
  const idx = new Map([...parsed.hombres, ...parsed.mujeres].map((r) => [r.cod, r]));
  let updated = 0;
  const notFound = [];
  for (const rec of records) {
    const t = idx.get(rec.cod);
    if (!t) { notFound.push(rec.cod); continue; }
    const changed = t.lider !== rec.lider || t.disc !== rec.disc || t.total !== rec.total;
    const row = ws.getRow(t._row + 1);
    const c = t._col + 1;
    setNum(row.getCell(c + 1), rec.lider, true);
    setNum(row.getCell(c + 2), rec.disc, true);
    setNum(row.getCell(c + 3), rec.total, false);
    if (changed) updated++;
  }
  return { updated, notFound };
}
