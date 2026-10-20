/**
 * modules/admin — Panel de gestión de la DETyFP.
 *
 * Última vista migrada: con ella, app.js deja de existir. Reúne cinco
 * solapas —bandeja de solicitudes, especialidades, nómina de practicantes,
 * capacitaciones y documentos— y es el único módulo con `roles: ['admin']`.
 *
 * Lo que cambia respecto del prototipo:
 *
 *   - Las solicitudes no se borran al aprobarlas o rechazarlas: quedan con su
 *     resolución, la fecha de cierre y quién la tomó (SDD §6, trazabilidad).
 *     Antes, aprobar era hacer desaparecer la fila.
 *   - Eliminar un documento desde el panel funciona. El botón llamaba a
 *     `window.deleteDocument()`, que no estaba definida.
 *   - Nada de `onclick="window.…"` en el HTML generado ni de `innerHTML` con
 *     datos: el nombre de un alumno o de una empresa se escribe como texto.
 *   - La solapa abierta viaja en la URL: `#/admin?tab=alumnos`.
 *
 * Sigue siendo un panel sin sesión real: el rol es el del desplegable. Los
 * datos de estudiantes son de menores de edad y no deben cargarse reales
 * hasta la fase 2 (SDD §9).
 */

import { el, icono, reemplazar, marcaEjemplo } from '../../ui/dom.js';
import { abrirModal, cerrarModal } from '../../ui/modal.js';

const SOLAPAS = ['solicitudes', 'especialidades', 'alumnos', 'capacitaciones', 'documentos'];
const TIPOS_SOLICITUD = {
  oferente: 'Oferente', experiencia: 'Experiencia', replica: 'Réplica', vinculacion: 'Vinculación'
};

export default {
  id: 'admin',
  ruta: '/admin',
  titulo: 'Panel DETyFP',
  icono: 'fa-sliders',
  roles: ['admin'],

  async montar(contenedor, ctx) {
    this.desmontar();
    this._ctx = ctx;
    this._desconectar = [];

    const pedida = ctx.params?.get('tab');
    this._solapa = SOLAPAS.includes(pedida) ? pedida : 'solicitudes';

    this._conectarSolapas();
    this._conectarFormularios();

    const redibujar = solapa => () => this._dibujar(solapa);
    this._desconectar.push(
      ctx.escuchar('solicitudes:cambiaron', redibujar('solicitudes')),
      ctx.escuchar('documentos:cambiaron', redibujar('documentos')),
      ctx.escuchar('especialidades:cambiaron', redibujar('especialidades'))
    );

    this._mostrarSolapa(this._solapa);
    await Promise.all(SOLAPAS.map(s => this._dibujar(s)));
  },

  desmontar() {
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
  },

  /* ------------------------------------------------------------- solapas */

  _conectarSolapas() {
    for (const item of document.querySelectorAll('[data-admin-tab]')) {
      item.setAttribute('role', 'tab');
      item.setAttribute('tabindex', '0');
      const elegir = () => {
        this._mostrarSolapa(item.dataset.adminTab);
        this._ctx.actualizarParams?.({ tab: item.dataset.adminTab === 'solicitudes' ? '' : item.dataset.adminTab });
      };
      const conTeclado = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } };
      item.addEventListener('click', elegir);
      item.addEventListener('keydown', conTeclado);
      this._desconectar.push(() => {
        item.removeEventListener('click', elegir);
        item.removeEventListener('keydown', conTeclado);
      });
    }
  },

  _mostrarSolapa(solapa) {
    this._solapa = solapa;
    for (const item of document.querySelectorAll('[data-admin-tab]')) {
      const actual = item.dataset.adminTab === solapa;
      item.classList.toggle('active', actual);
      item.setAttribute('aria-selected', String(actual));
    }
    for (const contenido of document.querySelectorAll('.admin-tab-content')) {
      contenido.style.display = contenido.id === `admin-tab-${solapa}` ? 'block' : 'none';
    }
  },

  async _dibujar(solapa) {
    const dibujantes = {
      solicitudes: () => this._dibujarSolicitudes(),
      especialidades: () => this._dibujarEspecialidades(),
      alumnos: () => this._dibujarAlumnos(),
      capacitaciones: () => this._dibujarCapacitaciones(),
      documentos: () => this._dibujarDocumentos()
    };
    try {
      await dibujantes[solapa]?.();
    } catch (error) {
      console.error(`[admin] No se pudo dibujar "${solapa}".`, error);
    }
  },

  /* ---------------------------------------------------------- solicitudes */

  async _dibujarSolicitudes() {
    const tabla = document.getElementById('admin-queue-table');
    if (!tabla) return;
    const { items } = await this._ctx.api.listar('solicitudes', { orden: '-fecha', porPagina: 0 });
    const pendientes = items.filter(s => (s.estado ?? 'Pendiente') === 'Pendiente');
    const resueltas = items.length - pendientes.length;

    marcarContador('solicitudes', pendientes.length);

    if (pendientes.length === 0) {
      reemplazar(tabla, filaVacia(6, resueltas
        ? `No hay solicitudes pendientes. ${resueltas} resuelta${resueltas === 1 ? '' : 's'} en el historial.`
        : 'No hay solicitudes en la bandeja de entrada.'));
      return;
    }

    reemplazar(tabla, pendientes.map(sol => el('tr', {},
      el('td', {}, el('strong', {}, sol.id)),
      el('td', {}, el('span', { class: 'org-type-badge' }, TIPOS_SOLICITUD[sol.tipo] ?? sol.tipo)),
      el('td', {}, sol.titulo, sol.ejemplo && ' ', marcaEjemplo(sol), el('br'),
        el('small', { style: { color: 'var(--text-muted)' } },
          [sol.solicitante, sol.correo, sol.cuit && `CUIT ${sol.cuit}`].filter(Boolean).join(' · ')),
        sol.detalles && el('details', { style: { marginTop: '0.25rem', fontSize: '0.8rem' } },
          el('summary', { style: { cursor: 'pointer' } }, 'Ver detalle'), sol.detalles)),
      el('td', {}, sol.departamento || '—'),
      el('td', {}, sol.fecha),
      el('td', {},
        boton('btn-approve', 'fa-check', 'Aprobar', () => this._resolver(sol, 'Aprobada'),
          `Aprobar ${sol.id}`),
        boton('btn-reject', 'fa-xmark', 'Rechazar', () => this._resolver(sol, 'Rechazada'),
          `Rechazar ${sol.id}`))
    )));
  },

  async _resolver(solicitud, estado) {
    await this._ctx.api.actualizar('solicitudes', solicitud.id, {
      estado,
      fecha_cierre: new Date().toISOString().slice(0, 10),
      resuelta_por: this._ctx.sesion?.etiquetaRol?.() ?? 'Administrador Provincial'
    });
    this._ctx.emitir('aviso', {
      texto: `Solicitud ${solicitud.id} ${estado.toLowerCase()}.`,
      tipo: estado === 'Aprobada' ? 'success' : 'info'
    });
    this._ctx.emitir('solicitudes:cambiaron');
  },

  /* ------------------------------------------------------- especialidades */

  async _dibujarEspecialidades() {
    const lista = document.getElementById('admin-spec-list');
    if (!lista) return;
    const { items } = await this._ctx.api.listar('especialidades', { porPagina: 0 });
    const ordenadas = [...items].sort((a, b) => a.localeCompare(b, 'es'));

    reemplazar(lista, ordenadas.map(esp => el('div', { class: 'spec-item-row' },
      el('span', {}, el('i', { class: 'fas fa-microchip', 'aria-hidden': 'true',
        style: { color: 'var(--primary)', marginRight: '0.5rem' } }), el('strong', {}, esp)),
      el('div', {},
        boton('btn-approve', 'fa-pen-to-square', 'Editar', () => this._editarEspecialidad(esp),
          `Editar ${esp}`),
        boton('btn-reject', 'fa-trash', 'Eliminar', () => this._eliminarEspecialidad(esp),
          `Eliminar ${esp}`))
    )));

    // Las listas desplegables del panel usan el mismo catálogo.
    llenarSelector('alu-spec', ordenadas, 'Seleccionar especialidad…');
  },

  async _agregarEspecialidad(nombre) {
    const { items } = await this._ctx.api.listar('especialidades', { porPagina: 0 });
    if (items.some(e => normalizar(e) === normalizar(nombre))) {
      throw new Error(`"${nombre}" ya está en el catálogo.`);
    }
    await this._ctx.api.crear('especialidades', nombre);
    this._ctx.emitir('especialidades:cambiaron');
    this._ctx.emitir('aviso', { texto: `Especialidad "${nombre}" incorporada.`, tipo: 'success' });
  },

  _editarEspecialidad(nombre) {
    const indice = document.getElementById('edit-spec-index');
    const campo = document.getElementById('edit-spec-name');
    if (indice) indice.value = nombre;     // guarda el nombre anterior
    if (campo) campo.value = nombre;
    abrirModal('editar-spec');
  },

  async _renombrarEspecialidad(anterior, nuevo) {
    if (!nuevo || anterior === nuevo) return;
    const api = this._ctx.api;
    const { items } = await api.listar('especialidades', { porPagina: 0 });
    if (items.some(e => e !== anterior && normalizar(e) === normalizar(nuevo))) {
      throw new Error(`"${nuevo}" ya está en el catálogo.`);
    }
    await api.eliminar('especialidades', anterior);
    await api.crear('especialidades', nuevo);

    // Las referencias se arrastran en oferentes y practicantes.
    const oferentes = await api.listar('oferentes', { filtros: { especialidades: anterior }, porPagina: 0 });
    for (const o of oferentes.items) {
      await api.actualizar('oferentes', o.id, {
        especialidades: o.especialidades.map(e => (e === anterior ? nuevo : e))
      });
    }
    const alumnos = await api.listar('estudiantes', { filtros: { especialidad: anterior }, porPagina: 0 });
    for (const a of alumnos.items) await api.actualizar('estudiantes', a.id, { especialidad: nuevo });

    // Las escuelas no: su fuente de verdad es data/escuelas.csv.
    const escuelas = await api.listar('escuelas', { filtros: { especialidades: anterior }, porPagina: 0 });

    this._ctx.emitir('especialidades:cambiaron');
    this._ctx.emitir('aviso', {
      texto: `"${anterior}" pasó a llamarse "${nuevo}".` + (escuelas.total
        ? ` ${escuelas.total} escuela(s) la siguen nombrando como antes: corregilas en escuelas.csv.`
        : ''),
      tipo: 'success'
    });
  },

  async _eliminarEspecialidad(nombre) {
    const api = this._ctx.api;
    const [escuelas, oferentes] = await Promise.all([
      api.listar('escuelas', { filtros: { especialidades: nombre }, porPagina: 0 }),
      api.listar('oferentes', { filtros: { especialidades: nombre }, porPagina: 0 })
    ]);
    const enUso = escuelas.total + oferentes.total;
    const pregunta = enUso
      ? `"${nombre}" la usan ${escuelas.total} escuela(s) y ${oferentes.total} oferente(s). ¿Eliminarla igual del catálogo?`
      : `¿Eliminar "${nombre}" del catálogo?`;
    if (!window.confirm(pregunta)) return;

    await api.eliminar('especialidades', nombre);
    this._ctx.emitir('especialidades:cambiaron');
    this._ctx.emitir('aviso', { texto: `Especialidad "${nombre}" eliminada.`, tipo: 'info' });
  },

  /* -------------------------------------------------------------- alumnos */

  async _dibujarAlumnos() {
    const tabla = document.getElementById('admin-alumnos-table');
    if (!tabla) return;
    const [alumnos, escuelas] = await Promise.all([
      this._ctx.api.listar('estudiantes', { orden: 'nombre', porPagina: 0 }),
      this._ctx.api.listar('escuelas', { orden: 'nombre', porPagina: 0 })
    ]);

    llenarSelector('alu-escuela', escuelas.items.map(e => e.nombre), 'Seleccionar escuela…',
      nombre => {
        const escuela = escuelas.items.find(e => e.nombre === nombre);
        return escuela?.localidad ? `${nombre} (${escuela.localidad})` : nombre;
      });

    if (alumnos.items.length === 0) {
      reemplazar(tabla, filaVacia(6, 'No hay estudiantes en la nómina.'));
      return;
    }
    reemplazar(tabla, alumnos.items.map(a => el('tr', {},
      el('td', {}, el('strong', {}, a.dni)),
      el('td', {}, a.nombre, a.ejemplo && ' ', marcaEjemplo(a), el('br'), el('small', { style: { color: 'var(--text-muted)' } }, a.curso ?? '')),
      el('td', {}, a.escuela),
      el('td', {}, el('span', { class: 'tag-spec' }, a.especialidad)),
      el('td', {}, el('span', { class: `status-badge ${a.estado === 'En Práctica' ? 'active' : ''}` }, a.estado)),
      el('td', {}, a.empresa || 'Por asignar')
    )));
  },

  async _agregarAlumno() {
    const valor = id => document.getElementById(id)?.value.trim() ?? '';
    const dni = valor('alu-dni').replace(/\D/g, '');
    if (dni.length < 7 || dni.length > 8) throw new Error('El DNI debe tener 7 u 8 dígitos.');

    const existentes = await this._ctx.api.listar('estudiantes', { porPagina: 0 });
    const dniFormateado = Number(dni).toLocaleString('es-AR');
    if (existentes.items.some(a => String(a.dni).replace(/\D/g, '') === dni)) {
      throw new Error(`Ya hay un estudiante con DNI ${dniFormateado} en la nómina.`);
    }

    const alumno = await this._ctx.api.crear('estudiantes', {
      dni: dniFormateado,
      nombre: valor('alu-nombre'),
      escuela: valor('alu-escuela'),
      especialidad: valor('alu-spec'),
      curso: valor('alu-curso') || '7° año',
      estado: valor('alu-estado'),
      empresa: valor('alu-empresa') || ''
    });
    this._ctx.emitir('aviso', { texto: `${alumno.nombre} incorporado/a a la nómina.`, tipo: 'success' });
    await this._dibujarAlumnos();
  },

  /* ------------------------------------------------------- capacitaciones */

  async _dibujarCapacitaciones() {
    const envoltorio = document.getElementById('admin-capacitaciones-table-wrapper');
    if (!envoltorio) return;
    const { items } = await this._ctx.api.listar('capacitaciones', { porPagina: 0 });
    const columnas = ['Programa de capacitación', 'Organismo oferente', 'Tipo', 'Hs certificadas', 'Inscriptos', 'Estado'];

    reemplazar(envoltorio, el('table', { class: 'data-table' },
      el('thead', {}, el('tr', {}, columnas.map(c => el('th', { scope: 'col' }, c)))),
      el('tbody', {}, items.length === 0
        ? filaVacia(columnas.length, 'No hay capacitaciones cargadas.')
        : items.map(c => el('tr', {},
            el('td', {}, el('strong', {}, c.titulo), c.ejemplo && ' ', marcaEjemplo(c)),
            el('td', {}, c.organismo),
            el('td', {}, el('span', { class: 'org-type-badge' }, c.tipo)),
            el('td', {}, `${c.horas_certificadas} h`),
            el('td', {}, String(c.participantes_inscritos)),
            el('td', {}, el('span', { class: `status-badge ${c.estado === 'En Curso' ? 'active' : ''}` }, c.estado))
          )))
    ));
  },

  /* ----------------------------------------------------------- documentos */

  async _dibujarDocumentos() {
    const tabla = document.getElementById('admin-docs-table');
    if (!tabla) return;
    const { items } = await this._ctx.api.listar('documentos', { orden: '-fecha', porPagina: 0 });
    if (items.length === 0) {
      reemplazar(tabla, filaVacia(5, 'No hay documentos en el repositorio.'));
      return;
    }
    reemplazar(tabla, items.map(doc => el('tr', {},
      el('td', {}, el('strong', {}, doc.titulo), doc.ejemplo && ' ', marcaEjemplo(doc)),
      el('td', {}, el('span', { class: 'org-type-badge' }, doc.categoria)),
      el('td', {}, `${doc.tipo_archivo} (${doc.tamaño ?? 's/d'})`),
      el('td', {}, doc.fecha),
      el('td', {}, boton('btn-reject', 'fa-trash', 'Eliminar', () => this._eliminarDocumento(doc),
        `Eliminar ${doc.titulo}`))
    )));
  },

  async _eliminarDocumento(doc) {
    if (!window.confirm(`¿Eliminar "${doc.titulo}" del repositorio?`)) return;
    await this._ctx.api.eliminar('documentos', doc.id);
    this._ctx.emitir('aviso', { texto: `"${doc.titulo}" eliminado del repositorio.`, tipo: 'info' });
    this._ctx.emitir('documentos:cambiaron');
  },

  /* ---------------------------------------------------------- formularios */

  _conectarFormularios() {
    this._alEnviar('form-add-spec', async formulario => {
      const campo = document.getElementById('new-spec-name');
      await this._agregarEspecialidad(campo.value.trim());
      formulario.reset();
    });
    this._alEnviar('form-edit-spec', async () => {
      const anterior = document.getElementById('edit-spec-index').value;
      const nuevo = document.getElementById('edit-spec-name').value.trim();
      await this._renombrarEspecialidad(anterior, nuevo);
      cerrarModal('editar-spec');
    });
    this._alEnviar('form-add-alumno', async formulario => {
      await this._agregarAlumno();
      formulario.reset();
      cerrarModal('alumno');
    });
  },

  _alEnviar(id, accion) {
    const formulario = document.getElementById(id);
    if (!formulario) return;
    const manejar = async evento => {
      evento.preventDefault();
      try {
        await accion(formulario);
      } catch (error) {
        this._ctx.emitir('aviso', { texto: error.message, tipo: 'error' });
      }
    };
    formulario.addEventListener('submit', manejar);
    this._desconectar.push(() => formulario.removeEventListener('submit', manejar));
  }
};

/* ------------------------------------------------------------------ vistas */

function boton(clase, ico, texto, accion, etiqueta) {
  return el('button', { type: 'button', class: `btn-action-sm ${clase}`, onclick: accion,
                        'aria-label': etiqueta }, icono(ico), ` ${texto}`);
}

const filaVacia = (columnas, texto) =>
  el('tr', {}, el('td', { colspan: columnas, style: { textAlign: 'center' } }, texto));

function marcarContador(solapa, cantidad) {
  const item = document.querySelector(`[data-admin-tab="${solapa}"]`);
  if (!item) return;
  let insignia = item.querySelector('.contador-pendientes');
  if (!insignia) {
    insignia = el('span', { class: 'contador-pendientes',
      style: { marginLeft: '0.4rem', background: 'var(--accent-amber, #f59e0b)', color: '#1f2937',
               borderRadius: '999px', padding: '0 0.45rem', fontSize: '0.75rem', fontWeight: '700' } });
    item.append(insignia);
  }
  insignia.textContent = cantidad ? String(cantidad) : '';
  insignia.style.display = cantidad ? 'inline-block' : 'none';
  insignia.setAttribute('aria-label', `${cantidad} pendiente${cantidad === 1 ? '' : 's'}`);
}

function llenarSelector(id, valores, invitacion, etiqueta = v => v) {
  const selector = document.getElementById(id);
  if (!selector) return;
  const elegido = selector.value;
  selector.replaceChildren(
    el('option', { value: '' }, invitacion),
    ...valores.map(v => el('option', { value: v }, etiqueta(v)))
  );
  selector.value = valores.includes(elegido) ? elegido : '';
}

const normalizar = texto =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
