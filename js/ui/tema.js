/**
 * ui/tema — tema claro u oscuro.
 *
 * Misma clave de almacenamiento que usaba app.js (`portal_theme`), así que
 * nadie pierde la elección que ya había hecho. La primera vez, sin elección
 * guardada, respeta la preferencia del sistema operativo.
 */

import { icono } from './dom.js';

const CLAVE = 'portal_theme';

function leer() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'light' || guardado === 'dark') return guardado;
  } catch { /* almacenamiento bloqueado: se sigue con el del sistema */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function aplicar(tema, boton) {
  document.documentElement.setAttribute('data-theme', tema);
  if (!boton) return;
  boton.replaceChildren(icono(tema === 'dark' ? 'fa-sun' : 'fa-moon'));
  const etiqueta = tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  boton.setAttribute('aria-label', etiqueta);
  boton.setAttribute('title', etiqueta);
}

export function iniciarTema(selectorBoton = '#theme-toggle-btn') {
  const boton = document.querySelector(selectorBoton);
  let tema = leer();
  aplicar(tema, boton);

  boton?.addEventListener('click', () => {
    tema = tema === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(CLAVE, tema); } catch { /* sin persistencia */ }
    aplicar(tema, boton);
  });
}
