/**
 * services/api — único punto de lectura y escritura de datos del portal.
 *
 * Ningún módulo habla con el origen de datos directamente: todos pasan por acá.
 * Detrás hay un adaptador intercambiable por configuración (SDD §7), de modo
 * que pasar de archivos JSON a una base de datos gestionada sea un cambio de
 * una línea en PORTAL_CONFIG y no una reescritura de los módulos.
 *
 * Contrato estable:
 *   api.listar(coleccion, { filtros, orden, pagina, porPagina }) → { items, total, ... }
 *   api.obtener(coleccion, id)                                   → entidad
 *   api.crear(coleccion, datos)                                  → entidad creada
 *   api.actualizar(coleccion, id, cambios)                       → entidad
 *   api.eliminar(coleccion, id)                                  → void
 *   api.subirArchivo(bucket, archivo)                            → { url, tamanio }
 */

const ADAPTADORES = {
  estatico: () => import('./adaptadores/estatico.js'),
  supabase: () => import('./adaptadores/supabase.js'),   // fase 2
  sheets:   () => import('./adaptadores/sheets.js')      // alternativa de transición
};

const config = (typeof window !== 'undefined' && window.PORTAL_CONFIG) || {};
const NOMBRE_ADAPTADOR = config.adaptador || 'estatico';

let adaptadorPrometido = null;

function adaptador() {
  if (!adaptadorPrometido) {
    const cargar = ADAPTADORES[NOMBRE_ADAPTADOR];
    if (!cargar) {
      throw new Error(
        `Adaptador desconocido: "${NOMBRE_ADAPTADOR}". ` +
        `Válidos: ${Object.keys(ADAPTADORES).join(', ')}`
      );
    }
    adaptadorPrometido = cargar().then(m => m.crearAdaptador(config));
  }
  return adaptadorPrometido;
}

export const api = {
  /** Nombre del adaptador activo; útil para mostrarlo en el pie de página. */
  get origen() {
    return NOMBRE_ADAPTADOR;
  },

  /**
   * Lista una colección con filtros, orden y paginado.
   *
   * @param {string} coleccion
   * @param {object} [opciones]
   * @param {object} [opciones.filtros]    { campo: valor | [valores] , q: 'texto libre' }
   * @param {string} [opciones.orden]      'campo' ascendente, '-campo' descendente
   * @param {number} [opciones.pagina=1]
   * @param {number} [opciones.porPagina=20]  0 = sin paginar (devuelve todo)
   * @returns {Promise<{items: Array, total: number, pagina: number, porPagina: number}>}
   */
  async listar(coleccion, opciones = {}) {
    return (await adaptador()).listar(coleccion, opciones);
  },

  /** Devuelve una entidad por su identificador, o null si no existe. */
  async obtener(coleccion, id) {
    return (await adaptador()).obtener(coleccion, id);
  },

  /** Crea una entidad; el adaptador asigna el identificador si no viene. */
  async crear(coleccion, datos) {
    return (await adaptador()).crear(coleccion, datos);
  },

  /** Aplica cambios parciales sobre una entidad existente. */
  async actualizar(coleccion, id, cambios) {
    return (await adaptador()).actualizar(coleccion, id, cambios);
  },

  /** Elimina una entidad. */
  async eliminar(coleccion, id) {
    return (await adaptador()).eliminar(coleccion, id);
  },

  /** Sube un archivo y devuelve su ubicación. */
  async subirArchivo(bucket, archivo) {
    return (await adaptador()).subirArchivo(bucket, archivo);
  },

  /**
   * Descarta las escrituras locales y vuelve a los datos de origen.
   * Sin argumento, restablece todas las colecciones.
   * (Sin efecto en adaptadores con backend real.)
   */
  async restablecer(coleccion) {
    const a = await adaptador();
    return a.restablecer ? a.restablecer(coleccion) : undefined;
  }
};

export default api;
