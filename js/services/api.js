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

/**
 * `ocultarEjemplos: true` en PORTAL_CONFIG saca de toda lectura los registros
 * marcados `ejemplo: true`. Se filtra acá y no en cada módulo, así vale igual
 * para cualquier adaptador.
 */
const OCULTAR_EJEMPLOS = Boolean(config.ocultarEjemplos);
const esEjemplo = item => Boolean(item && typeof item === 'object' && item.ejemplo);

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
    const a = await adaptador();
    if (!OCULTAR_EJEMPLOS) return a.listar(coleccion, opciones);

    // Se pide todo, se filtra y se pagina después, para que el total sea real.
    const { items } = await a.listar(coleccion, { ...opciones, pagina: 1, porPagina: 0 });
    const reales = items.filter(i => !esEjemplo(i));
    const porPagina = opciones.porPagina ?? 20;
    const pagina = opciones.pagina ?? 1;
    return {
      items: porPagina === 0 ? reales : reales.slice((pagina - 1) * porPagina, pagina * porPagina),
      total: reales.length, pagina, porPagina
    };
  },

  /** ¿Se están ocultando los registros de ejemplo? */
  get ocultaEjemplos() {
    return OCULTAR_EJEMPLOS;
  },

  /** Devuelve una entidad por su identificador, o null si no existe. */
  async obtener(coleccion, id) {
    const item = await (await adaptador()).obtener(coleccion, id);
    return OCULTAR_EJEMPLOS && esEjemplo(item) ? null : item;
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
