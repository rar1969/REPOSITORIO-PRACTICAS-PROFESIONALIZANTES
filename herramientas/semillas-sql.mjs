/**
 * Genera supabase/semillas.sql a partir de los archivos de data/.
 *
 *   node herramientas/semillas-sql.mjs
 *
 * El SQL resultante se pega en el editor SQL de Supabase. Se puede correr las
 * veces que haga falta: inserta lo que falta y actualiza lo que existe
 * ("upsert"), sin borrar lo que la Dirección cargó desde el portal. Es el
 * camino para llevar a la base una corrección de data/escuelas.csv:
 *
 *   node herramientas/escuelas-desde-csv.mjs --escribir
 *   node herramientas/semillas-sql.mjs
 *   → pegar semillas.sql en Supabase
 *
 * Con --sin-ejemplos deja afuera los registros marcados `ejemplo: true`.
 */

import fs from 'node:fs';

const raiz = new URL('../', import.meta.url);
const leer = archivo => JSON.parse(fs.readFileSync(new URL(`data/${archivo}`, raiz), 'utf8'));
const sinEjemplos = process.argv.includes('--sin-ejemplos');

// Columnas date: en los JSON una fecha ausente es "", en la base es null.
const FECHAS = new Set(['fecha', 'fecha_inicio', 'fecha_vencimiento', 'fecha_fin',
                        'fecha_actualizacion', 'fecha_cierre']);
const JSONB = new Set(['alumnos_por_especialidad']);

const texto = v => `'${String(v).replace(/'/g, "''")}'`;

function valor(campo, v) {
  if (v === null || v === undefined) return 'null';
  if (FECHAS.has(campo)) return v === '' ? 'null' : texto(v);
  if (JSONB.has(campo)) return `${texto(JSON.stringify(v))}::jsonb`;
  if (Array.isArray(v)) return v.length ? `array[${v.map(texto).join(', ')}]::text[]` : `'{}'::text[]`;
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return texto(v);
}

function upsert(tabla, filas, clave = 'id') {
  const visibles = sinEjemplos ? filas.filter(f => !f.ejemplo) : filas;
  if (visibles.length === 0) return `-- ${tabla}: sin filas\n`;
  const columnas = [...new Set(visibles.flatMap(Object.keys))];
  // Un campo ausente en una fila toma el valor por defecto de la columna,
  // no null: así un registro sin "ejemplo" queda como no-ejemplo.
  const valores = visibles.map(f =>
    `  (${columnas.map(c => (c in f ? valor(c, f[c]) : 'default')).join(', ')})`);
  const actualizar = columnas.filter(c => c !== clave).map(c => `${c} = excluded.${c}`);
  return [
    `insert into public.${tabla} (${columnas.join(', ')}) values`,
    valores.join(',\n'),
    actualizar.length
      ? `on conflict (${clave}) do update set\n  ${actualizar.join(',\n  ')};`
      : `on conflict (${clave}) do nothing;`,
    ''
  ].join('\n');
}

/** Lleva cada secuencia más allá del último número usado. */
const secuencia = (tabla, prefijo) =>
  `select setval('public.${tabla}_seq', greatest(coalesce((select max(substring(id from ${prefijo.length + 1})::int) ` +
  `from public.${tabla} where id ~ '^${prefijo}[0-9]+$'), 0), ` +
  `(select last_value from public.${tabla}_seq)), true);\n`;

const resoluciones = leer('especialidades-resoluciones.json');
const especialidades = leer('especialidades.json').map(nombre => ({
  nombre, resolucion: resoluciones[nombre] ?? null
}));

const partes = [
  '-- Generado por herramientas/semillas-sql.mjs — no editar a mano.',
  `-- ${new Date().toISOString().slice(0, 10)}${sinEjemplos ? ' · sin registros de ejemplo' : ''}`,
  'begin;',
  '',
  upsert('departamentos', leer('departamentos.json').map(nombre => ({ nombre })), 'nombre'),
  upsert('especialidades', especialidades, 'nombre'),
  upsert('escuelas', leer('escuelas.json')),
  upsert('oferentes', leer('oferentes.json')),
  upsert('capacitaciones', leer('capacitaciones.json')),
  upsert('documentos', leer('documentos.json')),
  upsert('casos', leer('casos.json')),
  upsert('estudiantes', leer('estudiantes.json')),
  upsert('solicitudes', leer('solicitudes.json')),
  secuencia('escuelas', 'ESC-'),
  secuencia('oferentes', 'OFER-TUC-'),
  secuencia('estudiantes', 'ALU-'),
  secuencia('capacitaciones', 'CAP-'),
  secuencia('documentos', 'DOC-TUC-'),
  secuencia('casos', 'CASO-TUC-'),
  secuencia('solicitudes', 'SOL-TUC-'),
  'commit;',
  ''
];

const destino = new URL('supabase/semillas.sql', raiz);
fs.writeFileSync(destino, partes.join('\n'));
console.log(`Escrito ${destino.pathname.split('/').slice(-2).join('/')} ` +
  `(${fs.statSync(destino).size.toLocaleString('es-AR')} bytes).`);
