/**
 * Prueba de integración: el portal completo sobre el index.html real.
 *
 *   npm install jsdom        (una sola vez, fuera del repositorio si se prefiere)
 *   node pruebas/integracion.mjs
 *
 * A diferencia de pruebas/modulos.mjs, acá no hay un DOM de juguete: se carga
 * index.html en jsdom, se arranca core/ como lo haría el navegador y se usa el
 * portal como una persona —clics, formularios, cambio de rol, recarga—.
 * Es la verificación de la compuerta de la fase 1: el portal hace lo mismo que
 * antes, sin app.js.
 *
 * El mapa queda afuera: necesita Leaflet y teselas, que jsdom no descarga.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const raiz = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', raiz), 'utf8')
  .replace(/<script\b[\s\S]*?<\/script>/g, '');   // los scripts se cargan a mano

const dom = new JSDOM(html, { url: 'http://localhost/portal/' });
const { window } = dom;

/* -------------------------------------------------- entorno de navegador */

const errores = [];
const consolaOriginal = console.error;
console.error = (...args) => { errores.push(args.map(String).join(' ')); };
console.warn = () => {};
console.info = () => {};

Object.assign(globalThis, {
  window, document: window.document, location: window.location,
  localStorage: window.localStorage, Node: window.Node, HTMLElement: window.HTMLElement,
  Event: window.Event, KeyboardEvent: window.KeyboardEvent, File: window.File, Blob: window.Blob
});
window.PORTAL_CONFIG = { adaptador: 'estatico' };
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false });
window.HTMLElement.prototype.scrollIntoView = () => {};
window.confirm = () => true;
const abiertos = [];
window.open = url => { abiertos.push(url); return null; };
let descargas = 0;
window.HTMLAnchorElement.prototype.click = function () { if (this.download) descargas++; };
globalThis.URL.createObjectURL = () => 'blob:prueba';
globalThis.URL.revokeObjectURL = () => {};
globalThis.fetch = async url => {
  const ruta = fileURLToPath(url);
  if (!fs.existsSync(ruta)) return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(ruta, 'utf8')) };
};

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const espera = (ms = 40) => new Promise(r => setTimeout(r, ms));
const visible = id => $(`#view-${id}`).style.display === 'block';
const ultimoAviso = () => $('#toast-container')?.lastElementChild?.textContent ?? '';
const enviar = async id => {
  $(id).dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await espera();
};
const clic = async (nodo, ms) => { nodo.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await espera(ms); };
const elegirRol = async valor => {
  $('#role-select').value = valor;
  $('#role-select').dispatchEvent(new window.Event('change'));
  await espera();
};

let fallas = 0;
const ok = (etiqueta, condicion) => {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${etiqueta}`);
};

/* ------------------------------------------------------------- arranque */

// Una capa de cambios de la versión anterior de los datos, como la que quedó
// en el navegador de quien probó el portal antes del cambio de ejemplos.
window.localStorage.setItem('pp.v1.solicitudes', JSON.stringify({ creados: [], modificados: { 'SOL-TUC-101': { estado: 'Aprobada' } }, eliminados: [] }));
const { iniciar } = await import('../js/core/index.js');
const { api } = await import('../js/services/api.js');
await iniciar();
await espera(80);

const escuelas = (await api.listar('escuelas', { porPagina: 0 })).items;
const oferentes = (await api.listar('oferentes', { porPagina: 0 })).items;
const casos = (await api.listar('casos', { porPagina: 0 })).items;

console.log('\nArranque e inicio');
ok('descarta la capa de cambios de los datos anteriores', window.localStorage.getItem('pp.v1.solicitudes') === null);
ok('abre en la portada', visible('inicio') && $('[data-view=inicio]').classList.contains('active'));
ok('la URL queda en #/inicio o vacía', ['', '#/inicio'].includes(window.location.hash));
ok(`KPI escuelas = ${escuelas.length}, desde los datos`, $('#kpi-escuelas').textContent === String(escuelas.length));
const suma7 = escuelas.reduce((s, e) => s + (e.alumnos_7mo || 0), 0);
ok(`KPI estudiantes = matrícula de 7° (${suma7.toLocaleString('es-AR')})`,
  $('#kpi-estudiantes').textContent === suma7.toLocaleString('es-AR'));
ok('KPI oferentes cuenta los activos reales, sin los de ejemplo', $('#kpi-empresas').textContent ===
  String(oferentes.filter(o => o.estado === 'activo' && !o.ejemplo).length));
ok(`KPI casos no cuenta los de ejemplo`, $('#kpi-casos').textContent === String(casos.filter(c => !c.ejemplo).length));
ok('la portada explica qué son los registros de ejemplo', Boolean($('#aviso-ejemplos')));
ok('el buscador trae las 14 especialidades', $('#spec-hero').options.length === 15);
ok('el Panel DETyFP está oculto para visitantes', $('#nav-btn-admin').style.display === 'none');

console.log('\nBuscador → directorio');
$('#search-hero').value = 'tornería';
await clic($('#btn-search-hero'), 80);
ok('navega al directorio con la búsqueda en la URL', window.location.hash.startsWith('#/directorio?q=') && visible('directorio'));
ok('filtra: aparece solo la metalmecánica', $$('#grid-oferentes .card-oferente').length === 1 &&
  $('#grid-oferentes').textContent.includes('Metalmecánica Ejemplo'));
ok('la tarjeta lleva la insignia EJEMPLO', Boolean($('#grid-oferentes .marca-ejemplo')));
ok('el filtro de texto quedó escrito', $('#filter-search').value === 'tornería');

console.log('\nFicha del oferente (módulo persistente)');
await clic($('#grid-oferentes .btn-card'));
ok('abre la ficha en el modal', $('#modal-detalle').classList.contains('active') &&
  $('#modal-detalle-content').textContent.includes('Metalmecánica Ejemplo') &&
  $('#modal-detalle-content').textContent.includes('Registro de ejemplo'));
const antesVinc = (await api.listar('solicitudes', { porPagina: 0 })).total;
await clic([...$$('#modal-detalle-content button')].find(b => b.textContent.includes('vinculación')));
const solTras = (await api.listar('solicitudes', { porPagina: 0 })).items;
ok('"Solicitar vinculación" guarda una solicitud', solTras.length === antesVinc + 1 &&
  solTras.some(s => s.tipo === 'vinculacion'));
ok('y cierra el modal', !$('#modal-detalle').classList.contains('active'));

console.log('\nMenú, casos y réplica');
await clic($('[data-view=casos]'));
ok('el menú lleva a #/casos', window.location.hash === '#/casos' && visible('casos'));
ok('solo una sección visible a la vez', $$('.view-section').filter(s => s.style.display === 'block').length === 1);
ok(`dibuja ${casos.length} casos`, $$('#grid-casos .card-caso').length === casos.length);
ok('ningún caso nombra a una empresa real del prototipo',
  !/Scania|Citrusvil|Arcor|Quilmes|Lucci/.test($('#grid-casos').textContent));
await clic([...$$('#grid-casos button')].find(b => b.textContent.includes('replicar')), 80);
ok('el botón de réplica abre su formulario con el caso', $('#modal-replica').classList.contains('active') &&
  $('#replica-caso-nombre').value.includes(casos[0].titulo));
$('#replica-institucion').value = 'ET N° 2';
$('#replica-contacto').value = 'Prof. Prueba';
$('#replica-correo').value = 'prueba@educacion.tucuman.gob.ar';
await enviar('#form-replica');
ok('la réplica ahora se guarda (antes se perdía)',
  (await api.listar('solicitudes', { filtros: { tipo: 'replica' }, porPagina: 0 })).total === 1);

console.log('\nQuiero ser oferente');
await clic($('[data-open-modal=oferente]'));
ok('el botón del encabezado abre el formulario', $('#modal-oferente').classList.contains('active'));
ok('el formulario trae los 17 departamentos', $('#oferente-dept').options.length === 18);
window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
ok('Escape lo cierra', !$('#modal-oferente').classList.contains('active'));
$('#oferente-razon').value = '<b>Metalúrgica</b> Prueba S.A.';
$('#oferente-cuit').value = '20-12345678-5';
$('#oferente-dept').value = 'Juan Bautista Alberdi';
$('#oferente-spec').value = 'Electromecánica';
$('#oferente-contacto').value = 'Ing. Prueba';
$('#oferente-correo').value = 'a@b.com';
await enviar('#form-oferente');
ok('un CUIT con dígito verificador erróneo se rechaza', ultimoAviso().includes('CUIT no es válido'));
$('#oferente-cuit').value = '20123456786';
await enviar('#form-oferente');
const nueva = (await api.listar('solicitudes', { filtros: { tipo: 'oferente' }, orden: '-id', porPagina: 0 })).items[0];
ok('con CUIT válido se guarda, formateado', nueva?.cuit === '20-12345678-6' && nueva.departamento === 'Juan Bautista Alberdi');
ok('el aviso es texto: las etiquetas no se interpretan', !$('#toast-container b'));

console.log('\nRol y acceso al panel');
window.location.hash = '#/admin';
await espera(80);
ok('#/admin como visitante vuelve a inicio', visible('inicio') && !visible('admin'));
ok('y avisa por qué', ultimoAviso().includes('requiere otro perfil'));
await elegirRol('Administrador Provincial');
ok('el rol admin muestra el botón del panel', $('#nav-btn-admin').style.display === 'flex');
ok('la insignia de la portada muestra el rol', $('#active-role-display').textContent === 'Administrador Provincial');
await clic($('#nav-btn-admin'), 120);
ok('entra al panel', visible('admin') && window.location.hash === '#/admin');
const pendientes = (await api.listar('solicitudes', { filtros: { estado: 'Pendiente' }, porPagina: 0 })).total;
ok(`la bandeja lista las ${pendientes} pendientes`, $$('#admin-queue-table tr').length === pendientes);
ok('el contador de la solapa coincide', $('[data-admin-tab=solicitudes] .contador-pendientes').textContent === String(pendientes));

const filaQuilmes = $$('#admin-queue-table tr').find(tr => tr.textContent.includes('SOL-TUC-101'));
ok('la solicitud de ejemplo está marcada', Boolean(filaQuilmes.querySelector('.marca-ejemplo')));
await clic(filaQuilmes.querySelector('.btn-approve'), 80);
const quilmes = await api.obtener('solicitudes', 'SOL-TUC-101');
ok('aprobar no borra: deja estado, fecha de cierre y responsable',
  quilmes.estado === 'Aprobada' && Boolean(quilmes.fecha_cierre) && Boolean(quilmes.resuelta_por));
ok('y sale de la bandeja', $$('#admin-queue-table tr').length === pendientes - 1);

console.log('\nEspecialidades');
await clic($('[data-admin-tab=especialidades]'));
ok('la solapa viaja en la URL', window.location.hash === '#/admin?tab=especialidades' &&
  $('#admin-tab-especialidades').style.display === 'block');
$('#new-spec-name').value = 'Energías Renovables';
await enviar('#form-add-spec');
ok('agrega una especialidad', (await api.listar('especialidades', { porPagina: 0 })).items.includes('Energías Renovables'));
$('#new-spec-name').value = 'energias renovables';
await enviar('#form-add-spec');
ok('rechaza el duplicado aunque cambien tildes y mayúsculas', ultimoAviso().includes('ya está en el catálogo'));
ok('el formulario de oferentes se enteró', [...$('#oferente-spec').options].some(o => o.value === 'Energías Renovables'));
await clic([...$$('#admin-spec-list .spec-item-row')].find(r => r.textContent.includes('Energías Renovables'))
  .querySelector('.btn-approve'));
$('#edit-spec-name').value = 'Energías Renovables y Biomasa';
await enviar('#form-edit-spec');
const listaEsp = (await api.listar('especialidades', { porPagina: 0 })).items;
ok('renombra', listaEsp.includes('Energías Renovables y Biomasa') && !listaEsp.includes('Energías Renovables'));
await clic([...$$('#admin-spec-list .spec-item-row')].find(r => r.textContent.includes('Biomasa'))
  .querySelector('.btn-reject'));
ok('elimina', !(await api.listar('especialidades', { porPagina: 0 })).items.some(e => e.includes('Biomasa')));

console.log('\nNómina de practicantes');
await clic($('[data-admin-tab=alumnos]'));
const filasAntes = $$('#admin-alumnos-table tr').length;
ok(`la lista de escuelas trae las ${escuelas.length}`, $('#alu-escuela').options.length === escuelas.length + 1);
$('#alu-nombre').value = 'Estudiante de Prueba';
$('#alu-dni').value = '123';
$('#alu-escuela').value = escuelas[0].nombre;
$('#alu-spec').value = 'Electrónica';
await enviar('#form-add-alumno');
ok('un DNI corto se rechaza', ultimoAviso().includes('7 u 8 dígitos'));
$('#alu-dni').value = '47.111.222';
await enviar('#form-add-alumno');
ok('un DNI válido se incorpora', $$('#admin-alumnos-table tr').length === filasAntes + 1);
$('#alu-nombre').value = 'Otro';
$('#alu-dni').value = '47111222';
$('#alu-escuela').value = escuelas[0].nombre;
$('#alu-spec').value = 'Electrónica';
await enviar('#form-add-alumno');
ok('no deja cargar dos veces el mismo DNI', ultimoAviso().includes('Ya hay un estudiante'));

console.log('\nRepositorio y carga documental');
await clic($('[data-view=repositorio]'), 80);
const docs = (await api.listar('documentos', { porPagina: 0 })).items;
ok(`lista ${docs.length} documentos`, $$('#doc-list .doc-item').length === docs.length);
ok('como admin, ofrece eliminar', $$('#doc-list .doc-item').every(d => d.textContent.includes('Eliminar')));
ok('el botón "Subir documento" se ve', $('#btn-admin-subir-doc').style.display === 'inline-flex');
await clic($('#doc-list .doc-action-btn'), 80);
ok('abrir la ley suma una consulta', (await api.obtener('documentos', docs[0].id)).descargas === (docs[0].descargas ?? 0) + 1);
ok('y abre la fuente oficial en otra pestaña', abiertos[0] === docs[0].url);
const botonModelo = $$('#doc-list .doc-item').find(d => d.textContent.includes('convenio marco')).querySelector('.doc-action-btn');
await clic(botonModelo, 80);
ok('un modelo sin archivo no fabrica un documento falso', descargas === 0 && ultimoAviso().includes('todavía no está cargado'));

await clic($('#btn-admin-subir-doc'));
ok('abre la carga', $('#modal-subir-doc').classList.contains('active'));
await enviar('#form-subir-doc');
ok('sin archivo no publica (antes recargaba la página)', ultimoAviso().includes('Elegí el archivo'));
const archivo = new window.File(['contenido'], 'protocolo-seguridad.pdf', { type: 'application/pdf' });
Object.defineProperty($('#upload-doc-file'), 'files', { value: [archivo], configurable: true });
$('#upload-doc-title').value = 'Protocolo de seguridad 2026';
$('#upload-doc-cat').value = 'Instructivos';
$('#upload-doc-version').value = 'v1.0';
await enviar('#form-subir-doc');
ok('con archivo, publica y aparece en la lista', $$('#doc-list .doc-item').length === docs.length + 1 &&
  $('#doc-list').textContent.includes('Protocolo de seguridad 2026'));
ok('y cierra el modal', !$('#modal-subir-doc').classList.contains('active'));

await elegirRol('Visitante');
ok('volver a visitante quita "Eliminar" en el acto',
  !$$('#doc-list .doc-item').some(d => d.textContent.includes('Eliminar')));

console.log('\nTema');
const temaAntes = window.document.documentElement.getAttribute('data-theme');
await clic($('#theme-toggle-btn'));
ok('el botón alterna el tema y lo recuerda',
  window.document.documentElement.getAttribute('data-theme') !== temaAntes &&
  window.localStorage.getItem('portal_theme') === window.document.documentElement.getAttribute('data-theme'));

console.log('\nLimpieza del código heredado');
ok('no quedan onclick en línea en el HTML', !/onclick=/.test(fs.readFileSync(new URL('index.html', raiz), 'utf8')));
ok('no queda window.PORTAL_DATA', window.PORTAL_DATA === undefined);
ok('ninguna función del prototipo colgada de window',
  ['showToast', 'renderAdminPanel', 'viewOferenteDetail', 'processSolicitud', 'downloadRealDocument']
    .every(f => window[f] === undefined));
ok('el pie usa enlaces reales', $$('footer a[href^="#/"]').length === 4);

console.log('\nLo cargado sobrevive a una recarga');
const capa = JSON.parse(window.localStorage.getItem('pp.v2.solicitudes') || '{}');
ok('las solicitudes nuevas están en la capa de cambios', (capa.creados ?? []).length >= 3);
ok('y la aprobación también', capa.modificados?.['SOL-TUC-101']?.estado === 'Aprobada');

console.error = consolaOriginal;
ok(`sin errores en consola${errores.length ? `: ${errores[0]}` : ''}`, errores.length === 0);

console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas === 0 ? 0 : 1);
