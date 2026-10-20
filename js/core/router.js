/**
 * core/router — traduce la URL a un módulo montado.
 *
 * Reemplaza definitivamente a `switchView()`. Durante la migración convivió
 * con app.js en un "modo delegado"; con la última vista migrada, ese modo
 * desapareció y el ruteador hace todo: muestra la sección, marca el botón del
 * menú, monta el módulo nuevo y desmonta el anterior.
 *
 * La URL es `#/<vista>?<parámetros>`. Los parámetros son del módulo: el
 * ruteador solo los transporta. Sirven para que un filtro aplicado se pueda
 * compartir —`#/directorio?dept=Monteros`— que es como circula hoy la
 * información entre las escuelas de la red.
 */

import { obtener, visiblePara } from './registro.js';
import { emitir, escuchar } from './bus.js';

const RUTA_POR_DEFECTO = 'inicio';

let activo = null;          // { modulo, contenedor } montado ahora
let navegando = false;      // evita el ida y vuelta entre clic y hashchange
let contexto = null;
let turno = 0;              // descarta montajes que quedaron viejos

const idDesdeHash = () =>
  (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0] || RUTA_POR_DEFECTO).trim();

const paramsDesdeHash = () =>
  new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '');

const seccionDe = id => document.getElementById(`view-${id}`);
const rolActual = () => contexto?.sesion?.rol?.() ?? 'visitante';

/* ------------------------------------------------------------- navegación */

/**
 * Cambia de vista. Es la única forma de navegar: todo lo demás llama acá.
 * `params` es un objeto plano; los valores vacíos no se escriben en la URL.
 */
export function ir(id, params) {
  const destino = id || RUTA_POR_DEFECTO;
  escribirHash(`#/${destino}${consulta(params)}`);
  return mostrar(destino, { forzar: Boolean(params) });
}

function escribirHash(hash) {
  if (location.hash === hash) return;
  navegando = true;
  location.hash = hash;
  // `hashchange` llega después; se libera la marca cuando ya pasó.
  setTimeout(() => { navegando = false; }, 0);
}

function consulta(params) {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params || {})) {
    if (valor !== '' && valor !== null && valor !== undefined) busqueda.set(clave, valor);
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Reescribe los parámetros de la vista abierta sin volver a montarla. Lo usa
 * un módulo cuando cambia un filtro: la URL queda compartible y el historial
 * del navegador guarda el paso, pero la vista no parpadea.
 */
export function actualizarParams(params) {
  escribirHash(`#/${idDesdeHash()}${consulta(params)}`);
}

async function mostrar(idPedido, { forzar = false } = {}) {
  let id = seccionDe(idPedido) ? idPedido : RUTA_POR_DEFECTO;
  let modulo = obtener(id);
  if (modulo?.persistente) modulo = null;

  // Quien no tiene el rol vuelve al inicio. En el cliente es solo cosmética:
  // la verificación de verdad llega con la sesión real (fase 2).
  if (modulo && !visiblePara(modulo, rolActual())) {
    emitir('aviso', { texto: `"${modulo.titulo}" requiere otro perfil de acceso.`, tipo: 'error' });
    id = RUTA_POR_DEFECTO;
    modulo = obtener(id);
    escribirHash(`#/${id}`);
  }

  if (activo?.modulo.id === id && !forzar) return;
  const miTurno = ++turno;

  if (activo) {
    try {
      activo.modulo.desmontar?.();
    } catch (error) {
      console.error(`[router] Error al desmontar "${activo.modulo.id}".`, error);
    }
    activo = null;
  }

  for (const seccion of document.querySelectorAll('.view-section')) {
    seccion.style.display = seccion.id === `view-${id}` ? 'block' : 'none';
  }
  for (const boton of document.querySelectorAll('.nav-btn[data-view]')) {
    const actual = boton.dataset.view === id;
    boton.classList.toggle('active', actual);
    if (actual) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  }
  if (modulo?.titulo) document.title = `${modulo.titulo} | Prácticas Profesionalizantes · DETyFP Tucumán`;
  window.scrollTo?.({ top: 0, behavior: 'smooth' });

  if (!modulo) {
    emitir('vista:cambiada', { id, modulo: null });
    return;
  }

  const contenedor = modulo.contenedor
    ? document.querySelector(modulo.contenedor)
    : seccionDe(id);

  if (!contenedor) {
    console.error(`[router] El módulo "${id}" no encontró su contenedor (${modulo.contenedor}).`);
    return;
  }

  try {
    activo = { modulo, contenedor };
    await modulo.montar(contenedor, { ...contexto, params: paramsDesdeHash() });
  } catch (error) {
    console.error(`[router] Error al montar "${id}".`, error);
    if (miTurno === turno) contenedor.textContent = 'No se pudo cargar esta sección. Actualizá la página.';
  }
  emitir('vista:cambiada', { id, modulo });
}

/* ---------------------------------------------------------------- arranque */

export function iniciar(ctx) {
  contexto = { ...ctx, ir, actualizarParams };

  window.addEventListener('hashchange', () => {
    if (!navegando) mostrar(idDesdeHash());
  });

  // Los botones del menú escriben la URL; el resto lo hace `mostrar`.
  document.addEventListener('click', evento => {
    const boton = evento.target.closest?.('.nav-btn[data-view]');
    if (!boton) return;
    evento.preventDefault();
    ir(boton.dataset.view);
  });

  // Un módulo puede pedir que se abra una vista, con o sin filtros aplicados.
  escuchar('ir', ({ vista, params } = {}) => ir(vista, params));

  // Un rol que pierde permiso sobre la vista abierta vuelve al inicio.
  escuchar('rol:cambiado', rol => {
    const modulo = obtener(idDesdeHash());
    if (modulo && !modulo.persistente && !visiblePara(modulo, rol)) ir(RUTA_POR_DEFECTO);
  });

  return mostrar(idDesdeHash());
}

export const rutaActual = () => idDesdeHash();
