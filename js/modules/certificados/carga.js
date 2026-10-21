/**
 * modules/certificados/carga — carga de los estudiantes presentes en una
 * capacitación, desde la solapa Capacitaciones del Panel DETyFP. Cada
 * presente recibe su certificado (queda pendiente de imprimir).
 *
 * Una ventana con dos partes:
 *   1. La charla: una que ya está en la base, o una nueva (capacitación,
 *      escuela, fecha y disertantes).
 *   2. Una grilla tipo planilla para los estudiantes: se tipea, se pega desde
 *      Excel (Ctrl+V) o se llena subiendo un .xlsx / .csv. Enter baja a la fila
 *      siguiente, como en Excel.
 *
 * Al guardar, cada fila se valida por separado: las buenas se guardan y salen
 * de la grilla; las que tienen un problema quedan con el motivo para
 * corregirlas. Un estudiante que ya estaba en la base (mismo DNI) se reutiliza:
 * no se duplica.
 *
 * Los estudiantes de 5.° y 6.° año son en su mayoría menores, con autorización de su
 * escuela para hacer la capacitación, y reciben el mismo certificado. Sus datos
 * solo los ve y los carga el administrador (políticas de la migración 004).
 */

import { el, icono, reemplazar } from '../../ui/dom.js';
import { leerPlanilla, interpretar } from './planilla.js';
import {
  buscarEscuela, buscarEspecialidad, buscarCapacitacion, nombrePropio, limpiarDni, mismaPersona, sinTildes
} from './coincidencias.js';

const COLUMNAS = [
  { campo: 'dni', titulo: 'DNI', ancho: '7.5rem', ayuda: 'Con o sin puntos' },
  { campo: 'apellido', titulo: 'Apellido', ancho: '11rem' },
  { campo: 'nombre', titulo: 'Nombre', ancho: '12rem' },
  { campo: 'curso', titulo: 'Curso', ancho: '6rem', ayuda: 'Ej.: 6° 1°' },
  { campo: 'especialidad', titulo: 'Especialidad', ancho: '13rem' }
];
const NUEVA = '__nueva__';
const filaVacia = () => ({ dni: '', apellido: '', nombre: '', curso: '', especialidad: '', problema: '' });
const tieneDatos = f => COLUMNAS.some(c => String(f[c.campo]).trim());
const fechaCorta = f => (f ? f.split('-').reverse().join('/') : 'sin fecha');
const comparar = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true });

/* ======================================================= ventana de carga */

export async function abrirCarga(ctx, { alTerminar, capacitacionId } = {}) {
  const api = ctx.api;
  const avisar = (texto, tipo = 'info') => ctx.emitir('aviso', { texto, tipo });

  const cat = { escuelas: [], capacitaciones: [], dictados: [], especialidades: [] };
  async function cargarCatalogos() {
    const [e, c, d, s] = await Promise.all([
      api.listar('escuelas', { orden: 'nombre', porPagina: 0 }),
      api.listar('capacitaciones', { orden: 'titulo', porPagina: 0 }),
      api.listar('dictados', { porPagina: 0 }),
      api.listar('especialidades', { porPagina: 0 })
    ]);
    cat.escuelas = e.items;
    cat.capacitaciones = c.items;
    cat.dictados = d.items;
    cat.especialidades = [...s.items].sort(comparar);
  }
  await cargarCatalogos();

  const escuelaDe = id => cat.escuelas.find(e => e.id === id);
  const capacitacionDe = id => cat.capacitaciones.find(c => c.id === id);
  const etiquetaDictado = d =>
    `${capacitacionDe(d.capacitacion_id)?.titulo ?? d.capacitacion_id} · ${escuelaDe(d.escuela_id)?.nombre ?? d.escuela_id} · ${fechaCorta(d.fecha)}`;

  let filas = Array.from({ length: 8 }, filaVacia);
  let grupos = [];          // charlas distintas de la planilla subida
  let guardando = false;

  /* -------------------------------------------------------------- charla */

  const campo = (etiqueta, control, extra = {}) =>
    el('label', { class: 'cert-campo', ...extra }, el('span', {}, etiqueta), control);

  const selDictado = el('select', { class: 'cert-control', required: true, onchange: () => mostrarNueva() });
  const selCapacitacion = el('select', { class: 'cert-control', onchange: () => mostrarNueva() });
  const titulo = el('input', { class: 'cert-control', placeholder: 'Título de la capacitación' });
  const horas = el('input', { class: 'cert-control', type: 'number', min: '1', max: '999', value: '10' });
  const selEscuela = el('select', { class: 'cert-control' });
  const fecha = el('input', { class: 'cert-control', type: 'date' });
  const disertantes = el('input', { class: 'cert-control', placeholder: 'Ej.: Ing. Ana Pérez; Lic. Juan Gómez' });

  const bloqueTitulo = campo('Título de la capacitación nueva', titulo, { class: 'cert-campo cert-ancho' });
  const bloqueNueva = el('div', { class: 'cert-rejilla' },
    campo('Capacitación', selCapacitacion, { class: 'cert-campo cert-ancho' }),
    bloqueTitulo,
    campo('Horas a acreditar', horas),
    campo('Escuela', selEscuela, { class: 'cert-campo cert-ancho' }),
    campo('Fecha de la charla', fecha),
    campo('Disertantes', disertantes, { class: 'cert-campo cert-ancho' }));

  function llenarCharlas(elegido = selDictado.value) {
    const ordenados = [...cat.dictados].sort((a, b) => comparar(etiquetaDictado(a), etiquetaDictado(b)));
    selDictado.replaceChildren(
      el('option', { value: '' }, 'Elegí la charla…'),
      el('option', { value: NUEVA }, '➕ Nueva charla (otra escuela, otra fecha o capacitación nueva)'),
      ...ordenados.map(d => el('option', { value: d.id }, etiquetaDictado(d))));
    selDictado.value = elegido;

    const capElegida = selCapacitacion.value;
    selCapacitacion.replaceChildren(
      el('option', { value: '' }, 'Elegí la capacitación…'),
      el('option', { value: NUEVA }, '➕ Capacitación nueva'),
      ...cat.capacitaciones.filter(c => !c.ejemplo).map(c => el('option', { value: c.id }, c.titulo)));
    selCapacitacion.value = capElegida;

    const escElegida = selEscuela.value;
    selEscuela.replaceChildren(el('option', { value: '' }, 'Elegí la escuela…'),
      ...cat.escuelas.map(e => el('option', { value: e.id }, e.localidad ? `${e.nombre} (${e.localidad})` : e.nombre)));
    selEscuela.value = escElegida;
  }

  function mostrarNueva() {
    bloqueNueva.hidden = selDictado.value !== NUEVA;
    bloqueTitulo.hidden = selCapacitacion.value !== NUEVA;
    const cap = capacitacionDe(selCapacitacion.value);
    if (cap?.horas_certificadas && document.activeElement !== horas) horas.value = cap.horas_certificadas;
  }

  /** Deja elegida la charla que corresponde a un grupo de la planilla. */
  function elegirCharla({ charla, escuela, fecha: f, horas: h, disertantes: dis }) {
    const cap = buscarCapacitacion(charla, cat.capacitaciones);
    const esc = escuela ? buscarEscuela(escuela, cat.escuelas) : null;
    const existente = cap && esc && cat.dictados.find(d =>
      d.capacitacion_id === cap.id && d.escuela_id === esc.id && (d.fecha ?? '') === (f ?? ''));
    if (existente) {
      selDictado.value = existente.id;
    } else {
      selDictado.value = NUEVA;
      selCapacitacion.value = cap ? cap.id : (charla ? NUEVA : '');
      titulo.value = cap ? '' : (charla ?? '');
      if (Number(h) > 0) horas.value = Math.round(Number(h));
      selEscuela.value = esc?.id ?? '';
      fecha.value = f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : '';
      disertantes.value = dis ?? '';
    }
    mostrarNueva();
    if (escuela && !esc) avisar(`No reconocí la escuela "${escuela}": elegila de la lista.`, 'error');
  }

  /** Devuelve el dictado elegido; si es nuevo, lo crea (y la capacitación, si hace falta). */
  async function dictadoElegido() {
    if (!selDictado.value) throw new Error('Elegí la charla antes de guardar.');
    if (selDictado.value !== NUEVA) return cat.dictados.find(d => d.id === selDictado.value);

    let capacitacionId = selCapacitacion.value;
    if (!capacitacionId) throw new Error('Elegí la capacitación o marcá "Capacitación nueva".');
    if (!selEscuela.value) throw new Error('Elegí la escuela donde se dio la charla.');
    const h = Math.round(Number(horas.value));
    if (!(h > 0)) throw new Error('Indicá cuántas horas acredita la capacitación.');

    if (capacitacionId === NUEVA) {
      const t = titulo.value.trim();
      if (!t) throw new Error('Escribí el título de la capacitación nueva.');
      const repetida = buscarCapacitacion(t, cat.capacitaciones);
      capacitacionId = repetida?.id ?? (await api.crear('capacitaciones', {
        titulo: t, horas_certificadas: h, modalidad: 'Presencial', estado: 'Completada',
        organismo: null, tipo: null
      })).id;
    }
    const igual = cat.dictados.find(d => d.capacitacion_id === capacitacionId &&
      d.escuela_id === selEscuela.value && (d.fecha ?? '') === (fecha.value || ''));
    const dictado = igual ?? await api.crear('dictados', {
      capacitacion_id: capacitacionId, escuela_id: selEscuela.value,
      fecha: fecha.value || null, disertantes: disertantes.value.trim() || null
    });
    await cargarCatalogos();
    llenarCharlas(dictado.id);
    mostrarNueva();
    return cat.dictados.find(d => d.id === dictado.id) ?? dictado;
  }

  /* --------------------------------------------------------------- grilla */

  const cuerpo = el('tbody');
  const resumen = el('span', { class: 'cert-resumen', 'aria-live': 'polite' });
  const listaGrupos = el('div', { class: 'cert-grupos' });
  const datalist = el('datalist', { id: 'cert-lista-especialidades' });

  function dibujarGrilla(foco) {
    if (!filas.length || tieneDatos(filas[filas.length - 1])) filas.push(filaVacia());
    datalist.replaceChildren(...cat.especialidades.map(e => el('option', { value: e })));
    reemplazar(cuerpo, filas.map(filaDeGrilla));
    actualizarResumen();
    if (foco) celda(foco.f, foco.c)?.focus();
  }

  /** Al escribir en la última fila aparece otra vacía, sin redibujar (no se pierde el foco). */
  function asegurarFilaLibre() {
    if (!tieneDatos(filas[filas.length - 1])) return;
    filas.push(filaVacia());
    cuerpo.append(filaDeGrilla(filas[filas.length - 1], filas.length - 1));
  }

  function filaDeGrilla(f, i) {
    return el('tr', { class: f.problema ? 'cert-revisar' : null },
      el('td', { class: 'cert-num' }, String(i + 1)),
      COLUMNAS.map((c, j) => el('td', {}, el('input', {
        class: 'cert-celda', value: f[c.campo], 'data-f': String(i), 'data-c': String(j),
        'aria-label': `${c.titulo}, fila ${i + 1}`,
        placeholder: i > 0 && (c.campo === 'curso' || c.campo === 'especialidad') ? '↑ igual' : (i === 0 ? c.ayuda ?? '' : ''),
        list: c.campo === 'especialidad' ? 'cert-lista-especialidades' : null,
        autocomplete: 'off',
        oninput: e => { f[c.campo] = e.target.value; asegurarFilaLibre(); actualizarResumen(); },
        onblur: e => {
          if (c.campo === 'apellido' || c.campo === 'nombre') { f[c.campo] = nombrePropio(f[c.campo]); e.target.value = f[c.campo]; }
        }
      }))),
      el('td', {}, el('button', { type: 'button', class: 'btn-action-sm btn-reject', tabindex: '-1',
        'aria-label': `Quitar fila ${i + 1}`,
        onclick: () => { filas.splice(i, 1); dibujarGrilla(); } }, '×')),
      el('td', { class: 'cert-problema' }, f.problema || '')
    );
  }

  const celda = (f, c) => cuerpo.querySelector(`input[data-f="${f}"][data-c="${c}"]`);

  function actualizarResumen() {
    const n = filas.filter(tieneDatos).length;
    resumen.textContent = `${n} estudiante${n === 1 ? '' : 's'} en la grilla`;
    botonGuardar.disabled = guardando || n === 0;
  }

  // Teclado como en una planilla: Enter y flechas arriba/abajo cambian de fila.
  cuerpo.addEventListener('keydown', e => {
    const f = Number(e.target.dataset?.f);
    const c = Number(e.target.dataset?.c);
    if (Number.isNaN(f)) return;
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (f + 1 >= filas.length) { filas.push(filaVacia()); dibujarGrilla({ f: f + 1, c }); }
      else celda(f + 1, c)?.focus();
    } else if (e.key === 'ArrowUp' && f > 0) {
      e.preventDefault();
      celda(f - 1, c)?.focus();
    }
  });

  // Pegar desde Excel: filas separadas por renglón, columnas por tabulación.
  cuerpo.addEventListener('paste', e => {
    const texto = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(texto.trim())) return;
    e.preventDefault();
    const f0 = Number(e.target.dataset.f);
    const c0 = Number(e.target.dataset.c);
    const renglones = texto.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    renglones.forEach((renglon, i) => {
      while (filas.length <= f0 + i) filas.push(filaVacia());
      renglon.split('\t').forEach((valor, j) => {
        const columna = COLUMNAS[c0 + j];
        if (!columna) return;
        const limpio = valor.trim();
        filas[f0 + i][columna.campo] = columna.campo === 'apellido' || columna.campo === 'nombre'
          ? nombrePropio(limpio) : limpio;
      });
    });
    dibujarGrilla({ f: f0 + renglones.length - 1, c: c0 });
    avisar(`${renglones.length} fila(s) pegadas.`, 'info');
  });

  /* ------------------------------------------------------ subir planilla */

  const archivo = el('input', { type: 'file', accept: '.xlsx,.csv,.txt', hidden: true,
    onchange: async () => {
      const elegido = archivo.files?.[0];
      archivo.value = '';
      if (!elegido) return;
      try {
        const hojas = await leerPlanilla(elegido);
        const todas = [];
        let errores = 0;
        for (const hoja of hojas) {
          try { todas.push(...interpretar(hoja.filas).filas); } catch { errores++; }
        }
        if (!todas.length) {
          if (errores) interpretar(hojas[0].filas);   // lanza el motivo: no encontró encabezados
          throw new Error('La planilla no tiene filas con datos.');
        }
        prepararGrupos(todas, elegido.name);
      } catch (error) {
        avisar(error.message, 'error');
      }
    } });

  function prepararGrupos(todas, nombreArchivo) {
    const porCharla = new Map();
    for (const fila of todas) {
      const clave = [fila.charla, fila.escuela, fila.fecha].map(sinTildes).join('|');
      if (!porCharla.has(clave)) porCharla.set(clave, { ...fila, filas: [], cargado: false });
      porCharla.get(clave).filas.push(fila);
    }
    grupos = [...porCharla.values()];
    if (grupos.length === 1) {
      usarGrupo(grupos[0]);
      avisar(`${grupos[0].filas.length} estudiante(s) leídos de ${nombreArchivo}. Revisalos y guardá.`, 'success');
    } else {
      dibujarGrupos();
      avisar(`${nombreArchivo} tiene ${grupos.length} charlas distintas: elegí cuál cargar.`, 'info');
    }
  }

  function usarGrupo(grupo) {
    if (grupo.charla || grupo.escuela) elegirCharla(grupo);
    filas = grupo.filas.map(f => ({
      ...filaVacia(), dni: f.dni, apellido: nombrePropio(f.apellido), nombre: nombrePropio(f.nombre),
      curso: f.curso, especialidad: buscarEspecialidad(f.especialidad, cat.especialidades) ?? f.especialidad
    }));
    grupos.forEach(g => { g.activo = g === grupo; });
    dibujarGrupos();
    dibujarGrilla();
  }

  function dibujarGrupos() {
    if (grupos.length < 2) { reemplazar(listaGrupos); return; }
    reemplazar(listaGrupos,
      el('p', {}, el('strong', {}, 'Charlas de la planilla. '), 'Cargá una por vez: elegila, revisá la grilla y guardá.'),
      el('ul', {}, grupos.map(g => el('li', { class: g.activo ? 'cert-grupo-activo' : null },
        el('button', { type: 'button', class: 'btn-action-sm btn-approve', onclick: () => usarGrupo(g) },
          g.cargado ? '✓ Cargada' : g.activo ? 'En la grilla' : 'Cargar'),
        ` ${g.charla || 'Sin charla'} · ${g.escuela || 'escuela sin indicar'} · ${fechaCorta(g.fecha)} — ${g.filas.length} estudiante(s)`))));
  }

  /* ------------------------------------------------------------ guardar */

  async function guardar() {
    if (guardando) return;
    guardando = true;
    botonGuardar.disabled = true;
    reemplazar(botonGuardar, icono('fa-spinner fa-spin'), ' Guardando…');
    try {
      const dictado = await dictadoElegido();
      const cap = capacitacionDe(dictado.capacitacion_id);
      const horasCert = Number(cap?.horas_certificadas) || Math.round(Number(horas.value)) || 10;

      // Validación fila por fila; curso y especialidad vacíos repiten los de arriba.
      const conDatos = filas.filter(tieneDatos);
      let anterior = {};
      const listas = [];
      for (const f of conDatos) {
        f.problema = '';
        // Se completan en la fila, así una que queda para corregir no pierde el dato.
        f.curso = f.curso.trim() || anterior.curso || '';
        f.especialidad = f.especialidad.trim() || anterior.especialidad || '';
        anterior = { curso: f.curso, especialidad: f.especialidad };
        try {
          f.apellido = nombrePropio(f.apellido);
          f.nombre = nombrePropio(f.nombre);
          if (!f.apellido) throw new Error('Falta el apellido.');
          if (!f.nombre) throw new Error('Falta el nombre.');
          const dni = limpiarDni(f.dni);
          const curso = f.curso;
          if (!curso) throw new Error('Falta el curso.');
          if (!f.especialidad) throw new Error('Falta la especialidad.');
          const especialidad = buscarEspecialidad(f.especialidad, cat.especialidades);
          if (!especialidad) throw new Error(`No reconozco la especialidad "${f.especialidad}".`);
          listas.push({ f, dni, curso, especialidad });
        } catch (error) {
          f.problema = error.message;
        }
      }
      // Un DNI repetido dentro de la misma grilla.
      const vistos = new Map();
      for (const l of listas) {
        if (!l.dni) continue;
        if (vistos.has(l.dni) && !mismaPersona(vistos.get(l.dni).f, l.f)) {
          l.f.problema = `El DNI ${l.dni} está dos veces con nombres distintos.`;
          vistos.get(l.dni).f.problema = l.f.problema;
        }
        vistos.set(l.dni, l);
      }
      const validas = listas.filter(l => !l.f.problema);

      // Lo que ya está en la base, en tres consultas.
      const dnis = [...new Set(validas.map(l => l.dni).filter(Boolean))];
      const [porDni, deLaEscuela, yaEmitidos] = await Promise.all([
        dnis.length ? api.listar('participantes', { filtros: { dni: dnis }, porPagina: 0 }) : { items: [] },
        api.listar('participantes', { filtros: { escuela_id: dictado.escuela_id }, porPagina: 0 }),
        api.listar('certificados', { filtros: { dictado_id: dictado.id }, porPagina: 0 })
      ]);
      const personaPorDni = new Map(porDni.items.map(p => [p.dni, p]));
      const conCertificado = new Set(yaEmitidos.items.map(c => c.participante_id));

      let nuevos = 0;
      let repetidos = 0;
      for (const { f, dni, curso, especialidad } of validas) {
        try {
          let persona = dni ? personaPorDni.get(dni) : null;
          if (persona && !mismaPersona(persona, f)) {
            throw new Error(`Ese DNI ya figura como ${persona.apellido}, ${persona.nombre}. Revisá cuál es el correcto.`);
          }
          if (!persona && !dni) {
            persona = deLaEscuela.items.find(p => !p.dni && mismaPersona(p, f)) ?? null;
          }
          if (!persona) {
            persona = await api.crear('participantes', {
              dni, apellido: f.apellido, nombre: f.nombre, escuela_id: dictado.escuela_id,
              revisar: false, observaciones: dni ? null : 'Sin DNI (cargado a mano)'
            });
            if (dni) personaPorDni.set(dni, persona);
            else deLaEscuela.items.push(persona);
          }
          if (conCertificado.has(persona.id)) {
            repetidos++;
            f.guardada = true;
            continue;
          }
          await api.crear('certificados', {
            participante_id: persona.id, dictado_id: dictado.id, curso, especialidad, horas: horasCert,
            fuente: 'Carga manual en el portal'
          });
          conCertificado.add(persona.id);
          nuevos++;
          f.guardada = true;
        } catch (error) {
          f.problema = error.codigo === '23505'
            ? 'Ese DNI ya pertenece a otra persona de la base.'
            : error.message;
        }
      }

      const conProblema = filas.filter(f => tieneDatos(f) && !f.guardada);
      filas = conProblema.length ? conProblema : [];
      const grupo = grupos.find(g => g.activo);
      if (grupo && !conProblema.length) grupo.cargado = true;
      dibujarGrupos();
      dibujarGrilla();

      const partes = [`${nuevos} certificado${nuevos === 1 ? '' : 's'} cargado${nuevos === 1 ? '' : 's'}`];
      if (repetidos) partes.push(`${repetidos} ya lo tenía${repetidos === 1 ? '' : 'n'}`);
      if (conProblema.length) partes.push(`${conProblema.length} con problemas: quedaron en la grilla`);
      avisar(`${partes.join(' · ')}.`, conProblema.length ? 'error' : 'success');
      if (nuevos) await alTerminar?.();
    } catch (error) {
      avisar(error.message, 'error');
    } finally {
      guardando = false;
      reemplazar(botonGuardar, icono('fa-floppy-disk'), ' Guardar en la base');
      actualizarResumen();
    }
  }

  /* ------------------------------------------------------------- ventana */

  const botonGuardar = el('button', { type: 'button', class: 'btn-primary-action nav-btn', onclick: guardar },
    icono('fa-floppy-disk'), ' Guardar en la base');
  const dialogo = el('dialog', { class: 'cert-dialogo', 'aria-labelledby': 'cert-carga-titulo' },
    el('div', { class: 'cert-dialogo-cabecera' },
      el('h3', { id: 'cert-carga-titulo' }, 'Cargar estudiantes presentes'),
      el('button', { type: 'button', class: 'btn-action-sm', 'aria-label': 'Cerrar', onclick: () => dialogo.close() },
        icono('fa-xmark'))),
    el('section', {},
      el('h4', {}, '1. Charla'),
      campo('Charla a la que asistieron', selDictado, { class: 'cert-campo cert-ancho' }),
      bloqueNueva),
    el('section', {},
      el('h4', {}, '2. Estudiantes presentes'),
      el('div', { class: 'cert-acciones' },
        el('p', { class: 'cert-ayuda' },
          'Tipeá o pegá desde Excel (Ctrl+V). Enter baja a la fila siguiente. ',
          'Curso y especialidad vacíos repiten los de la fila de arriba.'),
        el('div', { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } },
          el('button', { type: 'button', class: 'nav-btn', onclick: () => archivo.click() },
            icono('fa-file-excel'), ' Subir Excel o CSV'),
          archivo)),
      listaGrupos,
      el('div', { class: 'table-responsive cert-grilla' },
        el('table', { class: 'data-table' },
          el('thead', {}, el('tr', {}, el('th', {}, '#'),
            COLUMNAS.map(c => el('th', { scope: 'col', style: { minWidth: c.ancho } }, c.titulo)),
            el('th', {}, ''), el('th', { scope: 'col' }, 'Revisar'))),
          cuerpo)),
      datalist),
    el('div', { class: 'cert-dialogo-pie' }, resumen,
      el('div', { style: { display: 'flex', gap: '0.5rem' } },
        el('button', { type: 'button', class: 'nav-btn', onclick: () => dialogo.close() }, 'Cerrar'),
        botonGuardar)));

  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  llenarCharlas('');
  // Abierta desde una capacitación: queda elegida; se completa escuela y fecha
  // (si esa charla ya existe, se reutiliza al guardar).
  if (capacitacionId && capacitacionDe(capacitacionId)) {
    selDictado.value = NUEVA;
    selCapacitacion.value = capacitacionId;
  }
  mostrarNueva();
  dibujarGrilla();
  dialogo.showModal();
  selDictado.focus();
  return dialogo;
}

/* ================================================== corregir un certificado */

/**
 * Edita los datos de un certificado ya cargado: nombre y DNI de la persona
 * (valen para todos sus certificados) y curso/especialidad de este. Sirve para
 * resolver los marcados "para revisar".
 */
export async function abrirEdicion(ctx, cert, { alTerminar } = {}) {
  const api = ctx.api;
  const { items: especialidades } = await api.listar('especialidades', { porPagina: 0 });
  const control = (valor, extra = {}) => el('input', { class: 'cert-control', value: valor ?? '', ...extra });
  const apellido = control(cert.apellido, { required: true });
  const nombre = control(cert.nombre, { required: true });
  const dni = control(cert.dni, { inputmode: 'numeric', placeholder: 'Sin DNI' });
  const curso = control(cert.curso, { required: true });
  const especialidad = el('select', { class: 'cert-control' },
    [...especialidades].sort(comparar).map(e => el('option', { value: e, selected: e === cert.especialidad || undefined }, e)));
  const verificado = el('input', { type: 'checkbox', checked: true });
  const campo = (etiqueta, nodo) => el('label', { class: 'cert-campo' }, el('span', {}, etiqueta), nodo);

  const formulario = el('form', { method: 'dialog' },
    el('div', { class: 'cert-dialogo-cabecera' },
      el('h3', {}, `Corregir ${cert.id}`),
      el('button', { type: 'button', class: 'btn-action-sm', 'aria-label': 'Cerrar', onclick: () => dialogo.close() }, icono('fa-xmark'))),
    cert.revisar && el('p', { class: 'cert-alerta' }, icono('fa-triangle-exclamation'), ' ', cert.observaciones_participante || 'Dato para revisar'),
    el('div', { class: 'cert-rejilla' },
      campo('Apellido', apellido), campo('Nombre', nombre), campo('DNI', dni),
      campo('Curso', curso), campo('Especialidad', especialidad)),
    el('p', { class: 'cert-ayuda' }, 'Apellido, nombre y DNI se corrigen en todos los certificados de esta persona.',
      cert.estado === 'impreso' ? ' Este certificado ya se imprimió: después de corregirlo, volvé a generarlo.' : ''),
    cert.revisar && el('label', { class: 'cert-check' }, verificado, ' Datos verificados: quitar la marca de revisar'),
    el('div', { class: 'cert-dialogo-pie' }, el('span'),
      el('div', { style: { display: 'flex', gap: '0.5rem' } },
        el('button', { type: 'button', class: 'nav-btn', onclick: () => dialogo.close() }, 'Cancelar'),
        el('button', { type: 'submit', class: 'btn-primary-action nav-btn' }, icono('fa-check'), ' Guardar cambios'))));

  formulario.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const datos = { apellido: nombrePropio(apellido.value), nombre: nombrePropio(nombre.value), dni: limpiarDni(dni.value) };
      if (!datos.apellido || !datos.nombre) throw new Error('Apellido y nombre son obligatorios.');
      if (!curso.value.trim()) throw new Error('El curso es obligatorio.');
      if (cert.revisar && verificado.checked) Object.assign(datos, { revisar: false, observaciones: null });
      await api.actualizar('participantes', cert.participante_id, datos);
      await api.actualizar('certificados', cert.id, { curso: curso.value.trim(), especialidad: especialidad.value });
      ctx.emitir('aviso', { texto: `${cert.id} corregido.`, tipo: 'success' });
      dialogo.close();
      await alTerminar?.();
    } catch (error) {
      ctx.emitir('aviso', { tipo: 'error',
        texto: error.codigo === '23505' ? 'Ese DNI ya pertenece a otra persona de la base.' : error.message });
    }
  });

  const dialogo = el('dialog', { class: 'cert-dialogo cert-dialogo-chico' }, formulario);
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
  apellido.focus();
}
