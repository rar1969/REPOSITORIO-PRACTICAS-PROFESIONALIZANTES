/**
 * ui/aviso — mensajes breves en la esquina de la pantalla.
 *
 * Reemplaza al `showToast()` de app.js con dos diferencias que importan:
 *
 *   1. El mensaje entra como texto, nunca como HTML. El viejo recibía
 *      `<strong>${nombre}</strong>` armado con lo que la persona escribió en un
 *      formulario: una razón social con etiquetas se ejecutaba.
 *   2. La caja es una región `aria-live`, así que un lector de pantalla lee el
 *      aviso apenas aparece (WCAG 4.1.3).
 *
 * Los módulos no lo importan: emiten `aviso` por el bus y el núcleo lo dibuja.
 * Así un módulo se puede probar sin pantalla.
 */

import { el, icono } from './dom.js';

const COLORES = { success: '#047857', error: '#b91c1c', info: '#0369a1' };
const ICONOS = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
const DURACION = 4500;

function caja() {
  let nodo = document.getElementById('toast-container');
  if (nodo) return nodo;

  nodo = el('div', {
    id: 'toast-container',
    role: 'status',
    'aria-live': 'polite',
    style: {
      position: 'fixed', bottom: '1.5rem', right: '1.5rem', left: 'auto',
      zIndex: '9999', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      maxWidth: 'min(420px, calc(100vw - 2rem))'
    }
  });
  document.body.append(nodo);
  return nodo;
}

/**
 * Muestra un aviso.
 * @param {string} texto   siempre texto plano
 * @param {'success'|'error'|'info'} [tipo='info']
 */
export function avisar(texto, tipo = 'info') {
  const aviso = el('div', {
    style: {
      background: COLORES[tipo] ?? COLORES.info, color: '#fff',
      padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-md)', fontSize: '0.875rem',
      display: 'flex', alignItems: 'center', gap: '0.5rem'
    }
  }, icono(ICONOS[tipo] ?? ICONOS.info), el('span', {}, String(texto)));

  caja().append(aviso);
  setTimeout(() => aviso.remove(), DURACION);
  return aviso;
}
