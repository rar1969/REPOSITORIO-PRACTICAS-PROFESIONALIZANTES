/**
 * Prueba de integración de la fase 2: el portal completo con el adaptador de
 * Supabase, contra un Postgres real con las políticas de seguridad activas.
 *
 *   npm install jsdom @electric-sql/pglite
 *   node pruebas/fase2-integracion.mjs
 *
 * Se carga index.html en jsdom con `adaptador: 'supabase'` y se reemplaza el
 * cliente de Supabase por uno simulado (pruebas/apoyo/supabase-simulado.mjs)
 * que ejecuta cada consulta en PGlite con el rol de quien inició sesión. Así
 * se prueba lo que de verdad importa en esta fase: que el ingreso funcione y
 * que la base, no el navegador, decida qué ve cada uno.
 */

import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { crearBase, crearCuenta, crearCliente } from './apoyo/supabase-simulado.mjs';

/* ------------------------------------------------- base, cuentas y cliente */
// Antes de instalar jsdom: PGlite necesita el Blob de Node, no el del navegador simulado.

const db = await crearBase();
const cuentas = new Map();
const ADMIN = { id: '00000000-0000-0000-0000-0000000000a1', correo: 'direccion@ejemplo.com', clave: 'clave-segura-1', rol: 'admin', nombre: 'Coordinación PP' };
const SIN_ROL = { id: '00000000-0000-0000-0000-0000000000b2', correo: 'nuevo@ejemplo.com', clave: 'clave-segura-2', rol: 'visitante' };
await crearCuenta(db, cuentas, ADMIN);
await crearCuenta(db, cuentas, SIN_ROL);
const cliente = crearCliente(db, cuentas);
const comoDueño = async (consulta, params) => (await db.query(consulta, params)).rows;

const raiz = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', raiz), 'utf8').replace(/<script\b[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/portal/' });
const { window } = dom;

const errores = [];
const consolaOriginal = console.error;
console.error = (...args) => errores.push(args.map(String).join(' '));
console.warn = () => {};
console.info = () => {};

Object.assign(globalThis, {
  window, document: window.document, location: window.location,
  localStorage: window.localStorage, Node: window.Node, HTMLElement: window.HTMLElement,
  Event: window.Event, File: window.File, Blob: window.Blob
});
window.PORTAL_CONFIG = { adaptador: 'supabase', supabase: { url: 'https://simulado.supabase.co', clave: 'publica' } };
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false });
window.HTMLElement.prototype.scrollIntoView = () => {};
window.confirm = () => true;
const abiertos = [];
window.open = url => { abiertos.push(url); return null; };

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const espera = (ms = 60) => new Promise(r => setTimeout(r, ms));
const visible = id => $(`#view-${id}`).style.display === 'block';
const ultimoAviso = () => $('#toast-container')?.lastElementChild?.textContent ?? '';
const enviar = async (id, ms) => {
  $(id).dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await espera(ms ?? 150);
};
const clic = async (nodo, ms = 120) => { nodo.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await espera(ms); };

let fallas = 0;
const ok = (etiqueta, condicion) => {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${etiqueta}`);
};

const { establecerCliente } = await import('../js/services/supabase.js');
establecerCliente(cliente);
const { iniciar } = await import('../js/core/index.js');
await iniciar();
await espera(300);

/* ------------------------------------------------------------- visitante */

console.log('\nVisitante, sin sesión');
ok('el desplegable de demostración desaparece', !$('#role-select'));
ok('aparece el botón "Ingresar"', Boolean($('#btn-ingresar')));
ok('la portada lee los indicadores de la base', $('#kpi-escuelas').textContent === '39');
await clic($('[data-view=directorio]'), 250);
ok('el directorio trae los oferentes desde la base', $$('#grid-oferentes .card-oferente').length === 4);
$('#filter-search').value = 'TORNERIA';
$('#filter-search').dispatchEvent(new window.Event('input'));
await espera(500);
ok('el filtro de texto ignora mayúsculas y tildes en el servidor',
  $$('#grid-oferentes .card-oferente').length === 1);
window.location.hash = '#/admin';
await espera(200);
ok('#/admin sin sesión vuelve al inicio', visible('inicio'));

await clic($('[data-open-modal=oferente]'));
$('#oferente-razon').value = 'Taller Visitante S.R.L.';
$('#oferente-cuit').value = '20-12345678-6';
$('#oferente-dept').value = 'Simoca';
$('#oferente-spec').value = 'Automotores';
$('#oferente-contacto').value = 'Encargado';
$('#oferente-correo').value = 'taller@ejemplo.com';
await enviar('#form-oferente', 300);
const enviada = await comoDueño(`select * from solicitudes where titulo = 'Taller Visitante S.R.L.'`);
ok('un visitante envía "Quiero ser oferente" y llega a la base', enviada.length === 1 && enviada[0].estado === 'Pendiente');
ok('con número asignado por la base', enviada[0]?.id === 'SOL-TUC-102');
ok('el aviso confirma el envío', ultimoAviso().includes('Solicitud enviada'));

await clic($('[data-view=repositorio]'), 250);
const ley = $$('#doc-list .doc-item').find(d => d.textContent.includes('26.058'));
await clic(ley.querySelector('.doc-action-btn'), 250);
ok('abrir la ley suma la consulta en la base (sin permiso de edición)',
  (await comoDueño(`select descargas from documentos where id = 'DOC-TUC-001'`))[0].descargas === 1);
ok('y abre el texto oficial', abiertos.at(-1)?.includes('argentina.gob.ar'));

/* --------------------------------------------------------------- ingreso */

console.log('\nIngreso');
await clic($('#btn-ingresar'));
ok('"Ingresar" abre el formulario', $('#modal-ingresar').classList.contains('active'));
$('#ingresar-correo').value = ADMIN.correo;
$('#ingresar-clave').value = 'equivocada';
await enviar('#form-ingresar', 250);
ok('una contraseña equivocada se rechaza con un mensaje claro', ultimoAviso().includes('Correo o contraseña incorrectos'));
ok('y no muestra el panel', $('#nav-btn-admin').style.display === 'none');

$('#ingresar-clave').value = ADMIN.clave;
await enviar('#form-ingresar', 300);
ok('con la contraseña correcta entra como administrador', $('#nav-btn-admin').style.display === 'flex');
ok('el encabezado muestra quién ingresó', $('#zona-sesion').textContent.includes('Coordinación PP'));
ok('el formulario se cerró', !$('#modal-ingresar').classList.contains('active'));

await clic($('#nav-btn-admin'), 400);
ok('entra al panel', visible('admin'));
const filas = $$('#admin-queue-table tr');
ok('la bandeja lee las solicitudes que el visitante no podía ver',
  filas.some(tr => tr.textContent.includes('Taller Visitante')));
await clic(filas.find(tr => tr.textContent.includes('Taller Visitante')).querySelector('.btn-approve'), 400);
const aprobada = (await comoDueño(`select * from solicitudes where id = 'SOL-TUC-102'`))[0];
ok('aprobar queda en la base con fecha y responsable', aprobada.estado === 'Aprobada' && Boolean(aprobada.fecha_cierre));
const auditada = await comoDueño(`select autor from auditoria where registro = 'SOL-TUC-102' and accion = 'UPDATE'`);
ok('y en la auditoría, con el usuario que la aprobó', auditada[0]?.autor === ADMIN.id);

await clic($('[data-admin-tab=alumnos]'), 300);
$('#alu-nombre').value = 'Practicante Real de Prueba';
$('#alu-dni').value = '48.123.456';
$('#alu-escuela').value = $('#alu-escuela').options[1].value;
$('#alu-spec').value = 'Electrónica';
await enviar('#form-add-alumno', 400);
ok('cargar un practicante lo guarda en la base',
  (await comoDueño(`select count(*)::int n from estudiantes where dni = '48.123.456'`))[0].n === 1);

await clic($('[data-view=repositorio]'), 300);
await clic($('#btn-admin-subir-doc'));
const archivo = new window.File(['%PDF'], 'Acta modelo 2026.pdf', { type: 'application/pdf' });
Object.defineProperty($('#upload-doc-file'), 'files', { value: [archivo], configurable: true });
$('#upload-doc-title').value = 'Acta acuerdo modelo 2026';
$('#upload-doc-cat').value = 'Convenios';
$('#upload-doc-version').value = 'v1';
await enviar('#form-subir-doc', 500);
const subido = (await comoDueño(`select * from documentos where titulo = 'Acta acuerdo modelo 2026'`))[0];
ok('subir un documento guarda el archivo y su URL permanente',
  cliente.subidas.length === 1 && subido?.url?.includes('/storage/v1/object/public/documentos/') &&
  subido.archivo_en_sesion === false);
ok('y aparece en el repositorio', $('#doc-list').textContent.includes('Acta acuerdo modelo 2026'));

/* --------------------------------------------------------------- salida */

console.log('\nSalida y cuenta sin rol');
await clic([...$$('#zona-sesion button')].find(b => b.textContent.includes('Salir')), 300);
ok('"Salir" vuelve a visitante y oculta el panel', $('#nav-btn-admin').style.display === 'none' && Boolean($('#btn-ingresar')));
ok('y si estaba en el panel, lo saca', !visible('admin'));

await clic($('#btn-ingresar'));
$('#ingresar-correo').value = SIN_ROL.correo;
$('#ingresar-clave').value = SIN_ROL.clave;
await enviar('#form-ingresar', 300);
ok('una cuenta sin rol entra, pero como visitante', $('#nav-btn-admin').style.display === 'none');
ok('y se le explica que pida el rol', $$('#toast-container > div').some(d => d.textContent.includes('no tiene un rol asignado')));

const { api } = await import('../js/services/api.js');
const alumnos = await api.listar('estudiantes', { porPagina: 0 });
ok('aunque pida estudiantes a mano, la base no le devuelve ninguno', alumnos.total === 0);
let rechazo = null;
try { await api.actualizar('oferentes', 'OFER-TUC-001', { cupos_disponibles: 99 }); } catch (e) { rechazo = e; }
ok('y si intenta modificar un oferente, se rechaza con un mensaje claro', rechazo?.message.includes('no tiene permiso'));
ok('el oferente no cambió',
  (await comoDueño(`select cupos_disponibles from oferentes where id = 'OFER-TUC-001'`))[0].cupos_disponibles !== 99);

console.error = consolaOriginal;
ok(`sin errores en consola${errores.length ? `: ${errores[0]}` : ''}`, errores.length === 0);

await db.close();
console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas === 0 ? 0 : 1);
