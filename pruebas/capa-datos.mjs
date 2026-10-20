/**
 * Pruebas de la capa de datos, sin navegador.
 *   node pruebas/capa-datos.mjs
 *
 * Reemplaza fetch y localStorage por equivalentes de escritorio y ejercita el
 * contrato de services/api contra los JSON reales de /data.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const almacen = new Map();
globalThis.localStorage = {
  getItem: k => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: k => almacen.delete(k)
};
globalThis.fetch = async url => {
  const ruta = fileURLToPath(url);
  if (!fs.existsSync(ruta)) return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(ruta, 'utf8')) };
};
globalThis.window = { PORTAL_CONFIG: { adaptador: 'estatico' } };

const { api } = await import('../js/services/api.js');

let fallas = 0;
const ok = (etiqueta, condicion) => {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${etiqueta}`);
};

console.log('\nLectura');
const escuelas = await api.listar('escuelas', { porPagina: 0 });
ok('39 escuelas', escuelas.total === 39);
const pagina = await api.listar('escuelas', { pagina: 2, porPagina: 10 });
ok('paginado', pagina.items.length === 10 && pagina.total === 39);
const capital = await api.listar('escuelas', { filtros: { departamento: 'Capital' }, porPagina: 0 });
ok('filtro por campo simple', capital.items.every(e => e.departamento === 'Capital'));
const info = await api.listar('escuelas', { filtros: { especialidades: 'Informática' }, porPagina: 0 });
ok('filtro sobre campo de tipo arreglo', info.items.every(e => e.especialidades.includes('Informática')));
const libre = await api.listar('oferentes', { filtros: { q: 'citricola' }, porPagina: 0 });
ok('búsqueda libre, tildes al margen', libre.total === 1);
const orden = await api.listar('escuelas', { orden: '-alumnos_7mo', porPagina: 3 });
ok('orden descendente', orden.items[0].alumnos_7mo >= orden.items[2].alumnos_7mo);
const deptos = await api.listar('departamentos', { porPagina: 0 });
ok('17 departamentos', deptos.total === 17);
const todas = (await api.listar('escuelas', { porPagina: 0 })).items;
ok('toda escuela ubicada declara su precisión', todas.every(e => e.lat === null || e.precision));
ok('ninguna escuela quedó dada por verificada', todas.every(e => e.verificado === false));
const septimo = todas.reduce((t, e) => t + (e.alumnos_7mo || 0), 0);
ok(`matrícula de 7mo cargada (${septimo})`, septimo > 1000);

console.log('\nEscritura');
// Las cuentas salen del archivo de origen: cambiar los datos no rompe la prueba.
const origen = (await api.listar('oferentes', { porPagina: 0 })).items;
const cuposOriginales = origen[0].cupos_disponibles;
const siguiente = `OFER-TUC-${String(origen.length + 1).padStart(3, '0')}`;
const nuevo = await api.crear('oferentes', { razon_social: 'Prueba S.A.', departamento: 'Capital' });
ok(`identificador correlativo (${nuevo.id})`, nuevo.id === siguiente);
await api.actualizar('oferentes', 'OFER-TUC-001', { cupos_disponibles: 99 });
ok('modificación sobre dato de origen', (await api.obtener('oferentes', 'OFER-TUC-001')).cupos_disponibles === 99);
await api.eliminar('oferentes', nuevo.id);
ok('baja de lo creado', (await api.obtener('oferentes', nuevo.id)) === null);
await api.eliminar('oferentes', 'OFER-TUC-002');
ok('baja de dato de origen', (await api.listar('oferentes', { porPagina: 0 })).total === origen.length - 1);

console.log('\nRestablecer');
await api.restablecer();
ok(`vuelve a ${origen.length} oferentes`, (await api.listar('oferentes', { porPagina: 0 })).total === origen.length);
ok('vuelve el valor original', (await api.obtener('oferentes', 'OFER-TUC-001')).cupos_disponibles === cuposOriginales);

console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas === 0 ? 0 : 1);
