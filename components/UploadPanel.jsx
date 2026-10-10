'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseGrid, stripPositions, filterTeam } from '@/lib/parse';
import { parseRosterGrid, buildAssignments, computeRoster } from '@/lib/roster';

const FIELDS = ['lider', 'disc', 'total'];
const isPdf = (f) => !!f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
const TEAM_IDS = ['principal', 'next'];
const CODES_HINT = { principal: 'C18 y C28', next: 'C18J y C28J' };

// Lee todas las hojas del Excel y junta los líderes (si un código se repite, vale el primero).
async function readExcel(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const roster = parseRosterGrid(grid);
    if (roster && roster.rows.length) return { ...roster, sheets: [name] };
  }
  const out = { kind: 'tabla', periodPrev: '', periodCurr: '', hombres: [], mujeres: [], sheets: [] };
  const seen = new Set();
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const raw = parseGrid(grid);
    if (!raw) continue;
    const p = stripPositions(raw);
    let added = 0;
    for (const g of ['hombres', 'mujeres']) {
      for (const r of p[g]) {
        if (seen.has(r.cod)) continue;
        seen.add(r.cod);
        out[g].push(r);
        added++;
      }
    }
    if (added) out.sheets.push(name);
  }
  if (!seen.size) throw new Error('No reconozco el formato del Excel. Debe ser la lista de matriculados (GRUPO, ALUMNO, CURSO) o la tabla de avance (COD, LOGRO, LIDER, DISC, TOTAL).');
  return out;
}

function teamDiff(parsed, team, current) {
  const f = filterTeam(parsed, team);
  const rows = [...f.hombres, ...f.mujeres];
  const map = new Map();
  if (current && !current.error) [...current.hombres, ...current.mujeres].forEach((r) => map.set(r.cod, r));
  const changed = [];
  const nuevos = [];
  let same = 0;
  for (const r of rows) {
    const c = map.get(r.cod);
    if (!c) nuevos.push(r);
    else if (FIELDS.some((k) => c[k] !== r[k])) changed.push({ r, c });
    else same++;
  }
  return { rows, changed, nuevos, same };
}

function TeamReview({ label, team, d }) {
  return (
    <div className="review">
      <h3>{label}</h3>
      {d.rows.length === 0 ? (
        <p className="muted">El archivo no trae líderes de este equipo ({CODES_HINT[team]}). No se modificará.</p>
      ) : (
        <>
          <p className="diff-sum">
            {d.rows.length} líderes: {d.changed.length} con cambios, {d.same} sin cambios
            {d.nuevos.length ? `, ${d.nuevos.length} con código que no existe en Drive (no se guardan)` : ''}.
          </p>
          {d.nuevos.length > 0 && (
            <p className="warn">
              Códigos nuevos: {d.nuevos.slice(0, 10).map((r) => `${r.cod} ${r.nombre}`).join(', ')}
              {d.nuevos.length > 10 ? ` y ${d.nuevos.length - 10} más` : ''}. Agrégalos primero en el Excel de Drive.
            </p>
          )}
          {d.changed.length > 0 && (
            <div className="sheet-scroll">
              <table className="diff">
                <thead>
                  <tr><th>COD</th><th>NOMBRE</th><th>LIDER</th><th>DISC</th><th>TOTAL</th></tr>
                </thead>
                <tbody>
                  {d.changed.map(({ r, c }) => (
                    <tr key={r.cod}>
                      <td>{r.cod}</td>
                      <td className="c-name">{c.nombre}</td>
                      {FIELDS.map((k) => (
                        <td key={k} className="n">
                          {c[k] === r[k] ? r[k] : <span className="chg"><s>{c[k]}</s> {r[k]}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RosterReview({ parsed, assigned, choices, setChoice, leaders, counted }) {
  const byCode = new Map(leaders.map((l) => [l.cod, l]));
  const leaderRows = assigned.filter((r) => r.children.length);
  const outside = assigned.filter((r) => !r.inNetwork).length;
  const pending = leaderRows.filter((r) => !r.auto && (choices[r.i] ?? r.def) === 'ignore').length;
  return (
    <div className="roster">
      <p className="diff-sum">
        Lista de matriculados{parsed.period ? ` del periodo ${parsed.period}` : ''}: {parsed.rows.length} registros,
        {' '}{counted} contados en la red{outside ? `, ${outside} de grupos que no son de la red (no se cuentan)` : ''}.
      </p>
      <h3>Líderes matriculados</h3>
      <p className="muted">
        Los líderes se matriculan en el grupo de su red (C18, C28, C18J, C28J) y los identifico por nombre.
        Revisa la columna &quot;Cuenta como&quot; y corrige si hace falta.
        {pending ? ` Hay ${pending} sin identificar.` : ''}
      </p>
      <div className="sheet-scroll">
        <table className="diff roster-table">
          <thead>
            <tr><th>GRUPO</th><th>ALUMNO</th><th>CURSO</th><th>CUENTA COMO</th></tr>
          </thead>
          <tbody>
            {leaderRows.map((r) => {
              const val = choices[r.i] ?? r.def;
              return (
                <tr key={r.i} className={!r.auto ? 'is-pending' : ''}>
                  <td>{r.grupo}</td>
                  <td className="c-name">{r.alumno}</td>
                  <td className="c-curso">{r.curso}</td>
                  <td>
                    <select value={val} onChange={(e) => setChoice(r.i, e.target.value)}>
                      {r.children.map((l) => (
                        <option key={l.cod} value={l.cod}>Líder {l.cod} {byCode.get(l.cod)?.nombre}</option>
                      ))}
                      {r.discOf && <option value="disc">Discípulo de {r.discOf}</option>}
                      <option value="ignore">No contar</option>
                    </select>
                    {r.ambiguous && <span className="tag">varios posibles</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UploadPanel({ data, uploadKeyRequired }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState({ type: 'idle' });
  const [key, setKey] = useState('');
  const [dragging, setDragging] = useState(false);
  const [choices, setChoices] = useState({});

  const leaders = useMemo(() => TEAM_IDS.flatMap((t) => (data[t] && !data[t].error
    ? [...data[t].hombres, ...data[t].mujeres].map((r) => ({ cod: r.cod, nombre: r.nombre, team: t }))
    : [])), [data]);

  const assigned = useMemo(
    () => (parsed?.kind === 'lista' ? buildAssignments(parsed.rows, leaders) : null),
    [parsed, leaders],
  );
  const roster = useMemo(
    () => (assigned ? computeRoster(assigned, leaders, choices) : null),
    [assigned, leaders, choices],
  );

  const diffs = useMemo(() => {
    if (!parsed) return null;
    const source = roster || parsed;
    const o = {};
    TEAM_IDS.forEach((t) => { o[t] = teamDiff(source, t, data[t]); });
    return o;
  }, [parsed, roster, data]);

  const totalChanges = diffs ? TEAM_IDS.reduce((s, t) => s + diffs[t].changed.length, 0) : 0;
  const totalRows = diffs ? TEAM_IDS.reduce((s, t) => s + diffs[t].rows.length, 0) : 0;
  const busy = status.type === 'busy';

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setChoices({});
    setSaved(false);
    setStatus({ type: 'busy', msg: 'Leyendo archivo…' });
    try {
      let p;
      if (isPdf(f)) {
        const { parsePdf } = await import('@/lib/pdf');
        p = await parsePdf(await f.arrayBuffer());
      } else {
        p = await readExcel(f);
      }
      setParsed(p);
      setStatus({ type: 'idle' });
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
  }

  async function saveToDrive() {
    setStatus({ type: 'busy', msg: 'Guardando en Drive…' });
    try {
      const teams = {};
      TEAM_IDS.forEach((t) => { if (diffs[t].rows.length) teams[t] = diffs[t].rows; });
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, teams }),
      });
      const out = await res.json();
      if (!out.results) throw new Error(out.error || 'No se pudo guardar.');
      const parts = TEAM_IDS.filter((t) => out.results[t]).map((t) => {
        const r = out.results[t];
        return r.ok ? `${data[t].label}: ${r.updated} líderes actualizados` : `${data[t].label}: error, ${r.error}`;
      });
      if (!out.ok) throw new Error(parts.join('. '));
      if (parsed.kind === 'lista') {
        // Solo se envían GRUPO, ALUMNO y CURSO (sin DNI, celular ni correo).
        const rows = parsed.rows.map(({ grupo, alumno, curso }) => ({ grupo, alumno, curso }));
        const pr = await fetch('/api/detalle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-upload-key': key },
          body: JSON.stringify({ period: parsed.period, fileName: file?.name, rows }),
        });
        const po = await pr.json().catch(() => ({}));
        parts.push(po.ok ? `Detalle Inscritos: ${po.count} matriculados` : `el detalle no se guardó (${po.error || pr.status})`);
      }
      setSaved(true);
      setStatus({ type: 'ok', msg: `Guardado en Drive. ${parts.join('. ')}. Ahora presiona Actualizar dashboard.` });
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
  }

  async function refreshDashboard() {
    setStatus({ type: 'busy', msg: 'Actualizando dashboard con los datos de Drive…' });
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo actualizar el dashboard.');
      router.refresh();
      setParsed(null);
      setChoices({});
      setFile(null);
      setSaved(false);
      setStatus({ type: 'ok', msg: 'Dashboard actualizado. Revisa las pestañas Equipo Principal y Equipo Next.' });
    } catch (e) {
      setStatus({ type: 'error', msg: e.message });
    }
  }

  return (
    <div className="upload">
      <section className="upload-step">
        <h2>1. Sube el reporte en Excel o PDF</h2>
        <div
          className={`drop ${dragging ? 'is-drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        >
          <p><strong>Arrastra el archivo aquí</strong> o</p>
          <button className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>Elegir archivo</button>
          <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv,.pdf"
            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }} />
          <p className="drop-help">
            Sube la &quot;Lista de Personas Matriculadas a Escuela&quot; (PDF o Excel). Un solo archivo actualiza
            los dos equipos: Principal (C18 y C28) y Next (C18J y C28J). Solo se actualizan LIDER, DISC y TOTAL.
          </p>
          {file && <p className="drop-file">{file.name}</p>}
        </div>
      </section>

      {diffs && (
        <section className="upload-step">
          <h2>2. Revisa los cambios</h2>
          {parsed.sheets?.length > 0 && <p className="muted">Hojas leídas: {parsed.sheets.join(', ')}.</p>}
          {roster && (
            <RosterReview
              parsed={parsed}
              assigned={assigned}
              choices={choices}
              setChoice={(i, v) => { setChoices((c) => ({ ...c, [i]: v })); setSaved(false); }}
              leaders={leaders}
              counted={roster.counted}
            />
          )}
          {roster && TEAM_IDS.some((t) => parsed.period && data[t]?.periodCurr && data[t].periodCurr !== parsed.period) && (
            <p className="warn">
              La lista es del periodo {parsed.period}. {TEAM_IDS.filter((t) => data[t]?.periodCurr && data[t].periodCurr !== parsed.period)
                .map((t) => `${data[t].label} muestra ${data[t].periodCurr}`).join('; ')}. Los conteos se guardarán igual en LIDER, DISC y TOTAL.
            </p>
          )}
          {roster && <h3 className="sub-h">Resultado por líder</h3>}
          {totalRows === 0 && <p className="warn">El archivo no tiene códigos de líderes de ningún equipo.</p>}
          <div className="reviews">
            {TEAM_IDS.map((t) => <TeamReview key={t} team={t} label={data[t].label} d={diffs[t]} />)}
          </div>
        </section>
      )}

      <section className="upload-step">
        <h2>{diffs ? '3' : '2'}. Guarda y actualiza</h2>
        <div className="save-row">
          {uploadKeyRequired && diffs && !saved && (
            <label className="key">
              Clave de carga
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
            </label>
          )}
          <button
            className="btn-primary"
            onClick={saveToDrive}
            disabled={busy || !diffs || saved || (!totalChanges && parsed?.kind !== 'lista') || (uploadKeyRequired && !key)}
          >
            {saved ? 'Guardado en Drive ✓' : 'Guardar en Drive'}
          </button>
          <button className={saved ? 'btn-primary btn-refresh' : 'btn-ghost'} onClick={refreshDashboard} disabled={busy}>
            Actualizar dashboard
          </button>
        </div>
        <p className="muted step-help">
          {diffs && !totalChanges && !saved && parsed?.kind !== 'lista'
            ? 'No hay cambios que guardar.'
            : 'Primero guarda en Drive. Luego presiona Actualizar dashboard para ver los nuevos datos.'}
        </p>
      </section>

      {status.type !== 'idle' && (
        <p className={`status status-${status.type}`} role="status">{status.msg}</p>
      )}
    </div>
  );
}
