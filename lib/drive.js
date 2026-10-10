import { JWT } from 'google-auth-library';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function credentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const j = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return { email: j.client_email, key: j.private_key };
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Falta configurar GOOGLE_SERVICE_ACCOUNT_JSON en Vercel.');
  return { email, key };
}

let client;
async function token() {
  if (!client) {
    const { email, key } = credentials();
    client = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
  }
  const { token: t } = await client.getAccessToken();
  return t;
}

async function driveFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { ...(init.headers || {}), Authorization: `Bearer ${await token()}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 404) {
      throw new Error('Drive no encuentra el archivo. Compártelo como Editor con el correo de la cuenta de servicio.');
    }
    throw new Error(`Drive respondió ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}

const BASE = 'https://www.googleapis.com/drive/v3/files';

// Solo para desarrollo local: DEV_LOCAL_DIR=./local usa ./local/<fileId>.xlsx en vez de Drive.
const LOCAL = process.env.DEV_LOCAL_DIR;
async function localFs() { return import('node:fs/promises'); }

export async function downloadFile(id) {
  if (LOCAL) {
    const fs = await localFs();
    return fs.readFile(`${LOCAL}/${id}.xlsx`).catch(() => fs.readFile(`${LOCAL}/${id}.pdf`));
  }
  const res = await driveFetch(`${BASE}/${id}?alt=media&supportsAllDrives=true`);
  return Buffer.from(await res.arrayBuffer());
}

export async function getMeta(id) {
  if (LOCAL) {
    const fs = await localFs();
    const f = await fs.stat(`${LOCAL}/${id}.xlsx`).then(() => `${id}.xlsx`).catch(() => `${id}.pdf`);
    const st = await fs.stat(`${LOCAL}/${f}`);
    return { name: f, modifiedTime: st.mtime.toISOString() };
  }
  const res = await driveFetch(`${BASE}/${id}?fields=name,modifiedTime&supportsAllDrives=true`);
  return res.json();
}

export async function uploadFile(id, buffer, mime = XLSX_MIME) {
  if (LOCAL) {
    await (await localFs()).writeFile(`${LOCAL}/${id}${mime === XLSX_MIME ? '.xlsx' : '.pdf'}`, buffer);
    return { name: `${id}.xlsx`, modifiedTime: new Date().toISOString() };
  }
  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true&fields=name,modifiedTime`,
    { method: 'PATCH', headers: { 'Content-Type': mime }, body: buffer },
  );
  return res.json();
}
