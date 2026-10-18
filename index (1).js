/**
 * modules/casos — Banco de Experiencias.
 *
 * Primera vista migrada al contrato de módulo. Se eligió esta porque es de
 * solo lectura: si algo sale mal, no se pierde nada. Y porque estaba rota: el
 * `app.js` llamaba a `renderCasosExitosos()`, que no existe en ninguna parte,
 * así que la grilla nunca se dibujó.
 */

import { el, icono, reemplazar, vacio } from '../../ui/dom.js';

export default {
  id: 'casos',
  ruta: '/casos',
  titulo: 'Casos Exitosos',
  icono: 'fa-award',
  contenedor: '#grid-casos',

  async montar(contenedor, ctx) {
    reemplazar(contenedor, vacio('Cargando experiencias…'));

    const { items } = await ctx.api.listar('casos', { porPagina: 0 });
    if (items.length === 0) {
      reemplazar(contenedor, vacio('Todavía no hay experiencias publicadas.'));
      return;
    }

    reemplazar(contenedor, items.map(caso => tarjeta(caso, ctx)));
  },

  desmontar() {}
};

function tarjeta(caso, ctx) {
  return el('article', { class: 'card-caso', style: { padding: '1.5rem' } },
    el('div', { style: { display: 'flex', justifyContent: 'space-between',
                         alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' } },
      el('span', { class: 'org-type-badge' }, caso.especialidad),
      caso.destacado && el('span', { class: 'status-badge active' }, 'Destacado')
    ),

    el('h3', { style: { fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--primary)' } },
      caso.titulo),

    dato('fa-school', caso.escuela),
    dato('fa-location-dot', `${caso.localidad} (Dpto. ${caso.departamento})`),
    dato('fa-industry', caso.empresa),

    bloque('Problemática', caso.problematica),
    bloque('Resultados', caso.resultados),

    caso.testimonio_estudiante && el('blockquote',
      { style: { borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem',
                 margin: '0.75rem 0', fontSize: '0.85rem', fontStyle: 'italic',
                 color: 'var(--text-muted)' } },
      limpiarComillas(caso.testimonio_estudiante)),

    el('div', { style: { borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem',
                         marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between',
                         alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
                         fontSize: '0.8rem', color: 'var(--text-muted)' } },
      el('span', {}, icono('fa-users'), ` ${caso.cantidad_estudiantes} estudiantes · ${caso.duración ?? caso.duracion ?? ''}`),
      el('button', {
        class: 'nav-btn btn-primary-action',
        onclick: () => ctx.emitir('caso:replicar', caso.id)
      }, '¿Querés replicar esta experiencia?')
    )
  );
}

const dato = (ico, texto) => texto
  ? el('p', { style: { fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-muted)' } },
      icono(ico), ' ', texto)
  : null;

const bloque = (titulo, texto) => texto
  ? el('p', { style: { fontSize: '0.85rem', marginTop: '0.6rem' } },
      el('strong', {}, `${titulo}: `), texto)
  : null;

const limpiarComillas = texto => String(texto).replace(/^["“]|["”]$/g, '');
