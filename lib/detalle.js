import 'server-only';
import { put, list, del, get } from '@vercel/blob';

// "Detalle Inscritos": solo GRUPO, ALUMNO y CURSO de la última lista subida.
// Se guarda como JSON en Vercel Blob (no en Drive). No se guarda el PDF ni DNI, celulares o correos.
const PREFIX = 'detalle/';
const ACCESS = process.env.BLOB_ACCESS === 'private' ? 'private' : 'public';
const LOCAL = process.env.DEV_LOCAL_DIR; // solo desarrollo local

function checkToken() {
  if (!LOCAL && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Falta conectar Vercel Blob al proyecto (Storage > Blob).');
  }
}

const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Quita el código de miembro al final del nombre ("TENA CHUNG, CESAR, 00228578" → "TENA CHUNG, CESAR").
const cleanAlumno = (s) => str(s, 200).replace(/[,\s]*\d{5,}\s*$/, '').replace(/\s*,\s*$/, '');

export function sanitize(body) {
  const rows = (Array.isArray(body?.rows) ? body.rows : []).slice(0, 5000)
    .map((r) => ({ grupo: str(r.grupo, 12).toUpperCase(), alumno: cleanAlumno(r.alumno), curso: str(r.curso, 120) }))
    .filter((r) => r.grupo && r.alumno);
  return {
    period: str(body?.period, 20),
    fileName: str(body?.fileName, 150),
    uploadedAt: new Date().toISOString(),
    rows,
  };
}

export async function saveDetalle(det) {
  const json = JSON.stringify(det);
  if (LOCAL) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(`${LOCAL}/detalle.json`, json);
    return;
  }
  checkToken();
  const old = await list({ prefix: PREFIX });
  await put(`${PREFIX}inscritos.json`, json, {
    access: ACCESS, addRandomSuffix: true, contentType: 'application/json',
  });
  // Borra versiones anteriores (incluye cualquier PDF guardado antes).
  if (old.blobs.length) await del(old.blobs.map((b) => b.url));
}

export async function latestDetalle() {
  if (LOCAL) {
    const fs = await import('node:fs/promises');
    try { return JSON.parse(await fs.readFile(`${LOCAL}/detalle.json`, 'utf8')); } catch { return null; }
  }
  checkToken();
  const { blobs } = await list({ prefix: PREFIX });
  const b = blobs.filter((x) => x.pathname.endsWith('.json'))
    .sort((x, y) => new Date(y.uploadedAt) - new Date(x.uploadedAt))[0];
  if (!b) return null;
  if (ACCESS === 'private') {
    const r = await get(b.pathname, { access: 'private' });
    return r ? JSON.parse(await new Response(r.stream).text()) : null;
  }
  const r = await fetch(b.url, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}
