import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

// Botón "Actualizar dashboard": vuelve a leer los Excel de Drive en la siguiente carga de página.
export async function POST() {
  revalidateTag('edl-principal');
  revalidateTag('edl-next');
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
