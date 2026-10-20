/**
 * core/registro — catálogo de módulos de funcionalidad.
 *
 * El núcleo trata a cada módulo como una caja negra: sabe su ruta, su título y
 * cómo montarlo y desmontarlo, y nada más. Agregar un módulo nuevo es
 * registrarlo acá; no se toca ningún módulo existente.
 */

const modulos = new Map();   // id → módulo

/**
 * Contrato que todo módulo cumple:
 *
 *   {
 *     id: 'casos',
 *     ruta: '/casos',
 *     titulo: 'Casos Exitosos',
 *     icono: 'fa-award',
 *     roles: ['visitante', …],          // quién lo ve; [] o ausente = todos
 *     contenedor: '#grid-casos',        // dónde se dibuja
 *     async montar(contenedor, ctx) {}, // ctx = { api, emitir, escuchar, ir }
 *     desmontar() {}                    // liberar oyentes, mapas, temporizadores
 *   }
 *
 * Un módulo `persistente: true` no tiene ruta: se monta una sola vez al
 * arrancar y queda vivo. Es para lo que se abre desde cualquier vista —los
 * formularios "Quiero ser oferente", la ficha de un oferente, la carga de un
 * documento— y responde a eventos del bus, no a la URL.
 */
export function registrar(modulo) {
  const obligatorios = modulo?.persistente ? ['id', 'montar'] : ['id', 'ruta', 'montar'];
  for (const campo of obligatorios) {
    if (!modulo?.[campo]) throw new Error(`Módulo sin "${campo}": ${JSON.stringify(modulo?.id)}`);
  }
  if (modulos.has(modulo.id)) throw new Error(`Módulo duplicado: ${modulo.id}`);
  modulos.set(modulo.id, modulo);
  return modulo;
}

export const obtener = id => modulos.get(id) ?? null;
export const registrados = () => [...modulos.values()];
export const persistentes = () => registrados().filter(m => m.persistente);
export const tieneModulo = id => modulos.has(id);

/** ¿Este rol puede ver este módulo? Sin `roles` declarados, lo ve cualquiera. */
export function visiblePara(modulo, rol) {
  if (!modulo.roles || modulo.roles.length === 0) return true;
  return modulo.roles.includes(String(rol || '').toLowerCase());
}
