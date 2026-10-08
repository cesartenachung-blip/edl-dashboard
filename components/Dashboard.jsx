'use client';
import { useState } from 'react';
import TeamView from './TeamView';
import UploadPanel from './UploadPanel';
import { fecha } from './format';

const TABS = [
  { id: 'principal', label: 'Equipo Principal' },
  { id: 'next', label: 'Equipo Next' },
  { id: 'upload', label: 'Subir archivo' },
];

export default function Dashboard({ principal, next, uploadKeyRequired }) {
  const [tab, setTab] = useState('principal');
  const data = { principal, next };
  const current = data[tab];

  return (
    <div className="page">
      <header className="masthead">
        <img className="masthead-logo" src="/logo.png" alt="" />
        <div className="masthead-text">
          <h1>Escuela de Líderes</h1>
          <p className="masthead-sub">
            <span>Sede Agua Viva Surco</span>
            <span>Red: García Montoya</span>
          </p>
        </div>
        {current && !current.error && (
          <p className="masthead-meta">
            Datos de Drive al {fecha(current.fetchedAt)}
            <br />
            Archivo modificado {fecha(current.modifiedTime)}
          </p>
        )}
      </header>

      <nav className="tabs" role="tablist" aria-label="Secciones">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'is-active' : ''} ${t.id === 'upload' ? 'tab-upload' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'upload' ? (
          <UploadPanel data={data} uploadKeyRequired={uploadKeyRequired} />
        ) : (
          <TeamView key={tab} data={current} />
        )}
      </main>
    </div>
  );
}
