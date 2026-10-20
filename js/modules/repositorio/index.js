/**
 * modules/repositorio — catálogo documental de la ETP.
 *
 * Lo que la distingue de las anteriores: tiene acciones
 * que escriben (contar una descarga, eliminar un documento) y una de ellas
 * depende del rol.
 *
 * Arrastraba un error que se arregla solo al modularizar. El `app.js` buscaba
 * sus categorías con `querySelectorAll('.cat-chip')`, y esa clase también la
 * usan los tres botones del mapa. Clic en "Solo escuelas" y después abrir el
 * repositorio dejaba la lista vacía: el filtro había quedado en `undefined`.
 * Acá el selector es `.repo-categories .cat-chip`, acotado al módulo.
 */

import { el, icono, reemplazar, marcaEjemplo } from '../../ui/dom.js';

const ICONOS = { pdf: 'fa-file-pdf', xlsx: 'fa-file-excel', docx: 'fa-file-word' };

export default {
  id: 'repositorio',
  ruta: '/repositorio',
  titulo: 'Repositorio',
  icono: 'fa-folder-open',
  contenedor: '#doc-list',

  async montar(contenedor, ctx) {
    // Montar sobre un módulo ya montado duplicaría los oyentes. El ruteador
    // siempre desmonta antes, pero el módulo no depende de que lo haga.
    this.desmontar();

    this._ctx = ctx;
    this._contenedor = contenedor;
    this._estado = {
      categoria: ctx.params?.get('cat') || 'Todos',
      q: ctx.params?.get('q') || ''
    };
    this._desconectar = [];

    this._conectarCategorias();
    this._conectarBusqueda();

    // Cambiar de rol muestra u oculta "Eliminar"; una carga nueva, la lista.
    // (El app.js llamaba acá a `renderRepositorio()`, que ya no existía: el
    // cambio de rol se cortaba con un error antes de terminar.)
    this._desconectar.push(
      ctx.escuchar('rol:cambiado', () => this._dibujar()),
      ctx.escuchar('documentos:cambiaron', () => this._dibujar())
    );
    await this._dibujar();
  },

  desmontar() {
    clearTimeout(this._espera);
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
  },

  /* ------------------------------------------------------------ internos */

  _conectarCategorias() {
    // Acotado al contenedor del repositorio: los chips del mapa quedan afuera.
    for (const chip of document.querySelectorAll('.repo-categories .cat-chip')) {
      const alHacerClic = () => {
        this._estado.categoria = chip.dataset.cat || 'Todos';
        this._marcarCategoria();
        this._sincronizarUrl();
        this._dibujar();
      };
      chip.addEventListener('click', alHacerClic);
      this._desconectar.push(() => chip.removeEventListener('click', alHacerClic));
    }
    this._marcarCategoria();
  },

  _conectarBusqueda() {
    const campo = document.querySelector('#search-repo');
    if (!campo) return;
    campo.value = this._estado.q;

    const alEscribir = () => {
      clearTimeout(this._espera);
      this._espera = setTimeout(() => {
        this._estado.q = campo.value;
        this._sincronizarUrl();
        this._dibujar();
      }, 250);
    };
    campo.addEventListener('input', alEscribir);
    this._desconectar.push(() => campo.removeEventListener('input', alEscribir));
  },

  _marcarCategoria() {
    for (const chip of document.querySelectorAll('.repo-categories .cat-chip')) {
      chip.classList.toggle('active', (chip.dataset.cat || 'Todos') === this._estado.categoria);
    }
  },

  _sincronizarUrl() {
    this._ctx.actualizarParams?.({
      cat: this._estado.categoria === 'Todos' ? '' : this._estado.categoria,
      q: this._estado.q
    });
  },

  async _dibujar() {
    const { categoria, q } = this._estado;
    const filtros = { q };
    if (categoria !== 'Todos') filtros.categoria = categoria;

    const { items } = await this._ctx.api.listar('documentos', { filtros, porPagina: 0 });

    if (items.length === 0) {
      reemplazar(this._contenedor, sinDocumentos(categoria));
      return;
    }

    const puedeBorrar = this._ctx.sesion?.esAdmin?.() ?? false;
    reemplazar(this._contenedor,
      items.map(doc => fila(doc, puedeBorrar, {
        descargar: () => this._descargar(doc),
        eliminar: () => this._eliminar(doc)
      }))
    );
  },

  async _descargar(doc) {
    // El contador se guarda antes de bajar el archivo: si la descarga falla,
    // igual quedó registrado el pedido, que es lo que la Dirección mide.
    await this._ctx.api.actualizar('documentos', doc.id, { descargas: (doc.descargas ?? 0) + 1 });

    this._ctx.emitir('documento:descargar', doc.id);
    await this._dibujar();
  },

  async _eliminar(doc) {
    if (!window.confirm(`¿Eliminar "${doc.titulo}" del repositorio?`)) return;
    await this._ctx.api.eliminar('documentos', doc.id);
    this._ctx.emitir('aviso', { texto: `"${doc.titulo}" eliminado del repositorio.`, tipo: 'info' });
    this._ctx.emitir('documentos:cambiaron');   // redibuja esta lista y la del panel
  }
};

/* ------------------------------------------------------------------ vistas */

function fila(doc, puedeBorrar, acciones) {
  const tipo = String(doc.tipo_archivo || '').toLowerCase();

  return el('article', { class: 'doc-item' },
    el('div', { class: `doc-icon ${tipo}` }, icono(ICONOS[tipo] ?? 'fa-file')),

    el('div', { class: 'doc-meta' },
      el('h4', {}, doc.titulo, doc.ejemplo && ' ', marcaEjemplo(doc)),
      el('p', {}, doc.descripcion),
      el('div', { class: 'doc-tags' },
        etiqueta('fa-tag', doc.categoria),
        etiqueta('fa-building-columns', doc.organismo),
        etiqueta('fa-clock', `v${doc.version} (${doc.fecha})`),
        etiqueta('fa-download', `${doc.descargas ?? 0} descargas`)
      )
    ),

    el('div', { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } },
      el('button', { class: 'doc-action-btn', onclick: acciones.descargar },
        ...etiquetaAccion(doc)),

      puedeBorrar && el('button', {
        class: 'doc-action-btn',
        title: 'Eliminar documento del repositorio',
        style: { background: 'rgba(239, 68, 68, .15)', color: '#ef4444' },
        onclick: acciones.eliminar
      }, icono('fa-trash'), ' Eliminar')
    )
  );
}

function etiquetaAccion(doc) {
  if (doc.url) return [icono('fa-arrow-up-right-from-square'), ' Abrir'];
  const tieneArchivo = doc.archivo_en_sesion || doc.url;
  return [icono('fa-download'), ` Descargar${tieneArchivo && doc.tamaño ? ` (${doc.tamaño})` : ''}`];
}

const etiqueta = (ico, texto) => texto ? el('span', {}, icono(ico), ` ${texto}`) : null;

const sinDocumentos = categoria =>
  el('div', { role: 'status',
              style: { textAlign: 'center', padding: '3rem', background: 'var(--bg-card)',
                       borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' } },
    el('i', { class: 'fas fa-folder-open', 'aria-hidden': 'true',
              style: { fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' } }),
    el('h3', {}, categoria === 'Todos'
      ? 'No se encontraron documentos'
      : `No hay documentos en "${categoria}"`),
    el('p', { style: { color: 'var(--text-muted)' } },
      'Probá con otra categoría o cambiá la palabra clave.')
  );
