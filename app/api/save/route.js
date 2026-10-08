import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { TEAMS } from '@/lib/teams';
import { downloadFile, uploadFile } from '@/lib/drive';
import { pickSheet, applyRecords } from '@/lib/sheet';
import { num, norm, teamGender } from '@/lib/parse';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fail = (status, error) => NextResponse.json({ ok: false, error }, { status });

async function saveTeam(team, records) {
  const cfg = TEAMS[team];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await downloadFile(cfg.fileId));
  const ws = pickSheet(wb, cfg.sheet);
  const res = applyRecords(ws, records, team);
  wb.calcProperties.fullCalcOnLoad = true;
  const meta = await uploadFile(cfg.fileId, Buffer.from(await wb.xlsx.writeBuffer()));
  return { ...res, modifiedTime: meta.modifiedTime };
}

// Guarda en los Excel de Drive (Principal y/o Next). No refresca el dashboard: eso lo hace /api/refresh.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail(400, 'Solicitud inválida.'); }
  const { key, teams } = body || {};
  if (process.env.UPLOAD_KEY && key !== process.env.UPLOAD_KEY) return fail(401, 'La clave de carga no es correcta.');
  if (!teams || typeof teams !== 'object') return fail(400, 'No hay registros para guardar.');

  const jobs = {};
  for (const team of Object.keys(TEAMS)) {
    const list = Array.isArray(teams[team]) ? teams[team].slice(0, 500) : [];
    const clean = list
      .map((r) => ({ cod: norm(r.cod), lider: num(r.lider), disc: num(r.disc), total: num(r.total) }))
      .filter((r) => teamGender(team, r.cod));
    if (clean.length) jobs[team] = clean;
  }
  if (!Object.keys(jobs).length) return fail(400, 'El archivo no tiene códigos de líderes válidos.');

  const results = {};
  let anyError = false;
  for (const [team, records] of Object.entries(jobs)) {
    try {
      results[team] = { ok: true, ...(await saveTeam(team, records)) };
    } catch (e) {
      anyError = true;
      results[team] = { ok: false, error: e.message };
    }
  }
  return NextResponse.json({ ok: !anyError, results }, { status: anyError ? 207 : 200 });
}
