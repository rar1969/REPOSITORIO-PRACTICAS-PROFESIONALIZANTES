/**
 * core/router — traduce la URL a un módulo montado.
 *
 * Reemplaza a `switchView()`, pero por etapas: mientras queden vistas dentro
 * del `app.js` monolítico, el ruteador convive con él. Funciona en dos modos,
 * y el mismo código sirve para los dos:
 *
 *   delegado  — hay app.js. Él sigue mostrando y ocultando las secciones; el
 *               ruteador solo pone la URL y monta o desmonta los módulos ya
 *               migrados. Es el modo de hoy.
 *   propio    — no hay app.js. El ruteador hace también el mostrar/ocultar.
 *               Es el modo al que se llega cuando la última vista se migra,
 *               y no requiere tocar este archivo: se activa solo.
 *
 * Esa convivencia es lo que permite migrar una vista por vez sin dejar el
 * portal roto en el medio.
 */

import { obtener, visiblePara } from './registro.js';
import { emitir, escuchar } from './bus.js';

const RUTA_POR_DEFECTO = 'inicio';

let activo = null;          // { modulo, contenedor } montado ahora
let navegando = false;      // evita el ida y vuelta entre clic y hashchange
let contexto = null;

const idDesdeHash = () =>
  (location.hash.replace(/^#\/?/, '').split('/')[0] || RUTA_POR_DEFECTO).trim();

const seccionDe = id => document.getElementById(`view-${id}`);
const botonDe = id => document.querySelector(`.nav-btn[data-view="${id}"]`);

/** ¿Está app.js manejando la navegación? Lo sabemos por sus botones. */
const hayLegado = () => Boolean(document.querySelector('.nav-btn[data-view]')) && !window.PORTAL_SIN_LEGADO;

/* ------------------------------------------------------------- navegación */

/** Cambia de vista. Es la única forma de navegar: todo lo demás llama acá. */
export function ir(id) {
  const destino = id || RUTA_POR_DEFECTO;
  if (location.hash !== `#/${destino}`) {
    navegando = true;
    location.hash = `#/${destino}`;
    navegando = false;
  }
  mostrar(destino);
}

async function mostrar(id) {
  if (activo?.modulo.id === id) return;

  if (activo) {
    try {
      activo.modulo.desmontar?.();
    } catch (error) {
      console.error(`[router] Error al desmontar "${activo.modulo.id}".`, error);
    }
    activo = null;
  }

  if (hayLegado()) {
    // app.js muestra y oculta; lo despertamos con su propio botón.
    const boton = botonDe(id);
    if (boton && !boton.classList.contains('active')) boton.click();
  } else {
    for (const seccion of document.querySelectorAll('.view-section')) {
      seccion.style.display = seccion.id === `view-${id}` ? 'block' : 'none';
    }
    for (const boton of document.querySelectorAll('.nav-btn[data-view]')) {
      boton.classList.toggle('active', boton.dataset.view === id);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const modulo = obtener(id);
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
    await modulo.montar(contenedor, contexto);
    activo = { modulo, contenedor };
  } catch (error) {
    console.error(`[router] Error al montar "${id}".`, error);
    contenedor.textContent = 'No se pudo cargar esta sección. Actualizá la página.';
  }
  emitir('vista:cambiada', { id, modulo });
}

/* ---------------------------------------------------------------- arranque */

export function iniciar(ctx) {
  contexto = { ...ctx, ir };

  window.addEventListener('hashchange', () => {
    if (!navegando) mostrar(idDesdeHash());
  });

  // Los botones del menú pasan a escribir la URL. No se cancela el clic:
  // en modo delegado app.js sigue necesitándolo para mostrar su sección.
  document.addEventListener('click', evento => {
    const boton = evento.target.closest?.('.nav-btn[data-view]');
    if (!boton) return;
    const id = boton.dataset.view;
    navegando = true;
    if (location.hash !== `#/${id}`) location.hash = `#/${id}`;
    navegando = false;
    mostrar(id);
  });

  // Un rol que pierde permiso sobre la vista abierta vuelve al inicio.
  escuchar('rol:cambiado', rol => {
    const modulo = obtener(idDesdeHash());
    if (modulo && !visiblePara(modulo, rol)) ir(RUTA_POR_DEFECTO);
  });

  mostrar(idDesdeHash());
}

export const rutaActual = () => idDesdeHash();
