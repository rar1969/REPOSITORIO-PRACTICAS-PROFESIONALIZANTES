/**
 * Enlaces de Google Drive en el repositorio documental.
 *   node pruebas/documentos-drive.mjs
 */

import { leerEnlaceDrive } from '../js/modules/documentos/drive.js';

let fallas = 0;
const ok = (texto, condicion) => {
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${texto}`);
  if (!condicion) fallas++;
};
const falla = texto => { try { leerEnlaceDrive(texto); return null; } catch (e) { return e.message; } };
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123';

console.log('\nEnlaces que se aceptan');
let r = leerEnlaceDrive(`https://drive.google.com/file/d/${ID}/view?usp=drive_link`);
ok('archivo de Drive («Copiar enlace»)', r.tipo === 'Archivo de Drive' && r.url === `https://drive.google.com/file/d/${ID}/view?usp=sharing`);
r = leerEnlaceDrive(`https://drive.google.com/open?id=${ID}`);
ok('formato viejo «open?id=»', r.id === ID && r.tipo === 'Archivo de Drive');
r = leerEnlaceDrive(`https://drive.google.com/uc?id=${ID}&export=download`);
ok('enlace de descarga directa', r.url.endsWith(`/file/d/${ID}/view?usp=sharing`));
r = leerEnlaceDrive(`https://docs.google.com/document/d/${ID}/edit?tab=t.0`);
ok('documento de Google Docs', r.tipo === 'Google Docs' && r.url === `https://docs.google.com/document/d/${ID}/edit?usp=sharing`);
ok('planilla y presentación',
  leerEnlaceDrive(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`).tipo === 'Google Sheets' &&
  leerEnlaceDrive(`https://docs.google.com/presentation/d/${ID}/edit`).tipo === 'Google Slides');
r = leerEnlaceDrive(`https://drive.google.com/drive/folders/${ID}?usp=sharing`);
ok('carpeta de Drive', r.tipo === 'Carpeta de Drive' && r.id === ID);
ok('con espacios alrededor', leerEnlaceDrive(`  https://drive.google.com/file/d/${ID}/view  `).id === ID);
ok('carpeta dentro de «Mi unidad» con /u/0/', leerEnlaceDrive(`https://drive.google.com/drive/u/0/folders/${ID}`).tipo === 'Carpeta de Drive');

console.log('\nEnlaces que se rechazan, con el motivo');
ok('vacío', /Pegá el enlace/.test(falla('')));
ok('texto que no es un enlace', /no parece un enlace/.test(falla('mi archivo.pdf')));
ok('otro sitio', /no es de Google Drive/.test(falla('https://www.dropbox.com/s/abc/archivo.pdf')));
ok('la página principal de Drive, sin archivo', /no es de Google Drive/.test(falla('https://drive.google.com/drive/my-drive')));

console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas ? 1 : 0);
