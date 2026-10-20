/**
 * core/sesion — quién está usando el portal y con qué rol.
 *
 * TODAVÍA ES SIMULADA. El rol sale del desplegable "Modo / Perfil" del
 * encabezado, igual que en el prototipo, de modo que cualquiera puede elegirse
 * Administrador. Lo que cambia es que ahora hay un único lugar que responde
 * "¿qué rol hay?": el día que llegue la autenticación real (fase 2, SDD §9),
 * se reescribe este archivo y ningún módulo se entera.
 *
 * Mientras tanto, ocultar el panel a quien no es administrador es cosmética,
 * no seguridad: los datos siguen siendo archivos públicos.
 */

import { emitir } from './bus.js';

/* Valor del desplegable → identificador de rol que usan los módulos. */
const ROLES = {
  'Visitante': 'visitante',
  'Estudiante': 'estudiante',
  'Docente/Tutor': 'docente',
  'Escuela': 'escuela',
  'Empresa': 'empresa',
  'Administrador Provincial': 'admin'
};

let rolActual = 'visitante';
let etiquetaActual = 'Visitante';

export const rol = () => rolActual;
export const esAdmin = () => rolActual === 'admin';
export const etiquetaRol = () => etiquetaActual;

/** Muestra u oculta lo que depende del rol, en todo el documento. */
function reflejar() {
  const admin = esAdmin();
  const botonPanel = document.getElementById('nav-btn-admin');
  if (botonPanel) botonPanel.style.display = admin ? 'flex' : 'none';
  for (const nodo of document.querySelectorAll('.admin-only-element')) {
    nodo.style.display = admin ? 'inline-flex' : 'none';
  }
  const insignia = document.getElementById('active-role-display');
  if (insignia) insignia.textContent = etiquetaActual;
}

export function cambiarRol(valorDelSelector) {
  const nuevo = ROLES[valorDelSelector] ?? 'visitante';
  etiquetaActual = ROLES[valorDelSelector] ? valorDelSelector : 'Visitante';
  if (nuevo === rolActual) return reflejar();
  rolActual = nuevo;
  reflejar();
  emitir('rol:cambiado', rolActual);
  emitir('aviso', {
    texto: `Rol activo: ${etiquetaActual}${nuevo === 'admin' ? ' (gestión completa habilitada)' : ''}`,
    tipo: 'info'
  });
}

export function iniciarSesion(selector = '#role-select') {
  const desplegable = document.querySelector(selector);
  if (desplegable) {
    // Al recargar, el navegador puede recordar la opción elegida: se respeta.
    rolActual = ROLES[desplegable.value] ?? 'visitante';
    etiquetaActual = ROLES[desplegable.value] ? desplegable.value : 'Visitante';
    desplegable.addEventListener('change', e => cambiarRol(e.target.value));
  }
  reflejar();
  return { rol, esAdmin, etiquetaRol };
}
