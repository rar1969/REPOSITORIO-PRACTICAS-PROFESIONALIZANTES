/**
 * core/sesion — quién está usando el portal y con qué rol.
 *
 * Dos modos, según PORTAL_CONFIG.adaptador:
 *
 *   estatico  — DEMOSTRACIÓN. El rol sale del desplegable "Modo / Perfil" y
 *               cualquiera puede elegirse Administrador. Sirve para mostrar el
 *               portal sin servidor; no protege nada.
 *   supabase  — SESIÓN REAL (fase 2, SDD §9). El desplegable desaparece; se
 *               ingresa con correo y contraseña, y el rol sale de la tabla
 *               `perfiles`. Ocultar el panel sigue siendo cosmética: lo que
 *               protege los datos son las políticas de la base.
 *
 * Los módulos no ven la diferencia: preguntan `ctx.sesion.rol()` y escuchan
 * `rol:cambiado`, igual en los dos modos.
 */

import { emitir } from './bus.js';
import { crearAuth } from '../services/auth.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { el, icono } from '../ui/dom.js';

/* Valor del desplegable de demostración → identificador de rol. */
const ROLES_DEMO = {
  'Visitante': 'visitante',
  'Estudiante': 'estudiante',
  'Docente/Tutor': 'docente',
  'Escuela': 'escuela',
  'Empresa': 'empresa',
  'Administrador Provincial': 'admin'
};

const ETIQUETAS = {
  visitante: 'Visitante',
  estudiante: 'Estudiante',
  docente: 'Docente / Tutor',
  escuela: 'Escuela',
  empresa: 'Empresa oferente',
  admin: 'Administrador Provincial'
};

let rolActual = 'visitante';
let usuarioActual = null;     // solo en modo supabase
let auth = null;

export const rol = () => rolActual;
export const esAdmin = () => rolActual === 'admin';
export const etiquetaRol = () => ETIQUETAS[rolActual] ?? 'Visitante';
export const usuario = () => usuarioActual;

const sesion = { rol, esAdmin, etiquetaRol, usuario };

/** Muestra u oculta lo que depende del rol, en todo el documento. */
function reflejar() {
  const admin = esAdmin();
  const botonPanel = document.getElementById('nav-btn-admin');
  if (botonPanel) botonPanel.style.display = admin ? 'flex' : 'none';
  for (const nodo of document.querySelectorAll('.admin-only-element')) {
    nodo.style.display = admin ? 'inline-flex' : 'none';
  }
  const insignia = document.getElementById('active-role-display');
  if (insignia) insignia.textContent = etiquetaRol();
  dibujarBotonSesion();
}

function aplicarRol(nuevo, { avisar = true } = {}) {
  const cambio = nuevo !== rolActual;
  rolActual = ETIQUETAS[nuevo] ? nuevo : 'visitante';
  reflejar();
  if (!cambio) return;
  emitir('rol:cambiado', rolActual);
  if (avisar) {
    emitir('aviso', {
      texto: `Rol activo: ${etiquetaRol()}${esAdmin() ? ' (gestión completa habilitada)' : ''}`,
      tipo: 'info'
    });
  }
}

/** Compatibilidad con el desplegable de demostración. */
export function cambiarRol(valorDelSelector) {
  if (auth) return;   // con sesión real, el rol no se elige
  aplicarRol(ROLES_DEMO[valorDelSelector] ?? 'visitante');
}

/* ------------------------------------------------------- modo supabase */

const estiloBoton = {
  background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.45)',
  borderRadius: '999px', padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: '600',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
};

function dibujarBotonSesion() {
  if (!auth) return;
  const contenedor = document.querySelector('.role-selector-container');
  if (!contenedor) return;
  document.getElementById('zona-sesion')?.remove();

  const zona = el('div', { id: 'zona-sesion', style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } },
    usuarioActual
      ? [
          el('span', { style: { fontSize: '0.8rem', opacity: '0.95' }, title: usuarioActual.correo },
            icono('fa-circle-user'), ` ${usuarioActual.nombre} · ${etiquetaRol()}`),
          el('button', { type: 'button', style: estiloBoton, onclick: salir },
            icono('fa-right-from-bracket'), ' Salir')
        ]
      : el('button', { type: 'button', id: 'btn-ingresar', style: estiloBoton,
                       onclick: () => abrirModal('ingresar') },
          icono('fa-right-to-bracket'), ' Ingresar')
  );
  contenedor.prepend(zona);
}

async function salir() {
  await auth.salir();
  usuarioActual = null;
  aplicarRol('visitante', { avisar: false });
  emitir('aviso', { texto: 'Sesión cerrada.', tipo: 'info' });
}

function conectarFormularios() {
  const ingreso = document.getElementById('form-ingresar');
  ingreso?.addEventListener('submit', async evento => {
    evento.preventDefault();
    const boton = ingreso.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const perfil = await auth.entrar(
        document.getElementById('ingresar-correo').value.trim(),
        document.getElementById('ingresar-clave').value
      );
      usuarioActual = perfil;
      ingreso.reset();
      cerrarModal('ingresar');
      aplicarRol(perfil.rol, { avisar: false });
      emitir('aviso', { texto: `Hola, ${perfil.nombre}. Ingresaste como ${etiquetaRol()}.`, tipo: 'success' });
      if (perfil.rol === 'visitante') {
        emitir('aviso', {
          texto: 'Tu cuenta todavía no tiene un rol asignado. Pedíselo a la DETyFP.',
          tipo: 'info'
        });
      }
    } catch (error) {
      emitir('aviso', { texto: error.message, tipo: 'error' });
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('btn-recuperar-clave')?.addEventListener('click', async () => {
    const correo = document.getElementById('ingresar-correo').value.trim();
    if (!correo) {
      emitir('aviso', { texto: 'Escribí tu correo y volvé a tocar "¿Olvidaste tu contraseña?".', tipo: 'info' });
      document.getElementById('ingresar-correo').focus();
      return;
    }
    try {
      await auth.recuperar(correo);
      emitir('aviso', { texto: `Si ${correo} tiene cuenta, le llega un correo para elegir una contraseña nueva.`, tipo: 'success' });
    } catch (error) {
      emitir('aviso', { texto: error.message, tipo: 'error' });
    }
  });

  const nueva = document.getElementById('form-nueva-clave');
  nueva?.addEventListener('submit', async evento => {
    evento.preventDefault();
    const clave = document.getElementById('nueva-clave').value;
    const repetida = document.getElementById('nueva-clave-repetida').value;
    if (clave.length < 8) return emitir('aviso', { texto: 'La contraseña debe tener al menos 8 caracteres.', tipo: 'error' });
    if (clave !== repetida) return emitir('aviso', { texto: 'Las dos contraseñas no coinciden.', tipo: 'error' });
    try {
      await auth.nuevaClave(clave);
      nueva.reset();
      cerrarModal('nueva-clave');
      emitir('aviso', { texto: 'Contraseña actualizada.', tipo: 'success' });
    } catch (error) {
      emitir('aviso', { texto: error.message, tipo: 'error' });
    }
  });
}

async function iniciarSupabase() {
  // El desplegable de demostración no tiene sentido con sesión real.
  const desplegable = document.getElementById('role-select');
  desplegable?.remove();
  document.querySelector('label[for="role-select"]')?.remove();

  conectarFormularios();

  usuarioActual = await auth.usuarioActual();
  aplicarRol(usuarioActual?.rol ?? 'visitante', { avisar: false });

  auth.alCambiar((evento, perfil) => {
    if (evento === 'PASSWORD_RECOVERY') {
      usuarioActual = perfil;
      aplicarRol(perfil?.rol ?? 'visitante', { avisar: false });
      abrirModal('nueva-clave');
    } else if (evento === 'SIGNED_OUT') {
      usuarioActual = null;
      aplicarRol('visitante', { avisar: false });
    } else if (evento === 'USER_UPDATED' || evento === 'TOKEN_REFRESHED') {
      if (perfil) { usuarioActual = perfil; aplicarRol(perfil.rol, { avisar: false }); }
    }
  });
}

/* ---------------------------------------------------------------- arranque */

export async function iniciarSesion(selector = '#role-select') {
  try {
    auth = await crearAuth();
  } catch (error) {
    console.error('[sesion] No se pudo iniciar la autenticación.', error);
    emitir('aviso', { texto: 'No se pudo conectar el inicio de sesión. Se navega como visitante.', tipo: 'error' });
    auth = null;
    rolActual = 'visitante';
    document.getElementById('role-select')?.closest('.role-selector-container')
      ?.querySelectorAll('label, select').forEach(n => n.remove());
    reflejar();
    return sesion;
  }

  if (auth) {
    await iniciarSupabase();
    return sesion;
  }

  const desplegable = document.querySelector(selector);
  if (desplegable) {
    // Al recargar, el navegador puede recordar la opción elegida: se respeta.
    rolActual = ROLES_DEMO[desplegable.value] ?? 'visitante';
    desplegable.addEventListener('change', e => cambiarRol(e.target.value));
  }
  reflejar();
  return sesion;
}
