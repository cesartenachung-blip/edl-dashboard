'use client';
import { extractFromItems, explodeItems } from './parse';
import { rosterFromItems } from './roster';

const PDFJS = '/pdfjs/pdf.min.js';

function loadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.replace('pdf.min.js', 'pdf.worker.min.js');
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('No se pudo cargar el lector de PDF.'));
    document.head.appendChild(s);
  });
}

// Reconoce dos formatos: la lista de matriculados (GRUPO / ALUMNO) o la tabla de avance (LOGRO / LIDER / DISC).
export async function parsePdf(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    pages.push(explodeItems(tc.items));
  }
  const all = pages.flat();
  const isRoster = all.some((i) => /ALUMNO/i.test(i.s)) && all.some((i) => /GRUPO/i.test(i.s));

  if (isRoster) {
    const out = { kind: 'lista', period: '', rows: [] };
    pages.forEach((items) => rosterFromItems(items, out));
    if (!out.rows.length) throw new Error('No encontré matriculados en el PDF. Si es un escaneo, sube el Excel.');
    return out;
  }

  const result = { kind: 'tabla', periodPrev: '', periodCurr: '', hombres: [], mujeres: [] };
  const seen = new Set();
  pages.forEach((items) => extractFromItems(items, result, seen));
  if (!result.hombres.length && !result.mujeres.length) {
    throw new Error('El PDF no tiene un formato reconocido (lista de matriculados o tabla de avance). Si es un escaneo, sube el Excel.');
  }
  return result;
}
