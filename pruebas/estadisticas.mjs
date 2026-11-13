/**
 * Pruebas del tablero de estadísticas (js/modules/estadisticas/panel.js).
 *
 *   node pruebas/estadisticas.mjs        (requiere jsdom, como integracion.mjs)
 *
 * Verifica los cálculos con datos armados a mano y que la solapa se dibuje
 * con el adaptador estático (sin certificados) y con uno que sí los tiene.
 */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;

const { calcular, estadoConvenio, contarPor, dibujarEstadisticas } =
  await import('../js/modules/estadisticas/panel.js');

let fallas = 0;
const ok = (texto, condicion) => {
  console.log(`${condicion ? '✔' : '✘'} ${texto}`);
  if (!condicion) fallas++;
};

const HOY = '2026-11-12';
const oferentes = [
  { id: 'A', razon_social: 'A', departamento: 'Capital', convenio_vigente: true, fecha_vencimiento: '2027-06-01',
    cupos_disponibles: 10, especialidades: ['Informática'], escuelas_vinculadas: ['ET N° 2'], tipo_organizacion: 'PyME' },
  { id: 'B', razon_social: 'B', departamento: 'Capital', convenio_vigente: true, fecha_vencimiento: '2026-12-01',
    cupos_disponibles: 4, especialidades: ['Informática', 'Electrónica'], escuelas_vinculadas: ['et nº 2', 'ET N° 3'] },
  { id: 'C', razon_social: 'C', departamento: 'Monteros', convenio_vigente: true, fecha_vencimiento: '2026-01-01',
    cupos_disponibles: 0, especialidades: ['Electrónica'] },
  { id: 'D', razon_social: 'D', departamento: 'Lules', convenio_vigente: false, cupos_disponibles: 2, especialidades: [] },
  { id: 'X', razon_social: 'Ejemplo', departamento: 'Capital', convenio_vigente: true, cupos_disponibles: 99, ejemplo: true }
];
const escuelas = [
  { nombre: 'ET N° 2', tipo: 'tecnica', departamento: 'Capital', alumnos_7mo: 20,
    alumnos_por_especialidad: { 'Informática': 12, 'Electrónica': 8 } },
  { nombre: 'ET N° 3', tipo: 'tecnica', departamento: 'Capital', alumnos_7mo: 0, alumnos_por_especialidad: {} },
  { nombre: 'Agro', tipo: 'agrotecnica', departamento: 'Lules', alumnos_7mo: 5,
    alumnos_por_especialidad: { 'Producción Agropecuaria': 5 } }
];
const certificados = [
  { participante_id: 'P1', estado: 'impreso', horas: 10, escuela: 'ET N° 2', capacitacion: 'Software', especialidad: 'Informática' },
  { participante_id: 'P1', estado: 'pendiente', horas: 4, escuela: 'ET N° 2', capacitacion: 'Redes', especialidad: 'Informática', revisar: true },
  { participante_id: 'P2', estado: 'anulado', horas: 10, escuela: 'Agro', capacitacion: 'Software', especialidad: 'Producción Agropecuaria' }
];
const solicitudes = [{ tipo: 'oferente', estado: 'Pendiente' }, { tipo: 'replica', estado: 'Aprobada' }, { tipo: 'oferente' }];
const documentos = [{ titulo: 'Ley', descargas: 7 }, { titulo: 'Modelo', descargas: 0 }];

/* --- estado de convenio --- */
ok('vigente lejos del vencimiento', estadoConvenio(oferentes[0], HOY) === 'vigente');
ok(`por vencer dentro de 60 días`, estadoConvenio(oferentes[1], HOY) === 'porVencer');
ok('vencido', estadoConvenio(oferentes[2], HOY) === 'vencido');
ok('sin convenio', estadoConvenio(oferentes[3], HOY) === 'sin');
ok('contarPor reparte arreglos', JSON.stringify(contarPor(oferentes.slice(0, 3), 'especialidades')) ===
  JSON.stringify([['Electrónica', 2], ['Informática', 2]]));

/* --- cálculo completo --- */
const d = calcular({ oferentes, escuelas, capacitaciones: [{ horas_certificadas: 10, participantes_inscritos: 3 }],
  certificados, solicitudes, documentos }, HOY);

ok('los ejemplos no suman', d.oferentes === 4 && d.cuposTotales === 16);
ok('convenios por estado', JSON.stringify(d.convenios) === '{"vigente":1,"porVencer":1,"vencido":1,"sin":1}');
ok('lista de próximos a vencer', d.proximos.length === 1 && d.proximos[0].id === 'B');
ok('escuelas vinculadas sin duplicar por tildes ni mayúsculas', d.escuelasVinculadas === 2);
ok('matrícula de 7.°', d.alumnos7 === 25 && d.tecnicas === 2 && d.agrotecnicas === 1);
const inf = d.cobertura.find(f => f.especialidad === 'Informática');
ok('cobertura de Informática: 14 cupos / 12 alumnos', inf.cupos === 14 && inf.alumnos === 12 && inf.oferentes === 2);
ok('especialidad sin cupos tiene cobertura 0',
  d.cobertura.find(f => f.especialidad === 'Producción Agropecuaria').cobertura === 0);
ok('departamentos', d.departamentos[0].departamento === 'Capital' && d.departamentos[0].oferentes === 2 &&
  d.departamentos[0].alumnos === 20);
ok('certificados: anulados aparte', d.certificados.total === 3 && d.certificados.anulado === 1 &&
  d.certificados.horas === 14 && d.certificados.personas === 2 && d.certificados.revisar === 1);
ok('certificados por escuela excluye anulados', JSON.stringify(d.certificados.porEscuela) === '[["ET N° 2",2]]');
ok('solicitudes sin estado cuentan como pendientes', d.solicitudes.pendientes === 2 && d.solicitudes.aprobadas === 1);
ok('documentos', d.documentos.descargas === 7 && d.documentos.top[0].titulo === 'Ley');
ok('sin base, certificados es null', calcular({ oferentes: [], escuelas: [], capacitaciones: [],
  certificados: null, solicitudes: [], documentos: [] }).certificados === null);

/* --- dibujo --- */
const ctxCon = (origen, datos) => ({
  api: { origen, listar: async c => ({ items: datos[c] ?? [] }) }
});
const c = document.getElementById('c');

await dibujarEstadisticas(c, ctxCon('estatico', { oferentes, escuelas, solicitudes, documentos }));
ok('estático: se dibujan los indicadores', c.querySelectorAll('.est-kpi').length >= 6);
ok('estático: avisa que los certificados requieren la base', c.textContent.includes('base de datos activa'));
ok('estático: no pide certificados', !c.textContent.includes('Certificados emitidos'));

let pedidas = [];
await dibujarEstadisticas(c, { api: { origen: 'supabase', listar: async col => {
  pedidas.push(col);
  return { items: { oferentes, escuelas, solicitudes, documentos, certificados }[col] ?? [] };
} } });
ok('con base: lee certificados', pedidas.includes('certificados'));
ok('con base: muestra certificados emitidos', c.textContent.includes('Certificados emitidos'));
ok('con base: barras por escuela', [...c.querySelectorAll('h5')].some(h => h.textContent === 'Certificados por escuela'));
ok('los nombres se escriben como texto', !c.innerHTML.includes('<script'));

const roto = { api: { origen: 'supabase', listar: async () => { throw new Error('sin red'); } } };
await dibujarEstadisticas(c, roto);
ok('si la base falla, el tablero igual se dibuja', c.querySelector('.est-kpis') !== null);

console.log(fallas ? `\n${fallas} falla(s).` : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
