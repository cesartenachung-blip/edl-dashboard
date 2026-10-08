'use client';
import { extractFromItems, explodeItems } from './parse';

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

export async function parsePdf(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const result = { periodPrev: '', periodCurr: '', hombres: [], mujeres: [] };
  const seen = new Set();
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    extractFromItems(explodeItems(tc.items), result, seen);
  }
  if (!result.hombres.length && !result.mujeres.length) {
    throw new Error('El PDF no tiene una tabla legible (COD, LOGRO, LIDER, DISC, TOTAL). Si es un escaneo, sube el Excel.');
  }
  return result;
}
