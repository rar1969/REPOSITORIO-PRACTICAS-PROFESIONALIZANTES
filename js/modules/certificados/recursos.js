/**
 * modules/certificados/recursos — carga, en el navegador, lo que necesita
 * diploma.js: pdf-lib, fontkit, la plantilla y las fuentes.
 *
 * Todo se sirve desde el propio portal (js/vendor y assets/), sin CDN: el
 * generador funciona aunque un servicio externo esté caído o bloqueado en la
 * red de una escuela. Se descarga recién la primera vez que alguien genera un
 * certificado (unos 2 MB) y queda en memoria para los siguientes.
 */

import { ARCHIVOS } from './diploma.js';

const RAIZ = new URL('../../../', import.meta.url);
const PDF_LIB = new URL('../../vendor/pdf-lib-1.17.1.esm.min.js', import.meta.url);
const FONTKIT = new URL('../../vendor/fontkit-1.1.1.umd.min.js', import.meta.url);

let prometidos = null;

/** fontkit se publica como UMD: se carga como script y deja `window.fontkit`. */
function cargarFontkit() {
  if (window.fontkit) return Promise.resolve(window.fontkit);
  return new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = FONTKIT.href;
    script.onload = () => (window.fontkit ? resolver(window.fontkit)
      : rechazar(new Error('fontkit no quedó disponible')));
    script.onerror = () => rechazar(new Error('No se pudo cargar fontkit'));
    document.head.append(script);
  });
}

async function bytes(ruta) {
  const respuesta = await fetch(new URL(ruta, RAIZ));
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${respuesta.status})`);
  return new Uint8Array(await respuesta.arrayBuffer());
}

export function cargarRecursos() {
  if (prometidos) return prometidos;
  prometidos = (async () => {
    const [PDFLib, fontkit, ...archivos] = await Promise.all([
      import(PDF_LIB.href),
      cargarFontkit(),
      ...Object.values(ARCHIVOS).map(bytes)
    ]);
    const recursos = { PDFLib, fontkit };
    Object.keys(ARCHIVOS).forEach((clave, i) => { recursos[clave] = archivos[i]; });
    return recursos;
  })().catch(error => {
    prometidos = null;   // permite reintentar
    throw error;
  });
  return prometidos;
}

/** Ofrece un PDF para guardar, sin abrir ventanas nuevas. */
export function descargar(contenido, nombre) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/pdf' }));
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
