/**
 * bootstrap — andamio de la fase 1.
 *
 * Carga los datos a través de services/api y reconstruye el objeto global
 * window.PORTAL_DATA que el app.js actual espera, de modo que el portal siga
 * funcionando exactamente igual que antes mientras la capa de datos ya es la
 * definitiva. Además persiste lo que el usuario carga: cualquier mutación del
 * objeto global se traduce a llamadas api.crear / api.actualizar / api.eliminar.
 *
 * Es código temporal, y a propósito. Cuando cada vista pase a
 * modules/<nombre>/index.js y pida sus datos con api.listar(), este archivo se
 * borra entero: ningún módulo nuevo debe usar window.PORTAL_DATA.
 */

import { api } from './services/api.js';

/* Nombre en el portal ← nombre de la colección en la api. */
const EQUIVALENCIAS = {
  especialidades: 'especialidades',
  escuelas: 'escuelas',
  oferentes: 'oferentes',
  alumnos: 'estudiantes',
  capacitaciones: 'capacitaciones',
  documentos: 'documentos',
  casos_exitosos: 'casos',
  solicitudes: 'solicitudes',
  metricas: 'metricas'
};

const CLAVES = {
  escuelas: 'id', oferentes: 'id', estudiantes: 'id', capacitaciones: 'id',
  documentos: 'id', casos: 'id', solicitudes: 'id'
};

const clonar = valor => JSON.parse(JSON.stringify(valor));

/* Estado del último sincronizado, para saber qué cambió. */
const referencia = new Map();
const pendientes = new Set();
let temporizador = null;

/* --------------------------------------------- detección de mutaciones */

/**
 * Envuelve un valor en un Proxy que avisa de cualquier escritura, por profunda
 * que sea: `oferentes[2].cupos_disponibles = 4` marca "oferentes" como sucia.
 */
function observar(valor, coleccion) {
  if (valor === null || typeof valor !== 'object') return valor;

  return new Proxy(valor, {
    get(destino, propiedad, receptor) {
      const v = Reflect.get(destino, propiedad, receptor);
      if (typeof propiedad === 'symbol' || typeof v === 'function') return v;
      return observar(v, coleccion);
    },
    set(destino, propiedad, valorNuevo, receptor) {
      const ok = Reflect.set(destino, propiedad, valorNuevo, receptor);
      if (ok) marcar(coleccion);
      return ok;
    },
    deleteProperty(destino, propiedad) {
      const ok = Reflect.deleteProperty(destino, propiedad);
      if (ok) marcar(coleccion);
      return ok;
    }
  });
}

function marcar(coleccion) {
  pendientes.add(coleccion);
  clearTimeout(temporizador);
  temporizador = setTimeout(sincronizar, 300);
}

/* --------------------------------------------------------- persistencia */

async function sincronizar() {
  const colecciones = [...pendientes];
  pendientes.clear();

  for (const coleccion of colecciones) {
    try {
      await sincronizarColeccion(coleccion);
    } catch (error) {
      console.error(`[bootstrap] No se pudo guardar "${coleccion}".`, error);
    }
  }
}

async function sincronizarColeccion(coleccion) {
  const nombrePortal = Object.keys(EQUIVALENCIAS).find(k => EQUIVALENCIAS[k] === coleccion);
  const actual = clonar(window.PORTAL_DATA[nombrePortal]);   // sin el Proxy
  const previo = referencia.get(coleccion);
  const clave = CLAVES[coleccion];

  if (!Array.isArray(actual)) {
    // Objeto suelto (métricas): se guarda el parche de lo que cambió.
    const parche = {};
    for (const [campo, valor] of Object.entries(actual)) {
      if (JSON.stringify(previo[campo]) !== JSON.stringify(valor)) parche[campo] = valor;
    }
    if (Object.keys(parche).length) await api.actualizar(coleccion, null, parche);

  } else if (!clave) {
    // Lista de strings (especialidades).
    for (const v of actual) if (!previo.includes(v)) await api.crear(coleccion, v);
    for (const v of previo) if (!actual.includes(v)) await api.eliminar(coleccion, v);

  } else {
    const antes = new Map(previo.map(i => [i[clave], i]));
    const despues = new Map(actual.map(i => [i[clave], i]));

    for (const [id, item] of despues) {
      const original = antes.get(id);
      if (!original) {
        await api.crear(coleccion, item);
      } else if (JSON.stringify(original) !== JSON.stringify(item)) {
        await api.actualizar(coleccion, id, item);
      }
    }
    for (const id of antes.keys()) {
      if (!despues.has(id)) await api.eliminar(coleccion, id);
    }
  }

  referencia.set(coleccion, actual);
}

/* -------------------------------------------------------------- arranque */

async function cargarDatos() {
  const datos = {};

  await Promise.all(
    Object.entries(EQUIVALENCIAS).map(async ([nombrePortal, coleccion]) => {
      const { items } = await api.listar(coleccion, { porPagina: 0 });
      const valor = coleccion === 'metricas' ? items[0] : items;
      referencia.set(coleccion, clonar(valor));
      datos[nombrePortal] = valor;
    })
  );

  // El objeto raíz también se observa: app.js reasigna arrays enteros
  // (por ejemplo `PORTAL_DATA.solicitudes = solicitudes.filter(...)`).
  window.PORTAL_DATA = new Proxy(datos, {
    get: (destino, propiedad) => observar(Reflect.get(destino, propiedad), EQUIVALENCIAS[propiedad]),
    set(destino, propiedad, valor) {
      const ok = Reflect.set(destino, propiedad, valor);
      if (ok && EQUIVALENCIAS[propiedad]) marcar(EQUIVALENCIAS[propiedad]);
      return ok;
    }
  });
}

/**
 * app.js corre dentro de un listener de DOMContentLoaded, que ya se disparó
 * mientras esperábamos los datos. Se intercepta ese registro una sola vez,
 * durante la importación, para invocarlo igual. Desaparece con el andamio.
 */
async function iniciarAppHeredada() {
  const registrar = document.addEventListener.bind(document);
  document.addEventListener = (tipo, fn, opciones) => {
    if (tipo === 'DOMContentLoaded' && document.readyState !== 'loading') {
      queueMicrotask(fn);
      return;
    }
    registrar(tipo, fn, opciones);
  };
  try {
    await import('./app.js');
  } finally {
    document.addEventListener = registrar;
  }
}

try {
  await cargarDatos();
  window.addEventListener('beforeunload', () => {
    if (pendientes.size) sincronizar();
  });
  await iniciarAppHeredada();

  // El núcleo arranca después del legado: necesita que las secciones ya estén
  // en pantalla para montar sus módulos encima.
  const { iniciar } = await import('./core/index.js');
  await iniciar();

  console.info(`[portal] Datos listos (adaptador: ${api.origen}).`);
} catch (error) {
  console.error('[portal] Fallo al cargar los datos.', error);
  document.body.insertAdjacentHTML('afterbegin',
    '<p role="alert" style="padding:1rem;background:#b3261e;color:#fff;margin:0">' +
    'No se pudieron cargar los datos del portal. Actualizá la página o avisá a la DETyFP.</p>'
  );
}
