import { NextResponse } from 'next/server';
import { latestDetalle, saveDetalle, sanitize } from '@/lib/detalle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const need = process.env.DETALLE_KEY;
  if (need && req.headers.get('x-key') !== need) {
    return NextResponse.json({ ok: false, error: 'Clave incorrecta.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, detalle: await latestDetalle() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Recibe solo GRUPO, ALUMNO y CURSO; cualquier otro dato se descarta.
export async function POST(req) {
  if (process.env.UPLOAD_KEY && req.headers.get('x-upload-key') !== process.env.UPLOAD_KEY) {
    return NextResponse.json({ ok: false, error: 'La clave de carga no es correcta.' }, { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Solicitud inválida.' }, { status: 400 }); }
  const det = sanitize(body);
  if (!det.rows.length) return NextResponse.json({ ok: false, error: 'No hay matriculados.' }, { status: 400 });
  try {
    await saveDetalle(det);
    return NextResponse.json({ ok: true, count: det.rows.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
