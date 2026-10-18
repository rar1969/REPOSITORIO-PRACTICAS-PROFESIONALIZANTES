/**
 * adaptadorEstatico — lee de los JSON de /data y escribe en localStorage.
 *
 * Los archivos de /data son inmutables: nunca se tocan. Las altas, cambios y
 * bajas se guardan aparte, en una "capa de cambios" por colección, que se
 * superpone a los datos base al leer. Eso tiene tres consecuencias buenas:
 *
 *   1. Publicar una versión nueva de los JSON no borra lo que alguien cargó.
 *   2. api.restablecer() vuelve al estado original sin recargar nada.
 *   3. Migrar a base de datos es exportar la capa de cambios, no rescatar
 *      datos mezclados con las semillas.
 *
 * Alcance: la capa de cambios vive en el navegador de quien la cargó. Sirve
 * para demostraciones, aula y pruebas sin conexión (SDD §7), no para operar.
 */

import { esquemaDe, COLECCIONES } from '../../data/esquemas.js';

const BASE_DATOS = new URL('../../../data/', import.meta.url);
const PREFIJO_ALMACEN = 'pp.v1.';

const cacheBase = new Map();      // coleccion → datos del JSON
const cacheCambios = new Map();   // coleccion → { creados, modificados, eliminados }
let avisoSensibles = false;

/* ----------------------------------------------------------------- lectura */

async function leerBase(coleccion) {
  if (cacheBase.has(coleccion)) return cacheBase.get(coleccion);

  const esquema = esquemaDe(coleccion);
  const url = new URL(esquema.archivo, BASE_DATOS);
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer ${esquema.archivo} (HTTP ${respuesta.status})`);
  }
  const datos = await respuesta.json();

  if (esquema.sensible && !avisoSensibles) {
    avisoSensibles = true;
    console.warn(
      `[api] La colección "${coleccion}" contiene datos personales y hoy se ` +
      `sirve como archivo público. Debe pasar a acceso con sesión en la fase 2.`
    );
  }

  cacheBase.set(coleccion, datos);
  return datos;
}

function leerCambios(coleccion) {
  if (cacheCambios.has(coleccion)) return cacheCambios.get(coleccion);

  let cambios = { creados: [], modificados: {}, eliminados: [] };
  try {
    const crudo = localStorage.getItem(PREFIJO_ALMACEN + coleccion);
    if (crudo) cambios = { ...cambios, ...JSON.parse(crudo) };
  } catch (error) {
    console.warn(`[api] Capa de cambios ilegible en "${coleccion}"; se ignora.`, error);
  }

  cacheCambios.set(coleccion, cambios);
  return cambios;
}

function guardarCambios(coleccion, cambios) {
  cacheCambios.set(coleccion, cambios);
  try {
    localStorage.setItem(PREFIJO_ALMACEN + coleccion, JSON.stringify(cambios));
  } catch (error) {
    console.error(
      `[api] No se pudo persistir "${coleccion}" (¿almacenamiento lleno o ` +
      `navegación privada?). El cambio vive solo en memoria.`, error
    );
  }
}

/**
 * Datos base + capa de cambios, ya resueltos.
 *
 * Devuelve siempre copias: quien recibe los datos puede mutarlos sin
 * corromper la caché de los archivos de origen, que es lo que permite que
 * api.restablecer() realmente vuelva al estado inicial.
 */
async function materializar(coleccion) {
  return structuredClone(await combinar(coleccion));
}

async function combinar(coleccion) {
  const esquema = esquemaDe(coleccion);
  const base = await leerBase(coleccion);

  if (esquema.tipo === 'objeto') {
    return { ...base, ...(leerCambios(coleccion).modificados || {}) };
  }

  const cambios = leerCambios(coleccion);

  if (esquema.tipo === 'lista') {
    const eliminados = new Set(cambios.eliminados);
    return [...base, ...cambios.creados].filter(v => !eliminados.has(v));
  }

  const clave = esquema.clave;
  const eliminados = new Set(cambios.eliminados);
  return [...base, ...cambios.creados]
    .filter(item => !eliminados.has(item[clave]))
    .map(item => {
      const parche = cambios.modificados[item[clave]];
      return parche ? { ...item, ...parche } : item;
    });
}

/* --------------------------------------------------------------- filtrado */

function coincideCampo(valorItem, valorFiltro) {
  if (Array.isArray(valorFiltro)) {
    return valorFiltro.some(v => coincideCampo(valorItem, v));   // IN
  }
  if (Array.isArray(valorItem)) {
    return valorItem.includes(valorFiltro);                      // contiene
  }
  if (typeof valorItem === 'string' && typeof valorFiltro === 'string') {
    return normalizar(valorItem) === normalizar(valorFiltro);
  }
  return valorItem === valorFiltro;
}

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');   // ignora tildes: "Famailla" encuentra "Famaillá"
}

function aplicarFiltros(items, filtros, esquema) {
  const entradas = Object.entries(filtros || {}).filter(
    ([, valor]) => valor !== undefined && valor !== null && valor !== '' &&
                   !(Array.isArray(valor) && valor.length === 0)
  );
  if (entradas.length === 0) return items;

  return items.filter(item =>
    entradas.every(([campo, valor]) => {
      if (campo === 'q') {
        const aguja = normalizar(valor);
        return (esquema.buscables || []).some(c => normalizar(item[c] ?? '').includes(aguja));
      }
      return coincideCampo(item[campo], valor);
    })
  );
}

function aplicarOrden(items, orden) {
  if (!orden) return items;
  const descendente = orden.startsWith('-');
  const campo = descendente ? orden.slice(1) : orden;

  return [...items].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x === y) return 0;
    if (x === undefined || x === null) return 1;
    if (y === undefined || y === null) return -1;
    const comparacion = typeof x === 'string' && typeof y === 'string'
      ? x.localeCompare(y, 'es')
      : (x > y ? 1 : -1);
    return descendente ? -comparacion : comparacion;
  });
}

/* ----------------------------------------------------- identificadores */

function siguienteId(items, esquema) {
  const { clave, prefijo = '', relleno = 3 } = esquema;
  const maximo = items.reduce((mayor, item) => {
    const valor = String(item[clave] ?? '');
    if (!valor.startsWith(prefijo)) return mayor;
    const numero = parseInt(valor.slice(prefijo.length), 10);
    return Number.isNaN(numero) ? mayor : Math.max(mayor, numero);
  }, 0);
  return prefijo + String(maximo + 1).padStart(relleno, '0');
}

/* ------------------------------------------------------------- adaptador */

export function crearAdaptador() {
  return {
    nombre: 'estatico',

    async listar(coleccion, { filtros, orden, pagina = 1, porPagina = 20 } = {}) {
      const esquema = esquemaDe(coleccion);
      const todos = await materializar(coleccion);

      if (esquema.tipo === 'objeto') {
        return { items: [todos], total: 1, pagina: 1, porPagina: 1 };
      }

      let items = esquema.tipo === 'lista'
        ? todos
        : aplicarOrden(aplicarFiltros(todos, filtros, esquema), orden);

      const total = items.length;
      if (porPagina > 0) {
        const desde = (pagina - 1) * porPagina;
        items = items.slice(desde, desde + porPagina);
      }
      return { items, total, pagina, porPagina };
    },

    async obtener(coleccion, id) {
      const esquema = esquemaDe(coleccion);
      const datos = await materializar(coleccion);
      if (esquema.tipo === 'objeto') return datos;
      if (esquema.tipo === 'lista') return datos.includes(id) ? id : null;
      return datos.find(item => item[esquema.clave] === id) ?? null;
    },

    async crear(coleccion, datos) {
      const esquema = esquemaDe(coleccion);
      const cambios = leerCambios(coleccion);

      if (esquema.tipo === 'lista') {
        const actuales = await materializar(coleccion);
        if (actuales.includes(datos)) throw new Error(`"${datos}" ya existe en ${coleccion}`);
        cambios.eliminados = cambios.eliminados.filter(v => v !== datos);
        cambios.creados = [...cambios.creados, datos];
        guardarCambios(coleccion, cambios);
        return datos;
      }

      const actuales = await materializar(coleccion);
      const entidad = {
        ...datos,
        [esquema.clave]: datos[esquema.clave] || siguienteId(actuales, esquema)
      };
      cambios.creados = [...cambios.creados, entidad];
      guardarCambios(coleccion, cambios);
      return entidad;
    },

    async actualizar(coleccion, id, parche) {
      const esquema = esquemaDe(coleccion);
      const cambios = leerCambios(coleccion);

      if (esquema.tipo === 'objeto') {
        cambios.modificados = { ...cambios.modificados, ...parche };
        guardarCambios(coleccion, cambios);
        return materializar(coleccion);
      }

      // Si la entidad nació en esta capa, se modifica en el lugar.
      const indice = cambios.creados.findIndex(item => item[esquema.clave] === id);
      if (indice !== -1) {
        cambios.creados[indice] = { ...cambios.creados[indice], ...parche };
        guardarCambios(coleccion, cambios);
        return cambios.creados[indice];
      }

      cambios.modificados = {
        ...cambios.modificados,
        [id]: { ...(cambios.modificados[id] || {}), ...parche }
      };
      guardarCambios(coleccion, cambios);
      return this.obtener(coleccion, id);
    },

    async eliminar(coleccion, id) {
      const esquema = esquemaDe(coleccion);
      const cambios = leerCambios(coleccion);
      const clave = esquema.tipo === 'lista' ? null : esquema.clave;

      const antes = cambios.creados.length;
      cambios.creados = cambios.creados.filter(
        item => (clave ? item[clave] : item) !== id
      );
      // Si no estaba en los creados, estaba en la base: se marca como eliminado.
      if (cambios.creados.length === antes && !cambios.eliminados.includes(id)) {
        cambios.eliminados = [...cambios.eliminados, id];
      }
      if (clave) delete cambios.modificados[id];

      guardarCambios(coleccion, cambios);
    },

    /**
     * Sin almacenamiento de objetos, el archivo se conserva como URL temporal
     * de la pestaña: alcanza para previsualizar y descargar en la sesión, y se
     * pierde al cerrarla. El repositorio documental real llega con la fase 2.
     */
    async subirArchivo(bucket, archivo) {
      const url = URL.createObjectURL(archivo);
      console.warn(
        `[api] Archivo "${archivo.name}" retenido solo en esta pestaña ` +
        `(adaptador estático, bucket "${bucket}").`
      );
      return { url, tamanio: archivo.size, efimero: true };
    },

    restablecer(coleccion) {
      const objetivo = coleccion ? [coleccion] : COLECCIONES;
      for (const nombre of objetivo) {
        localStorage.removeItem(PREFIJO_ALMACEN + nombre);
        cacheCambios.delete(nombre);
      }
    }
  };
}
