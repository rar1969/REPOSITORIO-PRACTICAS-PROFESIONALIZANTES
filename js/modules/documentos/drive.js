/**
 * modules/documentos/drive — reconoce enlaces de Google Drive y Google Docs.
 *
 * Un documento del repositorio puede vivir en el Drive de la DETyFP: el portal
 * guarda la ficha con el enlace y quien lo consulta lo abre en Drive. Así no se
 * duplica el archivo y, si se actualiza en Drive, el portal muestra siempre la
 * última versión.
 *
 * Funciones puras (sin DOM), probadas en pruebas/documentos-drive.mjs.
 */

const TIPOS_DOCS = {
  document: 'Google Docs',
  spreadsheets: 'Google Sheets',
  presentation: 'Google Slides',
  forms: 'Formulario de Google'
};

/**
 * Normaliza un enlace de Drive o Docs. Devuelve { url, tipo, id } o lanza un
 * error con el motivo, para mostrarlo tal cual a la persona.
 */
export function leerEnlaceDrive(texto) {
  const crudo = String(texto ?? '').trim();
  if (!crudo) throw new Error('Pegá el enlace de Google Drive.');
  let enlace;
  try {
    enlace = new URL(crudo);
  } catch {
    throw new Error('Eso no parece un enlace. Copialo desde Drive con «Compartir» → «Copiar enlace».');
  }
  const host = enlace.hostname.replace(/^www\./, '');
  const id = (patron, fuente = enlace.pathname) => fuente.match(patron)?.[1];

  if (host === 'docs.google.com') {
    const [, clase, , docId] = enlace.pathname.split('/');
    if (TIPOS_DOCS[clase] && docId) {
      // El formulario publicado usa /forms/d/e/<id>/viewform: se respeta tal cual.
      if (clase === 'forms') return { url: `${enlace.origin}${enlace.pathname}`, tipo: TIPOS_DOCS.forms, id: docId };
      return { url: `https://docs.google.com/${clase}/d/${docId}/edit?usp=sharing`, tipo: TIPOS_DOCS[clase], id: docId };
    }
  }

  if (host === 'drive.google.com') {
    const archivo = id(/\/file\/d\/([\w-]{10,})/) ?? enlace.searchParams.get('id');
    if (archivo && /^[\w-]{10,}$/.test(archivo)) {
      return { url: `https://drive.google.com/file/d/${archivo}/view?usp=sharing`, tipo: 'Archivo de Drive', id: archivo };
    }
    const carpeta = id(/\/folders\/([\w-]{10,})/);
    if (carpeta) {
      return { url: `https://drive.google.com/drive/folders/${carpeta}?usp=sharing`, tipo: 'Carpeta de Drive', id: carpeta };
    }
  }

  throw new Error('El enlace no es de Google Drive ni de Google Docs. Copialo desde Drive con «Compartir» → «Copiar enlace».');
}
