import { summarize, pct } from '@/lib/parse';

function Gauge({ kind, title, s, prev, curr }) {
  const w = Math.min(100, Math.round(s.pct * 100));
  return (
    <div className={`gauge gauge-${kind}`}>
      <div className="gauge-head">
        <h2>{title}</h2>
        <span className="gauge-pct">{pct(s.pct)}</span>
      </div>
      <p className="gauge-num">
        <strong>{s.total}</strong> inscritos en {curr} <span>de {s.logro} logrados en {prev}</span>
      </p>
      <div className="gauge-track" aria-hidden="true"><div className="gauge-fill" style={{ width: `${w}%` }} /></div>
      <dl className="gauge-split">
        <div><dt>Líder</dt><dd>{s.lider}</dd></div>
        <div><dt>Disc</dt><dd>{s.disc}</dd></div>
        <div><dt>Líderes sin inscritos</dt><dd>{s.sinInscritos} de {s.lideres}</dd></div>
      </dl>
    </div>
  );
}

function LeaderTable({ kind, title, rows, s, prev, curr }) {
  return (
    <section className={`sheet sheet-${kind}`}>
      <div className="sheet-scroll">
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="c-cod">COD</th>
              <th rowSpan={2} className="c-name">{title}</th>
              <th className="c-prev">{prev}</th>
              <th colSpan={3} className="c-curr">{curr}</th>
              <th rowSpan={2} className="c-adv">AVANCE</th>
            </tr>
            <tr>
              <th className="c-prev">LOGRO</th>
              <th className="c-curr">LIDER</th>
              <th className="c-curr">DISC</th>
              <th className="c-curr">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.logro ? r.total / r.logro : null;
              return (
                <tr key={r.cod} className={r.total ? '' : 'is-zero'}>
                  <td className="c-cod">{r.cod}</td>
                  <td className="c-name">{r.nombre}</td>
                  <td className="c-prev n">{r.logro}</td>
                  <td className="n">{r.lider || ''}</td>
                  <td className="n">{r.disc || ''}</td>
                  <td className="n c-total">{r.total}</td>
                  <td className="c-adv">
                    {p == null ? <span className="adv-na">sin logro</span> : (
                      <span className="adv">
                        <span className="adv-bar"><span style={{ width: `${Math.min(100, p * 100)}%` }} /></span>
                        <span className="adv-num">{pct(p)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="foot-label">Total</td>
              <td className="n foot-prev">{s.logro}</td>
              <td className="n">{s.lider}</td>
              <td className="n">{s.disc}</td>
              <td className="n foot-total">{s.total}</td>
              <td className="c-adv foot-pct">% Inscritos {pct(s.pct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function TeamView({ data }) {
  if (!data || data.error) {
    return (
      <div className="notice notice-error">
        <h2>No se pudieron leer los datos de {data?.label}</h2>
        <p>{data?.error}</p>
        <p>Revisa que el archivo esté compartido como Editor con la cuenta de servicio y que las variables de entorno estén cargadas en Vercel.</p>
      </div>
    );
  }
  const h = summarize(data.hombres);
  const m = summarize(data.mujeres);
  const t = summarize([...data.hombres, ...data.mujeres]);
  const isNext = data.team === 'next';
  const { periodPrev: prev, periodCurr: curr } = data;

  return (
    <div className="team">
      <section className="gauges">
        <Gauge kind="t" title={`${data.label} en total`} s={t} prev={prev} curr={curr} />
        <Gauge kind="h" title="Hombres" s={h} prev={prev} curr={curr} />
        <Gauge kind="m" title="Mujeres" s={m} prev={prev} curr={curr} />
      </section>
      <div className="sheets">
        <LeaderTable kind="h" title={`${isNext ? 'NEXT ' : ''}HOMBRES`} rows={data.hombres} s={h} prev={prev} curr={curr} />
        <LeaderTable kind="m" title={`${isNext ? 'NEXT ' : ''}MUJERES`} rows={data.mujeres} s={m} prev={prev} curr={curr} />
      </div>
    </div>
  );
}
