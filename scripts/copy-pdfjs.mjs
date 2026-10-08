// Copia el lector de PDF a /public para no depender de un CDN.
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public/pdfjs', { recursive: true });
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) {
  copyFileSync(`node_modules/pdfjs-dist/build/${f}`, `public/pdfjs/${f}`);
}
console.log('pdf.js copiado a public/pdfjs');
