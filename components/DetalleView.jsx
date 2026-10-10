'use client';
import { useEffect, useMemo, useState } from 'react';
import { fecha } from './format';

const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export default function DetalleView({ keyRequired, savedKey, onKey }) {
  const [det, setDet] = useState(undefined);
  const [error, setError] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [q, setQ] = useState('');
  const [grupo, setGrupo] = useState('');
  const [curso, setCurso] = useState('');
  const needKey = keyRequired && !savedKey;

  useEffect(() => {
    if (needKey) return;
    let alive = true;
    fetch('/api/detalle', { headers: { 'x-key': savedKey || '' }, cache: 'no-store' })
      .then(async (r) => {
        const o = await r.json();
        if (!alive) return;
        if (r.status === 401) { onKey(''); setError('Clave incorrecta.'); return; }
        if (!o.ok) throw new Error(o.error);
        setDet(o.detalle);
        setError('');
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [savedKey, needKey, onKey]);

  const all = det?.rows || [];
  const grupos = useMemo(() => [...new Set(all.map((r) => r.grupo))].sort(), [all]);
  const cursos = useMemo(() => [...new Set(all.map((r) => r.curso).filter(Boolean))].sort(), [all]);
  const rows = useMemo(() => {
    const f = fold(q.trim());
    return all.filter((r) => (!grupo || r.grupo === grupo) && (!curso || r.curso === curso)
      && (!f || fold(`${r.alumno} ${r.grupo} ${r.curso}`).includes(f)));
  }, [all, q, grupo, curso]);

  if (needKey) {
    return (
      <div className="upload-step key-gate">
        <h2>Detalle Inscritos</h2>
        {error && <p className="status status-error">{error}</p>}
        <div className="save-row">
          <label className="key">
            Clave
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && keyInput && onKey(keyInput)} autoComplete="off" />
          </label>
          <button className="btn-primary" onClick={() => onKey(keyInput)} disabled={!keyInput}>Ver detalle</button>
        </div>
      </div>
    );
  }
  if (error) return <div className="notice notice-error"><h2>No se pudo cargar el detalle</h2><p>{error}</p></div>;
  if (det === undefined) return <p className="status status-busy">Cargando detalle…</p>;
  if (!det || !all.length) {
    return (
      <div className="notice">
        <h2>Aún no hay detalle de inscritos</h2>
        <p>Sube la &quot;Lista de Personas Matriculadas a Escuela&quot; en la pestaña Subir archivo y presiona Guardar en Drive.</p>
      </div>
    );
  }

  return (
    <div className="detalle">
      <section className="det-head">
        <div>
          <h2>Lista de matriculados{det.period ? ` ${det.period}` : ''}</h2>
          <p className="muted">Último archivo: {det.fileName || 'sin nombre'}, subido el {fecha(det.uploadedAt)}</p>
        </div>
        <dl className="det-stats">
          <div><dt>Matriculados</dt><dd>{all.length}</dd></div>
          <div><dt>Grupos</dt><dd>{grupos.length}</dd></div>
          <div><dt>Cursos</dt><dd>{cursos.length}</dd></div>
        </dl>
      </section>

      <section className="sheet">
        <div className="det-filters">
          <input type="search" placeholder="Buscar por alumno, grupo o curso" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">Todos los grupos</option>
            {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={curso} onChange={(e) => setCurso(e.target.value)}>
            <option value="">Todos los cursos</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="muted">{rows.length} de {all.length}</span>
        </div>
        <div className="sheet-scroll det-scroll">
          <table className="det-table">
            <thead><tr><th>GRUPO</th><th>ALUMNO</th><th>CURSO</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.grupo}-${i}`}>
                  <td className="c-cod">{r.grupo}</td>
                  <td className="c-name">{r.alumno}</td>
                  <td className="c-curso">{r.curso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
