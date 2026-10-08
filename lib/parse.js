// Lógica compartida (cliente y servidor) para leer la tabla de la Escuela de Líderes.
// Estructura esperada (igual al Excel de Drive):
//   fila de periodos:  ...  2026-2 | 2026-3 (combinada)
//   fila de cabecera:  COD | NOMBRE | LOGRO | LIDER | DISC | TOTAL
//   filas de datos:    C181 | JAIME SANCHEZ | 9 | | 1 | 1
// Hombres y mujeres pueden estar lado a lado (dos bloques) o en hojas/páginas separadas.

export const CODE_RE = /^C\d[0-9A-Z]{2,5}$/;

// Códigos de líderes por equipo: C18 = hombres, C28 = mujeres.
// Principal: C18x / C28x (un carácter después de C18/C28, ej. C181, C18A, C18J).
// Next:      C18Jx / C28Jx (ej. C18J1, C28JA).
export const TEAM_CODES = {
  principal: { hombres: /^C18[0-9A-Z]$/, mujeres: /^C28[0-9A-Z]$/ },
  next: { hombres: /^C18J[0-9A-Z]{1,2}$/, mujeres: /^C28J[0-9A-Z]{1,2}$/ },
};

export function teamGender(team, cod) {
  const rules = TEAM_CODES[team];
  if (!rules) return null;
  if (rules.hombres.test(cod)) return 'hombres';
  if (rules.mujeres.test(cod)) return 'mujeres';
  return null;
}

// Deja solo los líderes del equipo y los ubica en hombres/mujeres según su código.
export function filterTeam(parsed, team) {
  const out = { ...parsed, hombres: [], mujeres: [], otros: [] };
  for (const r of [...parsed.hombres, ...parsed.mujeres]) {
    const g = teamGender(team, r.cod);
    (g ? out[g] : out.otros).push(r);
  }
  return out;
}

export const norm = (v) => (v == null ? '' : String(v)).trim().toUpperCase();

export function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function genderOf(cod, blockIdx = 0) {
  const d = String(cod)[1];
  if (d === '1') return 'hombres';
  if (d === '2') return 'mujeres';
  return blockIdx === 0 ? 'hombres' : 'mujeres';
}

const cleanPeriod = (v) => (v == null ? '' : String(v).trim());

export function parseGrid(grid) {
  let headerRow = -1;
  const logroCols = [];
  for (let r = 0; r < grid.length && headerRow < 0; r++) {
    const row = grid[r] || [];
    row.forEach((v, c) => { if (norm(v) === 'LOGRO') logroCols.push(c); });
    if (logroCols.length) headerRow = r;
  }
  if (headerRow < 0) return null;

  const pr = grid[headerRow - 1] || [];
  const L0 = logroCols[0];
  let periodCurr = '';
  for (let c = L0 + 1; c <= L0 + 3; c++) {
    if (pr[c] != null && String(pr[c]).trim()) { periodCurr = cleanPeriod(pr[c]); break; }
  }
  const out = { periodPrev: cleanPeriod(pr[L0]), periodCurr, hombres: [], mujeres: [] };
  const seen = new Set();

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    logroCols.forEach((L, bi) => {
      const cod = norm(row[L - 2]);
      if (!CODE_RE.test(cod) || seen.has(cod)) return;
      seen.add(cod);
      const lider = num(row[L + 1]);
      const disc = num(row[L + 2]);
      const tRaw = row[L + 3];
      const total = tRaw == null || tRaw === '' ? lider + disc : num(tRaw);
      out[genderOf(cod, bi)].push({
        cod, nombre: String(row[L - 1] ?? '').trim(),
        logro: num(row[L]), lider, disc, total, _row: r, _col: L,
      });
    });
  }
  return out;
}

export function stripPositions(parsed) {
  const clean = (l) => l.map(({ _row, _col, ...r }) => r);
  return { ...parsed, hombres: clean(parsed.hombres), mujeres: clean(parsed.mujeres) };
}

export function summarize(list = []) {
  const s = { logro: 0, lider: 0, disc: 0, total: 0, sinInscritos: 0, lideres: list.length };
  for (const r of list) {
    s.logro += r.logro; s.lider += r.lider; s.disc += r.disc; s.total += r.total;
    if (!r.total) s.sinInscritos++;
  }
  s.pct = s.logro ? s.total / s.logro : 0;
  return s;
}

export const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// ---------- PDF: reconstruye la tabla con la posición (x, y) de cada texto ----------
// items: [{ s, x, y, w }] de una página (coordenadas de pdf.js, y crece hacia arriba).
export function extractFromItems(items, result, seen) {
  const sameLine = (a, b) => Math.abs(a.y - b.y) < 3;
  const cx = (i) => i.x + i.w / 2;

  const blocks = items
    .filter((i) => norm(i.s) === 'LOGRO')
    .map((lg) => {
      const line = items.filter((i) => sameLine(i, lg) && i.x > lg.x);
      const pick = (k) => line.filter((i) => norm(i.s) === k).sort((a, b) => a.x - b.x)[0];
      const [li, di, ti] = [pick('LIDER'), pick('DISC'), pick('TOTAL')];
      if (!li || !di || !ti) return null;
      return { y: lg.y, cols: { logro: cx(lg), lider: cx(li), disc: cx(di), total: cx(ti) } };
    })
    .filter(Boolean)
    .sort((a, b) => a.cols.logro - b.cols.logro);
  if (!blocks.length) return 0;

  if (!result.periodPrev) {
    const b = blocks[0];
    const per = items
      .filter((i) => /^\d{4}\s*-\s*\d$/.test(i.s) && i.y > b.y && i.y - b.y < 30)
      .sort((a, z) => a.x - z.x);
    const prev = per.find((i) => Math.abs(cx(i) - b.cols.logro) < 30);
    const curr = per.find((i) => cx(i) > b.cols.logro + 20);
    if (prev) result.periodPrev = prev.s.replace(/\s/g, '');
    if (curr) result.periodCurr = curr.s.replace(/\s/g, '');
  }

  let count = 0;
  const codes = items.filter((i) => CODE_RE.test(norm(i.s)));
  for (const c of codes) {
    const cod = norm(c.s);
    if (seen.has(cod)) continue;
    const blk = blocks.filter((b) => b.cols.logro > c.x).sort((a, b) => a.cols.logro - b.cols.logro)[0];
    if (!blk) continue;
    const { cols } = blk;
    const step = (cols.total - cols.logro) / 3 || 30;
    const limit = cols.total + step * 0.7;
    const line = items.filter((i) => i !== c && sameLine(i, c) && i.x > c.x && cx(i) <= limit);

    const nameParts = [];
    const vals = { logro: '', lider: '', disc: '', total: '' };
    for (const i of line.sort((a, b) => a.x - b.x)) {
      if (/^\d+$/.test(i.s) && cx(i) > cols.logro - step * 0.6) {
        let best = null;
        let d = Infinity;
        for (const k of Object.keys(cols)) {
          const dd = Math.abs(cx(i) - cols[k]);
          if (dd < d) { d = dd; best = k; }
        }
        if (d < step * 0.6) vals[best] = i.s;
      } else if (cx(i) < cols.logro - step * 0.4) {
        nameParts.push(i.s);
      }
    }
    const lider = num(vals.lider);
    const disc = num(vals.disc);
    seen.add(cod);
    result[genderOf(cod, blocks.indexOf(blk))].push({
      cod, nombre: nameParts.join(' ').replace(/\s+/g, ' ').trim(),
      logro: num(vals.logro), lider, disc,
      total: vals.total === '' ? lider + disc : num(vals.total),
    });
    count++;
  }
  return count;
}

// Separa textos tipo "1 6 7" que pdf.js a veces entrega juntos.
export function explodeItems(raw) {
  const out = [];
  for (const it of raw) {
    const str = it.str || '';
    const s = str.trim();
    if (!s) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width || 0;
    if (/^\d+(\s+\d+)+$/.test(s)) {
      const re = /\d+/g;
      let m;
      while ((m = re.exec(str))) {
        out.push({ s: m[0], x: x + (w * m.index) / str.length, y, w: (w * m[0].length) / str.length });
      }
    } else {
      out.push({ s, x, y, w });
    }
  }
  return out;
}
