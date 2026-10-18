/**
 * Pruebas de los módulos de funcionalidad, sin navegador.
 *   node pruebas/modulos.mjs
 *
 * Monta un DOM mínimo —lo justo que usan `ui/dom` y los módulos— y corre el
 * `montar()` real de cada uno contra los datos reales de /data. No reemplaza
 * mirar el portal en el navegador, pero atrapa lo que más duele: que un módulo
 * no dibuje nada, o que dibuje algo distinto de lo que dicen los datos.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/* --------------------------------------------------------------- DOM mínimo */

class Nodo {
  constructor(etiqueta) {
    this.etiqueta = etiqueta;
    this.hijos = [];
    this.atributos = {};
    this.dataset = {};
    this.style = {};
    this.oyentes = {};
    this.className = '';
  }
  append(...nodos) { this.hijos.push(...nodos); }
  replaceChildren(...nodos) { this.hijos = [...nodos]; }
  setAttribute(k, v) { this.atributos[k] = String(v); }
  addEventListener(tipo, fn) { (this.oyentes[tipo] ||= []).push(fn); }
  get textContent() {
    return this.hijos.map(h => (h instanceof Nodo ? h.textContent : String(h.texto ?? h))).join('');
  }
  set textContent(v) { this.hijos = [{ texto: v }]; }
  /** Todos los descendientes con esa etiqueta. */
  todos(etiqueta) {
    return this.hijos.flatMap(h =>
      h instanceof Nodo ? [...(h.etiqueta === etiqueta ? [h] : []), ...h.todos(etiqueta)] : []);
  }
  get clases() { return (this.className || '').split(/\s+/).filter(Boolean); }
}

globalThis.Node = Nodo;
globalThis.document = {
  createElement: e => new Nodo(e),
  createTextNode: t => ({ texto: t })
};

/* ------------------------------------------------------- api sobre archivos */

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
const { registrar, obtener, registrados, visiblePara } = await import('../js/core/registro.js');
const { emitir, escuchar, olvidar } = await import('../js/core/bus.js');
const casos = (await import('../js/modules/casos/index.js')).default;
const capacitaciones = (await import('../js/modules/capacitaciones/index.js')).default;

let fallas = 0;
const ok = (etiqueta, condicion) => {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${etiqueta}`);
};

const ctx = { api, emitir, escuchar, ir: () => {} };

/* ------------------------------------------------------------------ pruebas */

console.log('\nContrato de módulo');
for (const m of [casos, capacitaciones]) {
  ok(`"${m.id}" declara ruta, contenedor, montar y desmontar`,
    Boolean(m.ruta && m.contenedor && typeof m.montar === 'function' && typeof m.desmontar === 'function'));
}
registrar(casos); registrar(capacitaciones);
ok('el registro acepta los dos módulos', registrados().length === 2 && Boolean(obtener('casos')));
let duplicado = false;
try { registrar(casos); } catch { duplicado = true; }
ok('un id repetido es rechazado', duplicado);
ok('sin roles declarados, lo ve cualquiera', visiblePara(casos, 'visitante'));

console.log('\nMódulo casos');
const cont1 = new Nodo('div');
await casos.montar(cont1, ctx);
const { items: datosCasos } = await api.listar('casos', { porPagina: 0 });
ok(`dibuja una tarjeta por caso (${datosCasos.length})`, cont1.hijos.length === datosCasos.length);
ok('cada tarjeta lleva el título de su caso',
  datosCasos.every(c => cont1.textContent.includes(c.titulo)));
ok('muestra la escuela y la empresa',
  cont1.textContent.includes(datosCasos[0].escuela) && cont1.textContent.includes(datosCasos[0].empresa));

console.log('\nMódulo capacitaciones');
const cont2 = new Nodo('div');
await capacitaciones.montar(cont2, ctx);
const { items: datosCap } = await api.listar('capacitaciones', { porPagina: 0 });
ok(`dibuja una tarjeta por capacitación (${datosCap.length})`, cont2.hijos.length === datosCap.length);
ok('las "En Curso" van primero',
  cont2.hijos[0].textContent.includes('En Curso'));
ok('la completada va al final',
  cont2.hijos[cont2.hijos.length - 1].textContent.includes('Completada'));

console.log('\nSin datos no rompe');
const vacia = { listar: async () => ({ items: [], total: 0 }) };
const cont3 = new Nodo('div');
await casos.montar(cont3, { ...ctx, api: vacia });
ok('muestra un mensaje en lugar de una grilla vacía',
  cont3.hijos.length === 1 && cont3.textContent.includes('Todavía no hay'));

console.log('\nNada de innerHTML: el texto se escapa solo');
const cont4 = new Nodo('div');
const malicioso = {
  listar: async () => ({ items: [{ id: 'X', titulo: '<img src=x onerror=alert(1)>', escuela: 'E',
    empresa: 'F', especialidad: 'Q', localidad: 'L', departamento: 'D', cantidad_estudiantes: 1 }], total: 1 })
};
await casos.montar(cont4, { ...ctx, api: malicioso });
const titulo = cont4.todos('h3')[0];
ok('una etiqueta en el dato queda como texto, no como nodo',
  titulo.hijos.length === 1 && titulo.hijos[0].texto === '<img src=x onerror=alert(1)>');

console.log('\nBus de eventos');
let recibido = null;
const cortar = escuchar('caso:replicar', id => { recibido = id; });
const boton = cont1.todos('button').find(b => b.textContent.includes('replicar'));
boton.oyentes.click[0]();
ok('el botón de réplica emite su caso por el bus', recibido === datosCasos[0].id);
cortar();
emitir('caso:replicar', 'OTRO');
ok('desuscribirse corta el aviso', recibido === datosCasos[0].id);
let siguioVivo = false;
escuchar('x', () => { throw new Error('oyente roto'); });
escuchar('x', () => { siguioVivo = true; });
emitir('x');
ok('un oyente que falla no frena a los demás', siguioVivo);
olvidar();

console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas === 0 ? 0 : 1);
