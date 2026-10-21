/**
 * modules/certificados/coincidencias — reconoce lo que se tipea o viene de una
 * planilla y lo lleva a los registros del portal: escuelas, especialidades y
 * capacitaciones escritas de mil maneras ("Escuela Técnica Nº 1 Juan Bautista
 * Alberdi" es "Escuela Técnica N° 1 Juan B. Alberdi").
 *
 * Sin DOM ni base: funciones puras, probadas en pruebas/certificados.mjs.
 */

export const sinTildes = texto =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const palabras = texto => sinTildes(texto)
  .replace(/n[°ºo.]+\s*(?=\d)/g, ' ')          // "Nº 1", "N° 1", "N.° 1" → "1"
  .replace(/[^a-z0-9ñ]+/g, ' ')
  .split(' ')
  .filter(p => p && !VACIAS.has(p));
const VACIAS = new Set(['escuela', 'tecnica', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'n', 'nro', 'et']);

/** Escuela del catálogo que mejor coincide con un nombre libre, o null. */
export function buscarEscuela(texto, escuelas) {
  const buscadas = palabras(texto);
  if (!buscadas.length) return null;
  const numero = buscadas.find(p => /^\d+$/.test(p));
  let mejor = null;
  let mejorPuntaje = 0;
  for (const escuela of escuelas) {
    const propias = palabras(escuela.nombre).concat(palabras(escuela.localidad));
    const numeroPropio = propias.find(p => /^\d+$/.test(p));
    if (numero && numeroPropio && numero !== numeroPropio) continue;
    // Una palabra coincide entera, o por su inicial si viene abreviada ("B." de Bautista).
    const coincide = p => propias.some(q => q === p || (p.length === 1 && q.startsWith(p)) || (q.length === 1 && p.startsWith(q)));
    const puntaje = buscadas.filter(coincide).length / buscadas.length;
    if (puntaje > mejorPuntaje) { mejor = escuela; mejorPuntaje = puntaje; }
  }
  return mejorPuntaje >= 0.6 ? mejor : null;
}

const SIGLAS = { mmo: 'maestro mayor de obras', 'm.m.o.': 'maestro mayor de obras' };

/**
 * Especialidad del catálogo para un texto libre: "Tecnico en informática
 * Personal y Profesional" → "Informática"; "Electromecánico" → "Electromecánica".
 */
export function buscarEspecialidad(texto, especialidades) {
  const t = sinTildes(texto);
  if (!t) return null;
  const exacta = especialidades.find(e => sinTildes(e) === (SIGLAS[t] ?? t));
  if (exacta) return exacta;
  const candidatas = especialidades.filter(e => {
    const clave = sinTildes(e);
    return t.includes(clave.slice(0, Math.max(6, clave.length - 2))) || (t.length >= 5 && clave.includes(t));
  });
  // Si hay más de una (raro), la más larga es la más específica.
  return candidatas.sort((a, b) => b.length - a.length)[0] ?? null;
}

const clave = texto => sinTildes(texto).replace(/[^a-z0-9ñ]+/g, ' ').trim();

/** Capacitación con el mismo título (sin importar tildes, mayúsculas ni signos). */
export function buscarCapacitacion(titulo, capacitaciones) {
  const t = clave(titulo);
  return t ? capacitaciones.find(c => clave(c.titulo) === t) ?? null : null;
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);

/** "PÉREZ GÓMEZ" o "pérez gómez" → "Pérez Gómez". Lo que ya viene bien, no se toca. */
export function nombrePropio(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t || (t !== t.toUpperCase() && t !== t.toLowerCase())) return t;
  return t.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** DNI con o sin puntos → solo dígitos; null si queda vacío. Error si no es un DNI. */
export function limpiarDni(texto) {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return null;
  const digitos = crudo.replace(/[.\s-]/g, '');
  if (!/^\d{7,8}$/.test(digitos)) throw new Error(`El DNI "${crudo}" no tiene 7 u 8 números.`);
  return digitos;
}

/** ¿Es la misma persona? Compara apellido y nombre sin tildes ni mayúsculas. */
export const mismaPersona = (a, b) =>
  clave(`${a.apellido} ${a.nombre}`) === clave(`${b.apellido} ${b.nombre}`);
