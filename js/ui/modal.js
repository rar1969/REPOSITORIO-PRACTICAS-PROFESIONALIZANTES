/**
 * ui/modal — apertura y cierre de las ventanas modales.
 *
 * El marcado de cada modal sigue en index.html, con su estilo resuelto. Lo que
 * se centraliza acá es el comportamiento, que en app.js estaba repartido y
 * además incompleto para teclado:
 *
 *   - Escape cierra, y un clic en el fondo oscuro también.
 *   - Al abrir, el foco pasa al primer campo; al cerrar, vuelve al botón que
 *     abrió la ventana. Sin eso, quien navega con teclado queda perdido al
 *     final de la página (WCAG 2.4.3).
 *   - La X tiene nombre para los lectores de pantalla.
 *
 * Los botones con `data-open-modal="oferente"` abren `#modal-oferente` solos:
 * no hace falta que ningún módulo los conecte.
 */

const ENFOCABLES = 'input:not([type=hidden]):not([readonly]), select, textarea, button:not(.close-modal-btn)';

let origenDelFoco = null;
let iniciado = false;
const alCerrar = new Map();   // id → Set de funciones

const modalDe = id => document.getElementById(id.startsWith('modal-') ? id : `modal-${id}`);
const abiertos = () => [...document.querySelectorAll('.modal-backdrop.active')];

/** Abre un modal por su id corto ('oferente') o completo ('modal-oferente'). */
export function abrirModal(id) {
  const modal = modalDe(id);
  if (!modal) {
    console.warn(`[modal] No existe el modal "${id}".`);
    return null;
  }
  origenDelFoco = document.activeElement;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  // El foco se mueve después de la transición de apertura.
  setTimeout(() => modal.querySelector(ENFOCABLES)?.focus(), 50);
  return modal;
}

/** Cierra un modal; sin argumento, cierra el que esté abierto. */
export function cerrarModal(id) {
  const modal = id ? modalDe(id) : abiertos().at(-1);
  if (!modal || !modal.classList.contains('active')) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  for (const fn of alCerrar.get(modal.id) ?? []) fn();
  if (origenDelFoco?.focus) origenDelFoco.focus();
  origenDelFoco = null;
}

/** Avisa cuando un modal se cierra. Devuelve la función para desuscribirse. */
export function alCerrarModal(id, fn) {
  const clave = modalDe(id)?.id ?? id;
  if (!alCerrar.has(clave)) alCerrar.set(clave, new Set());
  alCerrar.get(clave).add(fn);
  return () => alCerrar.get(clave)?.delete(fn);
}

/** Conecta una sola vez el comportamiento común a todos los modales. */
export function iniciarModales() {
  if (iniciado) return;
  iniciado = true;

  for (const modal of document.querySelectorAll('.modal-backdrop')) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    const titulo = modal.querySelector('.modal-header h3');
    if (titulo) {
      titulo.id ||= `${modal.id}-titulo`;
      modal.setAttribute('aria-labelledby', titulo.id);
    }
  }
  for (const x of document.querySelectorAll('.close-modal-btn')) {
    x.setAttribute('aria-label', 'Cerrar');
    x.setAttribute('type', 'button');
  }

  document.addEventListener('click', evento => {
    const objetivo = evento.target;
    const abridor = objetivo.closest?.('[data-open-modal]');
    if (abridor) {
      evento.preventDefault();
      abrirModal(abridor.dataset.openModal);
      return;
    }
    if (objetivo.closest?.('.close-modal-btn')) {
      cerrarModal(objetivo.closest('.modal-backdrop').id);
      return;
    }
    // Clic sobre el fondo oscuro, no sobre la ventana.
    if (objetivo.classList?.contains('modal-backdrop')) cerrarModal(objetivo.id);
  });

  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && abiertos().length) cerrarModal();
  });
}
