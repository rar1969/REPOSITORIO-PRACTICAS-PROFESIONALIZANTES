/**
 * modules/estadisticas/panel — solapa "Estadísticas" del Panel DETyFP.
 *
 * Tablero de lectura: todo se calcula en el momento a partir de los datos
 * reales (services/api), nada se escribe ni se inventa. Los registros de
 * ejemplo (`ejemplo: true`) no suman, igual que en los KPI de portada.
 *
 * Secciones:
 *   1. Indicadores generales (oferentes, convenios, cupos, escuelas, 7.° año)
 *   2. Estado de los convenios (vigente, por vencer, vencido, sin convenio)
 *   3. Cupos frente a matrícula de 7.° año, por especialidad (cobertura)
 *   4. Oferentes y escuelas por departamento
 *   5. Capacitaciones y certificados (solo con la base: son datos de menores
 *      y la vista ya los entrega solo al administrador)
 *   6. Bandeja de solicitudes y documentos más descargados
 *
 * Los gráficos son barras horizontales en HTML: una sola serie por gráfico,
 * con la cifra escrita al lado de cada barra (la barra nunca es la única
 * forma de leer el dato) y el detalle en el `title` al pasar el mouse.
 *
 * El panel lo importa de forma diferida, como la solapa de certificados.
 */

import { el, icono, reemplazar } from '../../ui/dom.js';

/** Días antes del vencimiento en que un convenio pasa a "por vencer". */
export const DIAS_AVISO = 60;

const nf = new Intl.NumberFormat('es-AR');
const pct = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 });
// Para comparar nombres de escuela: sin tildes, mayúsculas, «N°/Nº/N.°» ni signos.
const normalizar = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const reales = lista => lista.filter(x => !x?.ejemplo);

/* ------------------------------------------------------------------ cálculo */

/** Estado de un convenio a una fecha (AAAA-MM-DD). Exportada para las pruebas. */
export function estadoConvenio(oferente, hoy = new Date().toISOString().slice(0, 10)) {
  const vence = oferente.fecha_vencimiento;
  if (!oferente.convenio_vigente) return 'sin';
  if (!vence) return 'vigente';
  if (vence < hoy) return 'vencido';
  const dias = (Date.parse(vence) - Date.parse(hoy)) / 86400000;
  return dias <= DIAS_AVISO ? 'porVencer' : 'vigente';
}

/** Cuenta por clave; las claves vacías van a "Sin dato". Devuelve [[clave, n]] ordenado. */
export function contarPor(items, clave, peso = () => 1) {
  const mapa = new Map();
  for (const item of items) {
    const valores = [].concat(typeof clave === 'function' ? clave(item) : item[clave]);
    for (const v of valores.length ? valores : [null]) {
      const k = v || 'Sin dato';
      mapa.set(k, (mapa.get(k) ?? 0) + peso(item));
    }
  }
  return [...mapa].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es'));
}

/** Todos los números del tablero, a partir de las colecciones crudas. */
export function calcular({ oferentes, escuelas, capacitaciones, certificados, solicitudes, documentos },
                         hoy = new Date().toISOString().slice(0, 10)) {
  const ofe = reales(oferentes);
  const esc = reales(escuelas);

  const convenios = { vigente: 0, porVencer: 0, vencido: 0, sin: 0 };
  for (const o of ofe) convenios[estadoConvenio(o, hoy)]++;
  const proximos = ofe
    .filter(o => estadoConvenio(o, hoy) === 'porVencer')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));

  const cuposTotales = ofe.reduce((s, o) => s + (Number(o.cupos_disponibles) || 0), 0);
  const alumnos7 = esc.reduce((s, e) => s + (Number(e.alumnos_7mo) || 0), 0);

  // Escuelas que figuran vinculadas a algún oferente real.
  const nombresEsc = new Map(esc.map(e => [normalizar(e.nombre), e.nombre]));
  const vinculadas = new Set();
  for (const o of ofe) for (const n of o.escuelas_vinculadas ?? []) {
    vinculadas.add(nombresEsc.get(normalizar(n)) ?? n);
  }

  // Cobertura por especialidad: alumnos de 7.° (matrícula) frente a cupos ofrecidos.
  // Un oferente con varias especialidades reparte sus cupos en todas: es un techo.
  const porEsp = new Map();
  const fila = esp => porEsp.get(esp) ?? porEsp.set(esp, { especialidad: esp, alumnos: 0, cupos: 0, oferentes: 0 }).get(esp);
  for (const e of esc) {
    for (const [esp, n] of Object.entries(e.alumnos_por_especialidad ?? {})) fila(esp).alumnos += Number(n) || 0;
  }
  for (const o of ofe) {
    for (const esp of o.especialidades ?? []) {
      const f = fila(esp);
      f.cupos += Number(o.cupos_disponibles) || 0;
      f.oferentes++;
    }
  }
  const cobertura = [...porEsp.values()]
    .map(f => ({ ...f, cobertura: f.alumnos ? f.cupos / f.alumnos : null }))
    .sort((a, b) => b.alumnos - a.alumnos || b.cupos - a.cupos);

  // Por departamento: oferentes, escuelas y alumnos de 7.°.
  const deptos = new Map();
  const dep = d => deptos.get(d) ?? deptos.set(d, { departamento: d, oferentes: 0, escuelas: 0, alumnos: 0, cupos: 0 }).get(d);
  for (const o of ofe) { const d = dep(o.departamento || 'Sin dato'); d.oferentes++; d.cupos += Number(o.cupos_disponibles) || 0; }
  for (const e of esc) { const d = dep(e.departamento || 'Sin dato'); d.escuelas++; d.alumnos += Number(e.alumnos_7mo) || 0; }
  const departamentos = [...deptos.values()].sort((a, b) =>
    b.oferentes - a.oferentes || b.escuelas - a.escuelas || a.departamento.localeCompare(b.departamento, 'es'));

  // Capacitaciones y certificados.
  const caps = reales(capacitaciones);
  const cer = certificados ?? null;
  const certs = cer && {
    total: cer.length,
    pendiente: cer.filter(c => c.estado === 'pendiente').length,
    impreso: cer.filter(c => c.estado === 'impreso').length,
    anulado: cer.filter(c => c.estado === 'anulado').length,
    revisar: cer.filter(c => c.revisar).length,
    personas: new Set(cer.map(c => c.participante_id)).size,
    horas: cer.filter(c => c.estado !== 'anulado').reduce((s, c) => s + (Number(c.horas) || 0), 0),
    porEscuela: contarPor(cer.filter(c => c.estado !== 'anulado'), 'escuela'),
    porCapacitacion: contarPor(cer.filter(c => c.estado !== 'anulado'), 'capacitacion'),
    porEspecialidad: contarPor(cer.filter(c => c.estado !== 'anulado'), 'especialidad')
  };

  const sol = reales(solicitudes);
  const docs = reales(documentos);

  return {
    oferentes: ofe.length,
    ejemplosOcultos: oferentes.length - ofe.length,
    convenios, proximos, cuposTotales,
    escuelas: esc.length,
    tecnicas: esc.filter(e => e.tipo === 'tecnica').length,
    agrotecnicas: esc.filter(e => e.tipo === 'agrotecnica').length,
    escuelasVinculadas: vinculadas.size,
    alumnos7,
    cobertura, departamentos,
    oferentesPorEspecialidad: contarPor(ofe, 'especialidades'),
    oferentesPorTipo: contarPor(ofe, 'tipo_organizacion'),
    capacitaciones: {
      total: caps.length,
      horas: caps.reduce((s, c) => s + (Number(c.horas_certificadas) || 0), 0),
      presentes: caps.reduce((s, c) => s + (Number(c.participantes_inscritos) || 0), 0)
    },
    certificados: certs,
    solicitudes: {
      pendientes: sol.filter(s => (s.estado ?? 'Pendiente') === 'Pendiente').length,
      aprobadas: sol.filter(s => s.estado === 'Aprobada').length,
      rechazadas: sol.filter(s => s.estado === 'Rechazada').length,
      porTipo: contarPor(sol, 'tipo')
    },
    documentos: {
      total: docs.length,
      descargas: docs.reduce((s, d) => s + (Number(d.descargas) || 0), 0),
      top: [...docs].sort((a, b) => (b.descargas ?? 0) - (a.descargas ?? 0)).slice(0, 5)
    }
  };
}

/* ------------------------------------------------------------------- vista */

export async function dibujarEstadisticas(contenedor, ctx) {
  const api = ctx.api;
  const conBase = api.origen === 'supabase';
  const todo = c => api.listar(c, { porPagina: 0 }).then(r => r.items).catch(error => {
    console.warn(`[estadisticas] No se pudo leer "${c}".`, error);
    return [];
  });

  reemplazar(contenedor, encabezado(null), el('p', { class: 'est-cargando', role: 'status' },
    icono('fa-spinner fa-spin'), ' Calculando indicadores…'));

  const [oferentes, escuelas, capacitaciones, solicitudes, documentos, certificados] = await Promise.all([
    todo('oferentes'), todo('escuelas'), todo('capacitaciones'), todo('solicitudes'), todo('documentos'),
    conBase ? todo('certificados') : Promise.resolve(null)
  ]);
  const d = calcular({ oferentes, escuelas, capacitaciones, certificados, solicitudes, documentos });

  reemplazar(contenedor,
    encabezado(() => dibujarEstadisticas(contenedor, ctx)),
    d.ejemplosOcultos > 0 && d.oferentes === 0 ? el('p', { class: 'est-nota' }, icono('fa-circle-info'),
      ' Todavía no hay oferentes reales cargados: los registros de ejemplo no se cuentan.') : null,

    // 1. Indicadores generales
    el('div', { class: 'est-kpis' },
      tile('fa-building', d.oferentes, 'Oferentes', `${nf.format(d.convenios.vigente + d.convenios.porVencer)} con convenio vigente`),
      tile('fa-handshake', d.convenios.vigente + d.convenios.porVencer, 'Convenios vigentes',
        d.convenios.porVencer ? `${d.convenios.porVencer} vencen en ${DIAS_AVISO} días` : 'ninguno por vencer'),
      tile('fa-chair', d.cuposTotales, 'Cupos ofrecidos',
        d.alumnos7 ? `${pct.format(d.cuposTotales / d.alumnos7)} de la matrícula de 7.°` : ''),
      tile('fa-school', d.escuelas, 'Escuelas', `${d.tecnicas} técnicas · ${d.agrotecnicas} agrotécnicas`),
      tile('fa-link', d.escuelasVinculadas, 'Escuelas vinculadas',
        d.escuelas ? `${pct.format(d.escuelasVinculadas / d.escuelas)} del total` : ''),
      tile('fa-user-graduate', d.alumnos7, 'Estudiantes de 7.° año', 'matrícula que hace las prácticas'),
      d.certificados && tile('fa-award', d.certificados.total - d.certificados.anulado, 'Certificados emitidos',
        `${nf.format(d.certificados.personas)} estudiantes · ${nf.format(d.certificados.horas)} h acreditadas`)
    ),

    // 2. Convenios
    seccion('fa-file-signature', 'Estado de los convenios',
      'Según la fecha de vencimiento cargada en cada oferente.',
      el('div', { class: 'est-estados' },
        estado('vigente', 'fa-circle-check', 'Vigentes', d.convenios.vigente),
        estado('porVencer', 'fa-clock', `Vencen en ${DIAS_AVISO} días`, d.convenios.porVencer),
        estado('vencido', 'fa-triangle-exclamation', 'Vencidos', d.convenios.vencido),
        estado('sin', 'fa-hourglass-half', 'Sin convenio / en trámite', d.convenios.sin)),
      d.proximos.length > 0 && el('div', { class: 'table-responsive' }, tabla(
        ['Oferente', 'Departamento', 'Vence'],
        d.proximos.slice(0, 8).map(o => [o.razon_social, o.departamento || '—', fecha(o.fecha_vencimiento)]))),
      d.proximos.length > 8 && el('p', { class: 'est-bajada', style: { marginTop: '0.5rem' } },
        `Y ${d.proximos.length - 8} más. El listado completo está en el Directorio.`)
    ),

    // 3. Cobertura
    seccion('fa-scale-balanced', 'Cupos frente a la matrícula de 7.° año',
      'Por especialidad. Si un oferente recibe varias especialidades, sus cupos cuentan en cada una: la cobertura es un techo.',
      d.cobertura.length === 0 ? vacia('Sin datos de matrícula ni de cupos.') :
        el('div', { class: 'table-responsive' }, tabla(
          ['Especialidad', 'Estudiantes de 7.°', 'Cupos', 'Oferentes', 'Cobertura'],
          d.cobertura.map(f => [f.especialidad, nf.format(f.alumnos), nf.format(f.cupos), nf.format(f.oferentes),
            celdaCobertura(f.cobertura)]),
          { numericas: [1, 2, 3] }))
    ),

    // 4. Territorio y oferta
    el('div', { class: 'est-doble' },
      seccion('fa-map-location-dot', 'Oferentes por departamento', null,
        barras(d.departamentos.filter(x => x.oferentes).map(x => [x.departamento, x.oferentes]),
          { unidad: 'oferente', vacio: 'Sin oferentes reales cargados.' })),
      seccion('fa-school', 'Estudiantes de 7.° por departamento', null,
        barras(d.departamentos.filter(x => x.alumnos).sort((a, b) => b.alumnos - a.alumnos)
          .map(x => [x.departamento, x.alumnos, `${x.escuelas} escuela${x.escuelas === 1 ? '' : 's'}`]),
          { unidad: 'estudiante' }))
    ),
    el('div', { class: 'est-doble' },
      seccion('fa-microchip', 'Oferentes por especialidad', null,
        barras(d.oferentesPorEspecialidad, { unidad: 'oferente', vacio: 'Sin oferentes reales cargados.' })),
      seccion('fa-sitemap', 'Oferentes por tipo de organización', null,
        barras(d.oferentesPorTipo, { unidad: 'oferente', vacio: 'Sin oferentes reales cargados.' }))
    ),

    // 5. Capacitaciones y certificados
    seccion('fa-chalkboard-user', 'Capacitaciones y certificados', null,
      el('div', { class: 'est-kpis est-kpis-chicos' },
        tile('fa-chalkboard-user', d.capacitaciones.total, 'Capacitaciones'),
        tile('fa-users', d.capacitaciones.presentes, 'Presentes registrados'),
        d.certificados && tile('fa-print', d.certificados.impreso, 'Impresos'),
        d.certificados && tile('fa-hourglass-half', d.certificados.pendiente, 'Pendientes de imprimir'),
        d.certificados?.revisar ? tile('fa-pen-to-square', d.certificados.revisar, 'Con datos para revisar') : null),
      !d.certificados && el('p', { class: 'est-nota' }, icono('fa-lock'),
        ' El detalle de certificados solo está disponible con la base de datos activa.'),
      d.certificados?.total >= 1000 && el('p', { class: 'est-nota' }, icono('fa-triangle-exclamation'),
        ' La base entrega hasta 1.000 certificados por lectura: estas cifras pueden estar incompletas.'),
      d.certificados && el('div', { class: 'est-doble' },
        el('div', {}, el('h5', {}, 'Certificados por escuela'),
          barras(d.certificados.porEscuela, { unidad: 'certificado', max: 12 })),
        el('div', {}, el('h5', {}, 'Certificados por capacitación'),
          barras(d.certificados.porCapacitacion, { unidad: 'certificado', max: 12 }))),
      d.certificados && el('div', {}, el('h5', {}, 'Certificados por especialidad'),
        barras(d.certificados.porEspecialidad, { unidad: 'certificado' }))
    ),

    // 6. Solicitudes y documentos
    el('div', { class: 'est-doble' },
      seccion('fa-inbox', 'Solicitudes', null,
        el('div', { class: 'est-estados' },
          estado('porVencer', 'fa-inbox', 'Pendientes', d.solicitudes.pendientes),
          estado('vigente', 'fa-check', 'Aprobadas', d.solicitudes.aprobadas),
          estado('sin', 'fa-xmark', 'Rechazadas', d.solicitudes.rechazadas)),
        barras(d.solicitudes.porTipo.map(([t, n]) => [TIPOS[t] ?? t, n]), { unidad: 'solicitud', vacio: 'Sin solicitudes.' })),
      seccion('fa-download', 'Documentos más descargados',
        `${nf.format(d.documentos.total)} documentos · ${nf.format(d.documentos.descargas)} descargas en total`,
        barras(d.documentos.top.filter(x => x.descargas).map(x => [x.titulo, x.descargas]),
          { unidad: 'descarga', vacio: 'Todavía no hay descargas registradas.' }))
    )
  );
}

const TIPOS = { oferente: 'Quiero ser oferente', experiencia: 'Experiencia', replica: 'Pedido de réplica', vinculacion: 'Vinculación' };

/* -------------------------------------------------------------- componentes */

function encabezado(actualizar) {
  const ahora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  return el('div', { class: 'est-encabezado' },
    el('div', {},
      el('h3', {}, 'Estadísticas de Prácticas Profesionalizantes'),
      el('p', { style: { color: 'var(--text-muted)' } },
        'Indicadores calculados en el momento a partir de los datos del portal. Los registros de ejemplo no se cuentan.')),
    actualizar && el('div', { class: 'est-acciones' },
      el('small', { style: { color: 'var(--text-muted)' } }, `Actualizado: ${ahora}`),
      el('button', { type: 'button', class: 'btn-action-sm', onclick: actualizar,
        'aria-label': 'Volver a calcular las estadísticas' }, icono('fa-rotate'), ' Actualizar'),
      el('button', { type: 'button', class: 'btn-action-sm', onclick: () => window.print(),
        'aria-label': 'Imprimir las estadísticas' }, icono('fa-print'), ' Imprimir'))
  );
}

function tile(ico, valor, rotulo, detalle) {
  return el('div', { class: 'est-kpi' },
    el('span', { class: 'est-kpi-icono' }, icono(ico)),
    el('div', {},
      el('div', { class: 'est-kpi-valor' }, nf.format(valor ?? 0)),
      el('div', { class: 'est-kpi-rotulo' }, rotulo),
      detalle && el('div', { class: 'est-kpi-detalle' }, detalle)));
}

function seccion(ico, titulo, bajada, ...contenido) {
  return el('section', { class: 'est-seccion' },
    el('h4', {}, icono(ico), ` ${titulo}`),
    bajada && el('p', { class: 'est-bajada' }, bajada),
    ...contenido);
}

function estado(tipo, ico, rotulo, n) {
  return el('div', { class: `est-estado est-${tipo}` },
    icono(ico), el('strong', {}, nf.format(n)), el('span', {}, rotulo));
}

/**
 * Barras horizontales de una sola serie. La cifra va escrita al costado de
 * cada barra; el `title` da la lectura completa al pasar el mouse.
 */
function barras(pares, { unidad = '', vacio: textoVacio = 'Sin datos.', max = 0 } = {}) {
  if (!pares.length) return vacia(textoVacio);
  const lista = max && pares.length > max
    ? [...pares.slice(0, max - 1), ['Otras', pares.slice(max - 1).reduce((s, p) => s + p[1], 0)]]
    : pares;
  const tope = Math.max(...lista.map(p => p[1]), 1);
  const plural = n => (unidad ? ` ${unidad}${n === 1 ? '' : (/[aeiou]$/.test(unidad) ? 's' : 'es')}` : '');
  return el('ul', { class: 'est-barras' }, lista.map(([rotulo, n, extra]) =>
    el('li', { title: `${rotulo}: ${nf.format(n)}${plural(n)}${extra ? ` (${extra})` : ''}` },
      el('span', { class: 'est-barra-rotulo' }, rotulo),
      el('span', { class: 'est-barra-pista', 'aria-hidden': 'true' },
        el('span', { class: 'est-barra', style: { width: `${Math.max(2, (n / tope) * 100)}%` } })),
      el('span', { class: 'est-barra-valor' }, nf.format(n)))));
}

function tabla(columnas, filas, { numericas = [] } = {}) {
  return el('table', { class: 'data-table est-tabla' },
    el('thead', {}, el('tr', {}, columnas.map((c, i) =>
      el('th', { scope: 'col', class: numericas.includes(i) ? 'est-num' : null }, c)))),
    el('tbody', {}, filas.map(f => el('tr', {}, f.map((celda, i) =>
      el('td', { class: numericas.includes(i) ? 'est-num' : null }, celda))))));
}

function celdaCobertura(c) {
  if (c === null) return el('span', { style: { color: 'var(--text-muted)' } }, 'sin matrícula');
  const nivel = c >= 1 ? 'vigente' : c >= 0.5 ? 'porVencer' : 'vencido';
  const texto = c >= 1 ? 'Alcanza' : c >= 0.5 ? 'Parcial' : 'Insuficiente';
  return el('span', { class: `est-cobertura est-${nivel}`, title: `${texto}: ${pct.format(c)} de los estudiantes de 7.° con cupo` },
    el('span', { class: 'est-barra-pista', 'aria-hidden': 'true' },
      el('span', { class: 'est-barra', style: { width: `${Math.min(100, c * 100)}%` } })),
    el('span', {}, `${pct.format(c)} · ${texto}`));
}

const vacia = texto => el('p', { class: 'est-vacio' }, texto);
const fecha = f => (f ? f.split('-').reverse().join('/') : '—');
