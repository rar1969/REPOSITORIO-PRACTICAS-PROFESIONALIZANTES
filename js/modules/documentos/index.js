/**
 * modules/documentos — carga y descarga de archivos del repositorio.
 *
 * Persistente, porque el formulario "Subir documento" se abre desde dos
 * lugares (el repositorio y el panel DETyFP) y la descarga se pide desde los
 * dos también. Quien pide emite `documento:descargar`; este módulo atiende.
 * Un documento puede ser un archivo subido, un enlace a la fuente oficial
 * (`url`), como la Ley 26.058 en el sitio de normativa nacional, o un enlace
 * a un archivo o carpeta de Google Drive: el portal guarda la ficha con el
 * enlace y quien lo consulta lo abre en Drive (siempre la última versión).
 *
 * Arregla una falla que estaba en producción: el formulario de carga no tenía
 * quién lo atendiera desde la limpieza de app.js, así que "Publicar documento"
 * recargaba la página y no guardaba nada.
 *
 * Con el adaptador de Supabase, el archivo se guarda en el almacenamiento de
 * la base y el documento queda con su URL pública, para todos.
 *
 * En modo estático (LÍMITE CONOCIDO): sin almacenamiento de archivos, el archivo
 * subido vive solo en la pestaña donde se cargó. La ficha del documento sí se
 * guarda; el archivo, no. Por eso el registro lleva `archivo_en_sesion: true`
 * y, si alguien lo pide después de recargar, se le dice la verdad en lugar de
 * bajarle un enlace muerto.
 */

import { abrirModal, cerrarModal } from '../../ui/modal.js';
import { leerEnlaceDrive } from './drive.js';

const EXTENSIONES = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'zip', 'odt', 'ods'];
const archivosDeLaSesion = new Map();   // id del documento → { url, nombre }

export default {
  id: 'documentos',
  persistente: true,
  titulo: 'Carga documental',

  montar(_contenedor, ctx) {
    this._ctx = ctx;
    this._desconectar = [];

    const formulario = document.getElementById('form-subir-doc');
    const entrada = document.getElementById('upload-doc-file');
    const zona = formulario?.querySelector('.file-dropzone');
    const leyenda = document.getElementById('file-selected-name');
    const leyendaOriginal = leyenda?.textContent ?? '';

    const mostrarNombre = () => {
      const archivo = entrada?.files?.[0];
      if (leyenda) leyenda.textContent = archivo ? `${archivo.name} · ${tamanio(archivo.size)}` : leyendaOriginal;
    };

    const elegir = () => entrada?.click();
    const conTeclado = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } };
    const arrastrando = e => { e.preventDefault(); zona.classList.add('dragover'); };
    const salio = () => zona.classList.remove('dragover');
    const solto = e => {
      e.preventDefault();
      salio();
      if (e.dataTransfer?.files?.length && entrada) {
        entrada.files = e.dataTransfer.files;
        mostrarNombre();
      }
    };

    if (zona) {
      // La zona era un <div> con `onclick` en línea: sin teclado ni nombre.
      zona.removeAttribute('onclick');
      zona.setAttribute('role', 'button');
      zona.setAttribute('tabindex', '0');
      zona.setAttribute('aria-label', 'Elegir el archivo a subir');
      zona.addEventListener('click', elegir);
      zona.addEventListener('keydown', conTeclado);
      zona.addEventListener('dragover', arrastrando);
      zona.addEventListener('dragleave', salio);
      zona.addEventListener('drop', solto);
      this._desconectar.push(() => {
        zona.removeEventListener('click', elegir);
        zona.removeEventListener('keydown', conTeclado);
        zona.removeEventListener('dragover', arrastrando);
        zona.removeEventListener('dragleave', salio);
        zona.removeEventListener('drop', solto);
      });
    }
    entrada?.addEventListener('change', mostrarNombre);

    // Origen del documento: archivo de la computadora o enlace de Drive.
    const zonaArchivo = document.getElementById('upload-doc-zona-archivo');
    const zonaDrive = document.getElementById('upload-doc-zona-drive');
    const enlace = document.getElementById('upload-doc-url');
    const estadoEnlace = document.getElementById('upload-doc-url-estado');
    const origen = () => formulario?.querySelector('input[name="upload-doc-origen"]:checked')?.value ?? 'archivo';
    const cambiarOrigen = () => {
      const drive = origen() === 'drive';
      if (zonaArchivo) zonaArchivo.hidden = drive;
      if (zonaDrive) zonaDrive.hidden = !drive;
      if (enlace) enlace.required = drive;
      if (drive) enlace?.focus();
    };
    const revisarEnlace = () => {
      if (!estadoEnlace || !enlace) return;
      if (!enlace.value.trim()) { estadoEnlace.textContent = ''; return; }
      try {
        const { tipo } = leerEnlaceDrive(enlace.value);
        estadoEnlace.textContent = `✓ ${tipo} reconocido.`;
        estadoEnlace.dataset.estado = 'ok';
      } catch (error) {
        estadoEnlace.textContent = error.message;
        estadoEnlace.dataset.estado = 'error';
      }
    };
    for (const opcion of formulario?.querySelectorAll('input[name="upload-doc-origen"]') ?? []) {
      opcion.addEventListener('change', cambiarOrigen);
      this._desconectar.push(() => opcion.removeEventListener('change', cambiarOrigen));
    }
    enlace?.addEventListener('input', revisarEnlace);
    this._desconectar.push(() => enlace?.removeEventListener('input', revisarEnlace));

    const enviar = async evento => {
      evento.preventDefault();
      try {
        if (origen() === 'drive') await this._publicarEnlace(enlace?.value);
        else await this._publicar(entrada?.files?.[0]);
        formulario.reset();
        mostrarNombre();
        cambiarOrigen();
        revisarEnlace();
        cerrarModal('subir-doc');
      } catch (error) {
        ctx.emitir('aviso', { texto: error.message, tipo: 'error' });
      }
    };
    formulario?.addEventListener('submit', enviar);

    this._desconectar.push(
      () => entrada?.removeEventListener('change', mostrarNombre),
      () => formulario?.removeEventListener('submit', enviar),
      ctx.escuchar('documento:descargar', id => this._descargar(id)),
      ctx.escuchar('documento:subir', () => abrirModal('subir-doc'))
    );
  },

  desmontar() {
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
  },

  async _publicar(archivo) {
    if (!archivo) throw new Error('Elegí el archivo que querés publicar.');
    const extension = archivo.name.split('.').pop().toLowerCase();
    if (!EXTENSIONES.includes(extension)) {
      throw new Error(`Formato no admitido (.${extension}). Se aceptan: ${EXTENSIONES.join(', ')}.`);
    }

    const { url, efimero } = await this._ctx.api.subirArchivo('documentos', archivo);
    const valor = id => document.getElementById(id)?.value.trim() ?? '';

    const documento = await this._ctx.api.crear('documentos', {
      titulo: valor('upload-doc-title'),
      descripcion: valor('upload-doc-desc'),
      categoria: valor('upload-doc-cat'),
      version: valor('upload-doc-version'),
      tipo_archivo: extension.toUpperCase(),
      tamanio: tamanio(archivo.size),
      fecha: new Date().toISOString().slice(0, 10),
      organismo: 'Dirección de Educación Técnica y Formación Profesional',
      estado: 'Vigente',
      descargas: 0,
      nombre_archivo: archivo.name,
      // Con almacenamiento real (Supabase) el archivo queda en su URL pública;
      // en modo estático solo vive en esta pestaña.
      ...(efimero ? { archivo_en_sesion: true } : { url })
    });
    if (efimero) archivosDeLaSesion.set(documento.id, { url, nombre: archivo.name });

    this._ctx.emitir('documentos:cambiaron', documento);
    this._ctx.emitir('aviso', { texto: `"${documento.titulo}" publicado en el repositorio.`, tipo: 'success' });
    return documento;
  },

  /** Documento que vive en Google Drive: se guarda la ficha con el enlace. */
  async _publicarEnlace(texto) {
    const { url, tipo } = leerEnlaceDrive(texto);
    const valor = id => document.getElementById(id)?.value.trim() ?? '';
    const documento = await this._ctx.api.crear('documentos', {
      titulo: valor('upload-doc-title'),
      descripcion: valor('upload-doc-desc'),
      categoria: valor('upload-doc-cat'),
      version: valor('upload-doc-version'),
      tipo_archivo: tipo,
      tamanio: 'Google Drive',
      fecha: new Date().toISOString().slice(0, 10),
      organismo: 'Dirección de Educación Técnica y Formación Profesional',
      estado: 'Vigente',
      descargas: 0,
      url
    });
    this._ctx.emitir('documentos:cambiaron', documento);
    this._ctx.emitir('aviso', {
      texto: `"${documento.titulo}" publicado con su enlace de Drive. Revisá que esté compartido como «Cualquier persona con el enlace».`,
      tipo: 'success'
    });
    return documento;
  },

  async _descargar(id) {
    const doc = await this._ctx.api.obtener('documentos', id);
    if (!doc) return;

    const enSesion = archivosDeLaSesion.get(id);
    if (enSesion) {
      bajar(enSesion.url, enSesion.nombre);
      this._ctx.emitir('aviso', { texto: `Descargando ${doc.titulo}`, tipo: 'success' });
      return;
    }
    if (doc.archivo_en_sesion) {
      this._ctx.emitir('aviso', {
        texto: 'El archivo se cargó en otra sesión y todavía no hay almacenamiento permanente (llega en la fase 2). Pedíselo a la DETyFP.',
        tipo: 'error'
      });
      return;
    }
    if (doc.url) {
      // Un enlace externo (normativa oficial) se abre en otra pestaña:
      // copiarlo al portal duplicaría una fuente que ya es pública.
      window.open(doc.url, '_blank', 'noopener');
      return;
    }
    // Sin archivo detrás. El prototipo fabricaba un .txt con membrete oficial,
    // que podía pasar por el documento verdadero; ahora se dice lo que hay.
    this._ctx.emitir('aviso', {
      texto: `"${doc.titulo}" todavía no está cargado en el portal. Consultalo con la DETyFP.`,
      tipo: 'info'
    });
  }
};

function bajar(url, nombre) {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
}

function tamanio(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
