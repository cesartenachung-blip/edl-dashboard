// Formato "Lista de Personas Matriculadas a Escuela" (sistema de la iglesia):
//   GRUPO | DOCID | ALUMNO | CELULAR | CORREO | CURSO
//   Agrupado por código: "C18 (5 registros)", "C186 (6 registros)", ...
//
// Reglas de conteo:
//   - LIDER: el líder está matriculado. Aparece en el grupo de su "padre"
//     (líderes C181..C18M en el grupo C18; líderes Next C18J1.. en el grupo C18J).
//     Se identifica por nombre comparando con la lista de líderes de Drive.
//   - DISC: cada matriculado del grupo del líder (ej. grupo C186 → DISC de C186).
//   - Equipo Principal C18J / C28J suma como DISC todo su grupo y todos sus subgrupos Next.
//   - TOTAL = LIDER + DISC. Líderes que no aparecen en la lista quedan en 0.
import { norm } from './parse';

export const GROUP_RE = /^C\d{2}[0-9A-Z]{0,3}$/;
const STOP = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'NEXT', 'VDA']);

export function nameTokens(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/,?\s*\d{5,}\s*$/, '')
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

const tokEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= 1 && lev(a, b) <= 1);

// 0 = no coincide. Exige 2 palabras del nombre del líder (o 1 si su nombre solo tiene 1).
export function matchScore(leaderName, alumno) {
  const L = nameTokens(leaderName);
  const A = nameTokens(alumno);
  if (!L.length) return 0;
  const m = L.filter((t) => A.some((a) => tokEq(t, a))).length;
  if (m >= 2 || (L.length === 1 && m === 1)) return m / L.length + m * 0.01;
  return 0;
}

// ---------- Lectura ----------
export function parseRosterGrid(grid) {
  let hr = -1;
  let cols = null;
  let period = '';
  for (let r = 0; r < grid.length; r++) {
    const row = (grid[r] || []).map(norm);
    const txt = row.join(' ');
    const m = txt.match(/PERIODO:?\s*(\d{4}\s*-\s*\d)/);
    if (m && !period) period = m[1].replace(/\s/g, '');
    if (hr < 0 && row.includes('GRUPO') && row.includes('ALUMNO')) {
      hr = r;
      cols = { grupo: row.indexOf('GRUPO'), alumno: row.indexOf('ALUMNO'), curso: row.indexOf('CURSO') };
    }
  }
  if (hr < 0) return null;
  const rows = [];
  for (let r = hr + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const g = norm(row[cols.grupo]);
    if (!GROUP_RE.test(g)) continue;
    const alumno = String(row[cols.alumno] ?? '').trim();
    if (!alumno) continue;
    rows.push({ grupo: g, alumno, curso: cols.curso >= 0 ? String(row[cols.curso] ?? '').trim() : '' });
  }
  return { kind: 'lista', period, rows };
}

// items de una página de pdf.js: [{ s, x, y, w }]
export function rosterFromItems(items, out) {
  const lines = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let ln = lines.find((l) => Math.abs(l.y - it.y) < 3);
    if (!ln) { ln = { y: it.y, items: [] }; lines.push(ln); }
    ln.items.push(it);
  }
  for (const ln of lines) {
    const its = ln.items.sort((a, b) => a.x - b.x);
    const text = its.map((i) => i.s).join(' ');
    if (!out.period) {
      const m = text.match(/Periodo:?\s*(\d{4}\s*-\s*\d)/i);
      if (m) out.period = m[1].replace(/\s/g, '');
    }
    if (/GRUPO/.test(text) && /ALUMNO/.test(text)) { out.hasHeader = true; continue; }
    if (/registros?\s*\)/i.test(text)) continue;
    const g = norm(its[0].s);
    if (!GROUP_RE.test(g) || its.length < 2) continue;
    let k = 1;
    if (/^[0-9A-Z]{6,}$/.test(its[1].s) && /\d{5,}/.test(its[1].s)) k = 2;
    const name = [];
    for (let j = k; j < its.length; j++) {
      const s = its[j].s;
      if (/^9\d{8}$/.test(s) || s.includes('@')) break;
      name.push(s);
    }
    const e = its.findIndex((i) => i.s.includes('@'));
    const curso = e >= 0 ? its.slice(e + 1).map((i) => i.s).join(' ') : '';
    const alumno = name.join(' ').replace(/\s+/g, ' ').trim();
    if (alumno) out.rows.push({ grupo: g, alumno, curso: curso.replace(/\s+/g, ' ').trim() });
  }
}

// ---------- Conteo ----------
// leaders: [{ cod, nombre, team }]
export function buildAssignments(rows, leaders) {
  const codes = new Set(leaders.map((l) => l.cod));
  return rows.map((r, i) => {
    const children = leaders.filter((l) => l.cod.length === r.grupo.length + 1 && l.cod.startsWith(r.grupo));
    let auto = null;
    let ambiguous = false;
    if (children.length) {
      const scored = children.map((l) => ({ l, s: matchScore(l.nombre, r.alumno) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
      if (scored.length) {
        if (scored.length > 1 && scored[1].s === scored[0].s) ambiguous = true;
        else auto = scored[0].l.cod;
      }
    }
    const isLeaderGroup = codes.has(r.grupo);
    const fallback = isLeaderGroup ? 'disc' : 'ignore';
    const inNetwork = isLeaderGroup || children.length > 0 || [...codes].some((c) => r.grupo.startsWith(c));
    return { ...r, i, children, auto, ambiguous, isLeaderGroup, inNetwork, def: auto || fallback };
  });
}

export function computeRoster(assigned, leaders, choices = {}) {
  const team = new Map(leaders.map((l) => [l.cod, l.team]));
  const res = new Map(leaders.map((l) => [l.cod, { cod: l.cod, nombre: l.nombre, lider: 0, disc: 0, total: 0 }]));
  const principal = leaders.filter((l) => l.team === 'principal').map((l) => l.cod);
  let counted = 0;

  for (const r of assigned) {
    const choice = choices[r.i] ?? r.def;
    if (choice === 'ignore') continue;
    const asLeader = res.has(choice) ? choice : null;
    let used = false;
    if (asLeader) { res.get(asLeader).lider++; used = true; }
    const G = r.grupo;
    if (res.has(G) && !(asLeader && team.get(asLeader) === team.get(G))) { res.get(G).disc++; used = true; }
    if (team.get(G) !== 'principal') {
      const anc = principal.filter((c) => c !== G && G.startsWith(c)).sort((a, b) => b.length - a.length)[0];
      if (anc) { res.get(anc).disc++; used = true; }
    }
    if (used) counted++;
  }
  const out = { hombres: [], mujeres: [], counted };
  for (const r of res.values()) {
    r.total = r.lider + r.disc;
    (r.cod[1] === '1' ? out.hombres : out.mujeres).push(r);
  }
  return out;
}
