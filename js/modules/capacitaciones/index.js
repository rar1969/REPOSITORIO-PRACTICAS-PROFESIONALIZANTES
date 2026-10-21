/**
 * modules/capacitaciones — oferta de formación en organismos.
 *
 * Segunda vista migrada. Misma forma que `casos`, a propósito: el contrato se
 * confirma recién cuando dos módulos distintos lo cumplen sin excepciones.
 * También estaba sin dibujar, por el mismo error de `app.js`.
 */

import { el, icono, reemplazar, vacio, marcaEjemplo } from '../../ui/dom.js';

const ORDEN_ESTADO = { 'En Curso': 0, 'Próxima': 1, 'Completada': 2 };

export default {
  id: 'capacitaciones',
  ruta: '/capacitaciones',
  titulo: 'Capacitaciones',
  icono: 'fa-chalkboard-user',
  contenedor: '#grid-capacitaciones',

  async montar(contenedor, ctx) {
    reemplazar(contenedor, vacio('Cargando capacitaciones…'));

    const { items } = await ctx.api.listar('capacitaciones', { porPagina: 0 });
    if (items.length === 0) {
      reemplazar(contenedor, vacio('No hay capacitaciones cargadas.'));
      return;
    }

    // En curso primero, después las próximas, al final las terminadas.
    const ordenadas = [...items].sort(
      (a, b) => (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9)
    );
    reemplazar(contenedor, ordenadas.map(tarjeta));
  },

  desmontar() {}
};

function tarjeta(cap) {
  return el('article', { class: 'card-caso',
                         style: { padding: '1.5rem', justifyContent: 'space-between' } },
    el('div', {},
      el('div', { style: { display: 'flex', justifyContent: 'space-between',
                           alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' } },
        el('span', { style: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' } },
          cap.tipo && el('span', { class: 'org-type-badge' }, cap.tipo), marcaEjemplo(cap)),
        el('span', { class: `status-badge ${cap.estado === 'En Curso' ? 'active' : ''}` }, cap.estado)
      ),
      el('h3', { style: { fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--primary)' } },
        cap.titulo),
      dato('fa-building-columns', 'Impartido por', cap.organismo),
      dato('fa-users-gear', 'Destinatarios', cap.destinatarios),
      dato('fa-location-dot', 'Lugar', cap.lugar),
      dato('fa-calendar-days', 'Cursada', periodo(cap))
    ),
    el('div', { style: { borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem',
                         display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
                         gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' } },
      el('span', {}, icono('fa-clock'), ` ${cap.horas_certificadas} h certificadas`),
      el('span', {}, icono('fa-user-check'), ` ${cap.participantes_inscritos} inscriptos`),
      el('span', {}, icono('fa-school'), ` ${cap.escuelas_participantes} escuelas`)
    )
  );
}

const dato = (ico, titulo, texto) => texto
  ? el('p', { style: { fontSize: '0.85rem', marginBottom: '0.4rem' } },
      icono(ico), ' ', el('strong', {}, `${titulo}: `), texto)
  : null;

function periodo(cap) {
  if (!cap.fecha_inicio) return '';
  const dma = f => f.split('-').reverse().join('/');
  return cap.fecha_fin ? `${dma(cap.fecha_inicio)} al ${dma(cap.fecha_fin)}` : dma(cap.fecha_inicio);
}
