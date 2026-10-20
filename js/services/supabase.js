/**
 * services/supabase — el cliente de Supabase, uno solo para todo el portal.
 *
 * Lo comparten el adaptador de datos y el servicio de autenticación: así la
 * sesión que abre una persona es la misma con la que se leen y escriben los
 * datos, y la base aplica los permisos de su rol.
 *
 * La librería se descarga recién cuando el portal está configurado con
 * `adaptador: 'supabase'`. En modo estático no pesa nada.
 *
 * La clave que va en PORTAL_CONFIG es la pública ("anon"): está pensada para
 * vivir en el navegador. Lo que protege los datos son las políticas de la base
 * (supabase/migraciones/001_esquema.sql), no que la clave sea secreta. La
 * clave "service_role" NO debe ponerse nunca en el portal.
 */

const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let clientePrometido = null;

export function obtenerCliente(config = globalThis.window?.PORTAL_CONFIG ?? {}) {
  if (clientePrometido) return clientePrometido;

  const { url, clave } = config.supabase ?? {};
  if (!url || !clave) {
    return Promise.reject(new Error(
      'Falta configurar Supabase: PORTAL_CONFIG.supabase necesita "url" y "clave" (la clave pública anon).'
    ));
  }

  clientePrometido = import(/* @vite-ignore */ LIBRERIA).then(({ createClient }) =>
    createClient(url, clave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE devuelve ?code= en lugar de #access_token=: no pisa el ruteo por hash.
        flowType: 'pkce'
      }
    })
  ).catch(error => {
    clientePrometido = null;   // permite reintentar si vuelve la conexión
    throw error;
  });
  return clientePrometido;
}

/** Solo para pruebas: reemplaza el cliente por un doble. */
export function establecerCliente(cliente) {
  clientePrometido = Promise.resolve(cliente);
}
