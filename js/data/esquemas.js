/**
 * Catálogo de colecciones del portal.
 *
 * Única fuente de verdad sobre qué colecciones existen, de qué archivo salen,
 * cómo se generan sus identificadores y sobre qué campos busca el texto libre.
 * Tanto el adaptador estático como el futuro adaptador de base de datos leen
 * de acá: agregar una colección es agregar una entrada, no tocar código.
 */

export const ESQUEMAS = {
  especialidades: {
    archivo: 'especialidades.json',
    tipo: 'lista',            // arreglo de strings, sin identificador propio
    cacheable: true
  },

  escuelas: {
    archivo: 'escuelas.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'ESC-',
    relleno: 2,
    buscables: ['nombre', 'localidad', 'departamento', 'direccion'],
    cacheable: true,          // cambian poco: se cachean en el cliente
    // Se genera desde data/escuelas.csv: no editar el JSON a mano.
    // node herramientas/escuelas-desde-csv.mjs --escribir
    origen: 'escuelas.csv'
  },

  oferentes: {
    archivo: 'oferentes.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'OFER-TUC-',
    relleno: 3,
    buscables: ['razon_social', 'localidad', 'departamento', 'perfiles_requeridos']
  },

  estudiantes: {
    archivo: 'estudiantes.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'ALU-',
    relleno: 2,
    buscables: ['nombre', 'escuela'],
    // Datos personales de menores de edad. En fase 2 esta colección deja de
    // servirse como JSON público y pasa a requerir sesión (ver SDD §9).
    sensible: true
  },

  capacitaciones: {
    archivo: 'capacitaciones.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'CAP-',
    relleno: 2,
    buscables: ['titulo', 'organismo', 'destinatarios']
  },

  documentos: {
    archivo: 'documentos.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'DOC-TUC-',
    relleno: 3,
    buscables: ['titulo', 'descripcion', 'categoria', 'organismo']
  },

  casos: {
    archivo: 'casos.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'CASO-TUC-',
    relleno: 3,
    buscables: ['titulo', 'escuela', 'empresa', 'especialidad', 'problematica']
  },

  solicitudes: {
    archivo: 'solicitudes.json',
    tipo: 'coleccion',
    clave: 'id',
    prefijo: 'SOL-TUC-',
    relleno: 3,
    buscables: ['titulo', 'solicitante', 'departamento']
  },

  departamentos: {
    archivo: 'departamentos.json',
    tipo: 'lista',            // los 17 de Tucumán; valida filtros y altas
    cacheable: true
  }
};

/** Nombres de colección válidos. */
export const COLECCIONES = Object.keys(ESQUEMAS);

/** Devuelve el esquema de una colección o lanza si el nombre no existe. */
export function esquemaDe(coleccion) {
  const esquema = ESQUEMAS[coleccion];
  if (!esquema) {
    throw new Error(
      `Colección desconocida: "${coleccion}". Válidas: ${COLECCIONES.join(', ')}`
    );
  }
  return esquema;
}
