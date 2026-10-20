/**
 * services/auth — inicio de sesión real (fase 2).
 *
 * Solo existe con `adaptador: 'supabase'`. Con el adaptador estático devuelve
 * null y core/sesion sigue usando el desplegable "Modo / Perfil", como en la
 * demostración.
 *
 * Cuentas: las crea la Dirección desde el panel de Supabase (no hay registro
 * abierto). Cada cuenta tiene un perfil en la tabla `perfiles` con su rol; un
 * usuario nuevo arranca como "visitante" hasta que un administrador le asigna
 * otro.
 */

import { obtenerCliente } from './supabase.js';

const MENSAJES = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'La cuenta todavía no está confirmada. Pedile a la DETyFP que la confirme.',
  'User not found': 'No hay una cuenta con ese correo.'
};

const traducir = error => {
  const texto = error?.message ?? String(error);
  if (/rate limit|too many/i.test(texto)) return 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (/password.*(6|characters|short)/i.test(texto)) return 'La contraseña debe tener al menos 8 caracteres.';
  return MENSAJES[texto] ?? texto;
};

export async function crearAuth(config = globalThis.window?.PORTAL_CONFIG ?? {}) {
  if (config.adaptador !== 'supabase') return null;
  const db = await obtenerCliente(config);

  async function perfilDe(usuario) {
    if (!usuario) return null;
    const { data } = await db.from('perfiles').select('*').eq('id', usuario.id).maybeSingle();
    return {
      id: usuario.id,
      correo: usuario.email,
      nombre: data?.nombre || usuario.email,
      rol: data?.rol ?? 'visitante',
      escuela_id: data?.escuela_id ?? null,
      oferente_id: data?.oferente_id ?? null
    };
  }

  return {
    async usuarioActual() {
      const { data } = await db.auth.getSession();
      return perfilDe(data.session?.user ?? null);
    },

    async entrar(correo, clave) {
      const { data, error } = await db.auth.signInWithPassword({ email: correo, password: clave });
      if (error) throw new Error(traducir(error));
      return perfilDe(data.user);
    },

    async salir() {
      await db.auth.signOut();
    },

    /** Manda el correo para elegir una contraseña nueva. */
    async recuperar(correo) {
      const vuelta = `${location.origin}${location.pathname}`;
      const { error } = await db.auth.resetPasswordForEmail(correo, { redirectTo: vuelta });
      if (error) throw new Error(traducir(error));
    },

    async nuevaClave(clave) {
      const { error } = await db.auth.updateUser({ password: clave });
      if (error) throw new Error(traducir(error));
    },

    /**
     * fn(evento, perfil). Eventos que importan: SIGNED_IN, SIGNED_OUT y
     * PASSWORD_RECOVERY (la persona llegó desde el correo de recuperación).
     */
    alCambiar(fn) {
      const { data } = db.auth.onAuthStateChange((evento, sesion) => {
        // El aviso llega dentro del cerrojo de la librería: se difiere la
        // consulta del perfil para no trabarla.
        setTimeout(async () => fn(evento, await perfilDe(sesion?.user ?? null)), 0);
      });
      return () => data.subscription.unsubscribe();
    }
  };
}
