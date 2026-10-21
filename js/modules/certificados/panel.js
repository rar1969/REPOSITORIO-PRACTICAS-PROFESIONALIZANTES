/**
 * modules/certificados/panel — solapa "Certificados" del Panel DETyFP.
 *
 * Lista los certificados de la base (vista certificados_detalle), deja filtrar
 * por escuela, charla y estado, y genera los PDF para imprimir: uno suelto o
 * todos los seleccionados en un solo archivo. Cada generación queda registrada
 * en la base (descargas, estado "impreso" y auditoría).
 *
 * Los PDF se arman en el navegador con diploma.js; lo pesado (pdf-lib, fuentes
 * y plantilla) se descarga recién al generar el primero.
 *
 * Solo lo usa el administrador: los datos son de menores de edad y la base no
 * se los entrega a ningún otro rol.
 */

import { el, icono, reemplazar } from '../../ui/dom.js';
import { generarPdf, nombreArchivo, cursoCorto } from './diploma.js';
import { cargarRecursos, descargar } from './recursos.js';

const ESTADOS = { pendiente: 'Pendiente', impreso: 'Impreso', anulado: 'Anulado' };

const comparar = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true });
const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fechaCorta = f => (f ? f.split('-').reverse().join('/') : 'sin fecha');
const mesActual = () => new Date().toISOString().slice(0, 7);
const ordenar = lista => [...lista].sort((a, b) =>
  comparar(a.escuela, b.escuela) || comparar(a.capacitacion, b.capacitacion) ||
  comparar(cursoCorto(a.curso), cursoCorto(b.curso)) || comparar(a.apellido, b.apellido) ||
  comparar(a.nombre, b.nombre));

/** Un panel por contenedor: la solapa se redibuja sin perder filtros ni selección. */
const paneles = new WeakMap();

export async function dibujarCertificados(contenedor, ctx, { filtros } = {}) {
  let panel = paneles.get(contenedor);
  if (!panel) {
    panel = crearPanel(contenedor, ctx);
    paneles.set(contenedor, panel);
  }
  panel.ctx = ctx;
  await panel.recargar();
  if (filtros) panel.filtrar(filtros);
}

function crearPanel(contenedor, ctx) {
  const estado = {
    todos: [],
    total: 0,
    filtros: { escuela: '', charla: '', estado: '', q: '' },
    seleccion: new Set(),
    mes: mesActual(),
    codigo: false,
    ocupado: false
  };

  /* ------------------------------------------------------------ controles */

  const selector = (etiqueta, campo) => {
    const nodo = el('select', { 'aria-label': etiqueta, class: 'cert-control',
      onchange: () => { estado.filtros[campo] = nodo.value; dibujarLista(); } });
    return nodo;
  };
  const selEscuela = selector('Escuela', 'escuela');
  const selCharla = selector('Charla', 'charla');
  const selEstado = selector('Estado', 'estado');
  selEstado.replaceChildren(
    el('option', { value: '' }, 'Todos los estados'),
    el('option', { value: 'pendiente' }, 'Pendientes de imprimir'),
    el('option', { value: 'impreso' }, 'Ya impresos'),
    el('option', { value: 'revisar' }, 'Con datos para revisar'));

  const buscador = el('input', { type: 'search', class: 'cert-control', placeholder: 'Buscar por apellido, nombre o DNI…',
    'aria-label': 'Buscar estudiante',
    oninput: () => { estado.filtros.q = buscador.value; dibujarLista(); } });

  const mes = el('input', { type: 'month', class: 'cert-control', value: estado.mes,
    onchange: () => { estado.mes = mes.value || mesActual(); } });
  const codigo = el('input', { type: 'checkbox', id: 'cert-codigo',
    onchange: () => { estado.codigo = codigo.checked; } });

  const resumen = el('p', { class: 'cert-resumen', 'aria-live': 'polite' });
  const botonGenerar = el('button', { type: 'button', class: 'btn-primary-action nav-btn',
    onclick: () => generar([...estado.seleccion]) });
  const marcarTodos = el('input', { type: 'checkbox', 'aria-label': 'Seleccionar todos los de la lista',
    onchange: () => {
      for (const c of filtrados()) {
        if (marcarTodos.checked) estado.seleccion.add(c.id); else estado.seleccion.delete(c.id);
      }
      dibujarLista();
    } });
  const cuerpo = el('tbody');
  const aviso = el('div');

  reemplazar(contenedor, [
    el('div', { class: 'cert-encabezado' },
      el('div', {},
        el('h3', {}, 'Certificados de acreditación de horas de PP'),
        el('p', { style: { color: 'var(--text-muted)' } },
          'Elegí escuela y charla, marcá los estudiantes y generá un solo PDF listo para imprimir. ',
          'Cada certificado generado queda registrado como impreso. ',
          'Los estudiantes presentes se cargan desde la solapa Capacitaciones.'))),
    aviso,
    el('div', { class: 'cert-filtros' }, selEscuela, selCharla, selEstado, buscador),
    el('div', { class: 'cert-opciones' },
      el('label', {}, 'Fecha que figura en el certificado ', mes),
      el('label', { for: 'cert-codigo', class: 'cert-check' }, codigo,
        ' Agregar al pie el código de verificación')),
    el('div', { class: 'cert-acciones' }, resumen, botonGenerar),
    el('div', { class: 'table-responsive' },
      el('table', { class: 'data-table' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', style: { width: '2rem' } }, marcarTodos),
          ['Estudiante', 'Curso', 'Escuela', 'Charla', 'Estado', 'Acciones']
            .map(t => el('th', { scope: 'col' }, t)))),
        cuerpo))
  ]);

  /* ------------------------------------------------------------- datos */

  function filtrados() {
    const { escuela, charla, estado: est, q } = estado.filtros;
    const busqueda = normalizar(q).trim();
    return estado.todos.filter(c =>
      (!escuela || c.escuela === escuela) &&
      (!charla || c.capacitacion === charla) &&
      (!est || (est === 'revisar' ? c.revisar : c.estado === est)) &&
      (!busqueda || normalizar(`${c.apellido} ${c.nombre} ${c.dni ?? ''}`).includes(busqueda)));
  }

  function llenar(nodo, valores, invitacion) {
    const elegido = nodo.value;
    nodo.replaceChildren(el('option', { value: '' }, invitacion),
      ...valores.map(([valor, texto]) => el('option', { value: valor }, texto)));
    nodo.value = valores.some(([v]) => v === elegido) ? elegido : '';
  }

  function dibujarFiltros() {
    const contar = campo => {
      const n = new Map();
      for (const c of estado.todos) n.set(c[campo], (n.get(c[campo]) ?? 0) + 1);
      return [...n].sort(([a], [b]) => comparar(a, b)).map(([v, k]) => [v, `${v} (${k})`]);
    };
    llenar(selEscuela, contar('escuela'), 'Todas las escuelas');
    llenar(selCharla, contar('capacitacion'), 'Todas las charlas');
  }

  function dibujarLista() {
    const lista = filtrados();
    const elegidos = lista.filter(c => estado.seleccion.has(c.id)).length;
    marcarTodos.checked = lista.length > 0 && elegidos === lista.length;
    marcarTodos.indeterminate = elegidos > 0 && elegidos < lista.length;

    const n = estado.seleccion.size;
    resumen.textContent = `${lista.length} certificado${lista.length === 1 ? '' : 's'} en la lista · ` +
      `${n} seleccionado${n === 1 ? '' : 's'}` +
      (n > elegidos ? ` (${n - elegidos} fuera del filtro actual)` : '');
    botonGenerar.disabled = n === 0 || estado.ocupado;
    reemplazar(botonGenerar, [icono(estado.ocupado ? 'fa-spinner fa-spin' : 'fa-file-pdf'),
      estado.ocupado ? ' Generando…' : ` Generar PDF${n ? ` (${n})` : ''}`]);

    if (lista.length === 0) {
      reemplazar(cuerpo, el('tr', {}, el('td', { colspan: 7, style: { textAlign: 'center' } },
        estado.todos.length ? 'Ningún certificado coincide con el filtro.' : 'No hay certificados cargados.')));
      return;
    }
    reemplazar(cuerpo, lista.map(fila));
  }

  function fila(c) {
    const marca = el('input', { type: 'checkbox', checked: estado.seleccion.has(c.id) || undefined,
      'aria-label': `Seleccionar a ${c.apellido}, ${c.nombre}`,
      onchange: () => {
        if (marca.checked) estado.seleccion.add(c.id); else estado.seleccion.delete(c.id);
        dibujarLista();
      } });
    return el('tr', { class: c.revisar ? 'cert-revisar' : null },
      el('td', {}, marca),
      el('td', {},
        el('strong', {}, `${c.apellido}, ${c.nombre}`), el('br'),
        el('small', { style: { color: 'var(--text-muted)' } }, c.dni ? `DNI ${c.dni}` : 'Sin DNI'),
        c.revisar && el('div', { class: 'cert-alerta' }, icono('fa-triangle-exclamation'), ' ',
          c.observaciones_participante || 'Dato para revisar')),
      el('td', {}, cursoCorto(c.curso)),
      el('td', {}, c.escuela),
      el('td', {}, c.capacitacion, el('br'),
        el('small', { style: { color: 'var(--text-muted)' } }, fechaCorta(c.fecha))),
      el('td', {},
        el('span', { class: `status-badge ${c.estado === 'impreso' ? 'active' : ''}` }, ESTADOS[c.estado] ?? c.estado),
        c.descargas ? el('small', { style: { display: 'block', color: 'var(--text-muted)' } },
          `${c.descargas} descarga${c.descargas === 1 ? '' : 's'}`) : null),
      el('td', { class: 'cert-botones' },
        el('button', { type: 'button', class: 'btn-action-sm btn-approve',
          'aria-label': `Certificado de ${c.apellido}, ${c.nombre}`,
          disabled: estado.ocupado || undefined,
          onclick: () => generar([c.id]) }, icono('fa-download'), ' PDF'),
        el('button', { type: 'button', class: 'btn-action-sm',
          'aria-label': `Corregir datos de ${c.apellido}, ${c.nombre}`,
          onclick: () => corregir(c) }, icono('fa-pen'), ' Corregir'),
        !c.descargas && c.estado === 'pendiente' && el('button', { type: 'button', class: 'btn-action-sm btn-reject',
          'aria-label': `Quitar el certificado de ${c.apellido}, ${c.nombre}`,
          onclick: () => quitar(c) }, icono('fa-trash'), ' Quitar')));
  }

  async function corregir(c) {
    try {
      const { abrirEdicion } = await import('./carga.js');
      await abrirEdicion(panel.ctx, c, { alTerminar: () => panel.recargar() });
    } catch (error) {
      panel.ctx.emitir('aviso', { tipo: 'error', texto: error.message });
    }
  }

  async function quitar(c) {
    if (!window.confirm(`¿Quitar el certificado de ${c.apellido}, ${c.nombre} (${c.capacitacion})?\n\n` +
      'Solo se puede porque nunca se descargó. La persona sigue en la base.')) return;
    try {
      await panel.ctx.api.eliminar('certificados', c.id);
      estado.seleccion.delete(c.id);
      panel.ctx.emitir('aviso', { tipo: 'info', texto: `Certificado ${c.id} quitado.` });
      await panel.recargar();
    } catch (error) {
      panel.ctx.emitir('aviso', { tipo: 'error', texto: error.message });
    }
  }

  /* ---------------------------------------------------------- generación */

  async function generar(ids) {
    if (!ids.length || estado.ocupado) return;
    const elegidos = ordenar(estado.todos.filter(c => ids.includes(c.id)));
    const aRevisar = elegidos.filter(c => c.revisar);
    const anulados = elegidos.filter(c => c.estado === 'anulado');
    if (anulados.length) {
      panel.ctx.emitir('aviso', { tipo: 'error',
        texto: `${anulados.length} certificado(s) están anulados y no se pueden emitir.` });
      return;
    }
    if (aRevisar.length && !window.confirm(
      `${aRevisar.length} de los certificados elegidos tienen datos marcados para revisar ` +
      `(por ejemplo, ${aRevisar[0].apellido}, ${aRevisar[0].nombre}: ${aRevisar[0].observaciones_participante}).\n\n` +
      '¿Generarlos igual?')) return;

    estado.ocupado = true;
    dibujarLista();
    try {
      const recursos = await cargarRecursos();
      const pdf = await generarPdf(elegidos, recursos,
        { fecha: `${estado.mes}-01`, mostrarCodigo: estado.codigo });
      descargar(pdf, nombreArchivo(elegidos));
      await panel.ctx.api.registrarEmision(elegidos.map(c => c.id));
      panel.ctx.emitir('aviso', { tipo: 'success',
        texto: elegidos.length === 1
          ? `Certificado de ${elegidos[0].apellido}, ${elegidos[0].nombre} generado.`
          : `${elegidos.length} certificados generados en un PDF.` });
      if (elegidos.length > 1) for (const c of elegidos) estado.seleccion.delete(c.id);
    } catch (error) {
      console.error('[certificados] No se pudo generar.', error);
      panel.ctx.emitir('aviso', { tipo: 'error', texto: `No se pudo generar el PDF: ${error.message}` });
    } finally {
      estado.ocupado = false;
      await panel.recargar();
    }
  }

  /* ------------------------------------------------------------- API */

  const panel = {
    ctx,
    /** Aplica filtros desde afuera (p. ej., "Ver certificados" de una capacitación). */
    filtrar(nuevos) {
      Object.assign(estado.filtros, { escuela: '', charla: '', estado: '', q: '' }, nuevos);
      selEscuela.value = estado.filtros.escuela;
      selCharla.value = estado.filtros.charla;
      selEstado.value = estado.filtros.estado;
      buscador.value = estado.filtros.q;
      dibujarLista();
    },
    async recargar() {
      if (panel.ctx.api.origen !== 'supabase') {
        reemplazar(aviso, el('p', { class: 'cert-alerta' }, icono('fa-database'), ' ',
          'Los certificados viven en la base de datos del portal. Esta versión funciona en modo demostración, sin base: ',
          'no hay certificados para mostrar.'));
      }
      const { items, total } = await panel.ctx.api.listar('certificados', { porPagina: 0 });
      estado.todos = ordenar(items);
      estado.total = total;
      const existentes = new Set(items.map(c => c.id));
      for (const id of estado.seleccion) if (!existentes.has(id)) estado.seleccion.delete(id);
      if (panel.ctx.api.origen === 'supabase') {
        reemplazar(aviso, total > items.length
          ? el('p', { class: 'cert-alerta' }, icono('fa-triangle-exclamation'),
              ` Se muestran ${items.length} de ${total} certificados. Avisá al equipo técnico para ampliar el límite de lectura.`)
          : []);
      }
      dibujarFiltros();
      dibujarLista();
    }
  };
  return panel;
}
