/**
 * modules/directorio — búsqueda y filtrado de oferentes.
 *
 * Primera vista migrada con estado propio, y la que pone a prueba el contrato:
 * tiene cuatro filtros, paginado y un botón que abre una ficha que todavía
 * vive en `app.js`.
 *
 * Tres cosas que no hacía el prototipo:
 *
 *   1. Los filtros viajan en la URL (`#/directorio?dept=Monteros&esp=Química`),
 *      así que una búsqueda se puede mandar por WhatsApp a una escuela.
 *   2. Pagina. Con 5 oferentes no se nota; con los 2.000 que prevé el SDD,
 *      dibujar todo de una vez cuelga el navegador.
 *   3. Las listas de departamentos y especialidades salen de los datos. En el
 *      HTML estaban escritas a mano, y les faltaba Juan Bautista Alberdi.
 */

import { el, icono, reemplazar, vacio } from '../../ui/dom.js';
import { conectarFiltros } from '../../ui/filtros.js';

const POR_PAGINA = 12;

// Clave corta en la URL ← campo del filtro.
const EN_URL = { q: 'q', esp: 'especialidades', dept: 'departamento', est: 'estado' };

export default {
  id: 'directorio',
  ruta: '/directorio',
  titulo: 'Directorio de Oferentes',
  icono: 'fa-building',
  contenedor: '#grid-oferentes',

  async montar(contenedor, ctx) {
    this._ctx = ctx;
    this._contenedor = contenedor;
    this._pagina = 1;

    const inicial = {};
    for (const [corta, campo] of Object.entries(EN_URL)) {
      inicial[campo] = ctx.params?.get(corta) ?? '';
    }

    this._filtros = conectarFiltros({
      campos: {
        q: '#filter-search',
        especialidades: '#filter-spec',
        departamento: '#filter-dept',
        estado: '#filter-status'
      },
      limpiar: '#btn-reset-filters',
      inicial,
      alCambiar: estado => {
        this._pagina = 1;
        this._sincronizarUrl(estado);
        this._dibujar(estado);
      }
    });

    // Las listas, desde los datos y no desde el HTML.
    const [especialidades, departamentos] = await Promise.all([
      ctx.api.listar('especialidades', { porPagina: 0 }),
      ctx.api.listar('departamentos', { porPagina: 0 })
    ]);
    this._filtros.poblar('especialidades', especialidades.items);
    this._filtros.poblar('departamento', [...departamentos.items].sort((a, b) => a.localeCompare(b, 'es')));

    await this._dibujar(this._filtros.estado());
  },

  desmontar() {
    this._filtros?.desmontar();
    this._filtros = null;
  },

  /* ------------------------------------------------------------ internos */

  _sincronizarUrl(estado) {
    const params = {};
    for (const [corta, campo] of Object.entries(EN_URL)) params[corta] = estado[campo];
    this._ctx.actualizarParams?.(params);
  },

  async _dibujar(estado) {
    const ctx = this._ctx;
    const contenedor = this._contenedor;

    const { items, total } = await ctx.api.listar('oferentes', {
      filtros: estado,
      orden: 'razon_social',
      pagina: this._pagina,
      porPagina: POR_PAGINA
    });

    if (total === 0) {
      reemplazar(contenedor, sinResultados(() => {
        document.querySelector('#btn-reset-filters')?.click();
      }));
      return;
    }

    reemplazar(contenedor,
      items.map(oferente => tarjeta(oferente, ctx)),
      paginador(this._pagina, total, pagina => {
        this._pagina = pagina;
        this._dibujar(estado);
        contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );
  }
};

/* ------------------------------------------------------------------ vistas */

function tarjeta(oferente, ctx) {
  const vigente = Boolean(oferente.convenio_vigente);

  return el('article', { class: 'card-oferente' },
    el('div', { class: 'card-top' },
      el('span', { class: 'org-type-badge' }, oferente.tipo_organizacion),
      el('span', { class: `status-badge ${oferente.estado}` },
        icono('fa-circle'), ` Convenio ${vigente ? 'vigente' : 'en trámite'}`)
    ),

    el('div', { class: 'card-title' },
      el('h3', {}, oferente.razon_social),
      el('div', { class: 'card-location' },
        icono('fa-location-dot'), ` ${oferente.localidad}, Dpto. ${oferente.departamento}`)
    ),

    el('div', { class: 'specialties-tags' },
      (oferente.especialidades ?? []).map(esp =>
        el('span', { class: 'tag-spec' }, icono('fa-wrench'), ` ${esp}`))
    ),

    el('div', { class: 'card-details' },
      el('span', {}, icono('fa-users'), ' Vacantes: ',
        el('strong', { class: 'cupos-highlight' }, `${oferente.cupos_disponibles ?? 0} cupos`)),
      el('span', {}, icono('fa-calendar'), ` Act: ${oferente.fecha_actualizacion ?? 's/d'}`)
    ),

    el('div', { class: 'card-actions' },
      el('button', {
        class: 'btn-card',
        onclick: () => ctx.emitir('oferente:ver', oferente.id)
      }, icono('fa-circle-info'), ' Ver ficha completa')
    )
  );
}

const sinResultados = alLimpiar =>
  el('div', { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '3rem',
                       background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                       border: '1px dashed var(--border-color)' } },
    el('i', { class: 'fas fa-building-circle-exclamation', 'aria-hidden': 'true',
              style: { fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' } }),
    el('h3', {}, 'Ningún oferente coincide con estos filtros'),
    el('p', { style: { color: 'var(--text-muted)', marginBottom: '1rem' } },
      'Probá con otro departamento, otra especialidad, o limpiá la búsqueda.'),
    el('button', { class: 'btn-card', onclick: alLimpiar },
      icono('fa-rotate'), ' Limpiar los filtros')
  );

function paginador(pagina, total, ir) {
  const paginas = Math.ceil(total / POR_PAGINA);
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  const leyenda = el('span', { role: 'status', style: { color: 'var(--text-muted)', fontSize: '0.85rem' } },
    paginas > 1 ? `${desde}–${hasta} de ${total} oferentes` : `${total} oferente${total === 1 ? '' : 's'}`);

  if (paginas <= 1) {
    return el('div', { style: { gridColumn: '1 / -1', textAlign: 'center', paddingTop: '0.5rem' } }, leyenda);
  }

  const boton = (texto, destino, deshabilitado) =>
    el('button', {
      class: 'btn-card', disabled: deshabilitado || null,
      'aria-label': texto, onclick: () => ir(destino),
      style: deshabilitado ? { opacity: '0.4', cursor: 'default' } : null
    }, texto);

  return el('nav', {
      'aria-label': 'Paginación del directorio',
      style: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'center',
               alignItems: 'center', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem' }
    },
    boton('‹ Anteriores', pagina - 1, pagina === 1),
    leyenda,
    boton('Siguientes ›', pagina + 1, pagina === paginas)
  );
}
