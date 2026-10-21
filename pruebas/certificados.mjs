/**
 * Pruebas del generador de certificados, sin navegador.
 *   node pruebas/certificados.mjs
 *
 * Usa las mismas librerías, plantilla y fuentes que el portal (js/vendor y
 * assets/). Los estudiantes son inventados: no hay datos reales en el repo.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const PDFLib = await import('../js/vendor/pdf-lib-1.17.1.esm.min.js');
const fontkit = require('../js/vendor/fontkit-1.1.1.umd.min.js');
const { ARCHIVOS, generarPdf, contenidoDe, enLetras, cursoCorto, mesYAnio, nombreArchivo } =
  await import('../js/modules/certificados/diploma.js');

let fallas = 0;
const ok = (texto, condicion) => {
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${texto}`);
  if (!condicion) fallas++;
};

console.log('\nTextos');
ok('horas en letras', enLetras(10) === 'diez' && enLetras(21) === 'veintiuna' &&
  enLetras(45) === 'cuarenta y cinco' && enLetras(100) === 'cien' && enLetras(120) === 'ciento veinte');
ok('curso abreviado como en el modelo', cursoCorto('6to 1ra') === '6° 1°' && cursoCorto('7mo B') === '7° B' &&
  cursoCorto('7mo') === '7°' && cursoCorto('5to B') === '5° B' && cursoCorto('7mo 2da') === '7° 2°');
ok('mes y año', mesYAnio('2026-08-15') === 'Agosto de 2026');

const base = {
  id: 'CER-0001', codigo: 'ABCDEF1234', horas: 10, curso: '6to 1ra', especialidad: 'Informática',
  apellido: 'Pérez Gómez', nombre: 'Ana Inés', dni: '49000001',
  capacitacion: 'Ciclo de Vida del Software', escuela: 'Escuela Técnica N° 1 Monteros'
};
const c = contenidoDe(base, { fecha: '2026-08-01' });
ok('nombre en mayúsculas con tildes', c.nombre === 'PÉREZ GÓMEZ ANA INÉS');
ok('título de la especialidad', c.especialidad === 'Técnico en Informática Personal y Profesional');
ok('horas y fecha', c.horas === '10 (diez) horas' && c.lugarYFecha === 'San Miguel de Tucumán, Agosto de 2026');
ok('sin DNI no imprime "DNI N.°"', contenidoDe({ ...base, dni: null }).dni === '');
ok('nombre de archivo', nombreArchivo([base]) === 'CER-0001_Perez_Gomez_Ana_Ines.pdf');

console.log('\nPDF');
const recursos = { PDFLib, fontkit };
for (const [clave, ruta] of Object.entries(ARCHIVOS)) recursos[clave] = fs.readFileSync(RAIZ + ruta);

const casos = [
  base,
  { ...base, id: 'CER-0002', dni: null, apellido: 'Contreras', nombre: 'Celeste Abigail de las Mercedes',
    escuela: 'Escuela Técnica N° 1 Ing. Antonio María Correa', curso: '7mo A', especialidad: 'Electromecánica',
    capacitacion: 'De la Escuela Técnica al Mundo Laboral. Experiencias reales en diferentes industrias' },
  { ...base, id: 'CER-0003', especialidad: 'Gestión y Administración de las Organizaciones', horas: 21,
    escuela: 'Escuela Técnica Crucero ARA Gral. Belgrano',
    capacitacion: 'Presentación de la Documentación Técnica de la Obra de Construcción' }
];
const pdf = await generarPdf(casos, recursos, { fecha: '2026-08-01', mostrarCodigo: true });
const leido = await PDFLib.PDFDocument.load(pdf);
ok('una página por certificado', leido.getPageCount() === 3);
const [pagina] = leido.getPages();
ok('tamaño A4 apaisado, como el modelo', Math.round(pagina.getWidth()) === 842 && Math.round(pagina.getHeight()) === 595);

const lote = Array.from({ length: 60 }, (_, i) => ({ ...casos[i % 3], id: `CER-${i}` }));
const grande = await generarPdf(lote, recursos);
ok(`la plantilla se comparte entre páginas (60 diplomas: ${Math.round(grande.length / 1024)} KB)`,
  grande.length < 1.5 * 1024 * 1024);

console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas ? 1 : 0);
