/**
 * core/bus — bus de eventos del núcleo.
 *
 * Es lo que permite que los módulos no se importen entre sí. Cuando el mapa
 * necesita abrir la ficha de un oferente, no llama al directorio: emite
 * `oferente:ver` y sigue con lo suyo. Si el directorio está cargado, responde;
 * si no, no pasa nada. Esa indiferencia es la que hace que cada módulo se pueda
 * quitar, probar o reescribir solo.
 */

const suscriptores = new Map();   // evento → Set de funciones

/** Suscribe una función a un evento. Devuelve la función para desuscribirse. */
export function escuchar(evento, fn) {
  if (!suscriptores.has(evento)) suscriptores.set(evento, new Set());
  suscriptores.get(evento).add(fn);
  return () => suscriptores.get(evento)?.delete(fn);
}

/** Emite un evento. Un oyente que falla no interrumpe a los demás. */
export function emitir(evento, datos) {
  for (const fn of suscriptores.get(evento) ?? []) {
    try {
      fn(datos);
    } catch (error) {
      console.error(`[bus] Error en un oyente de "${evento}".`, error);
    }
  }
}

/** Quita todos los oyentes de un evento, o todos los del bus. */
export function olvidar(evento) {
  if (evento) suscriptores.delete(evento);
  else suscriptores.clear();
}
