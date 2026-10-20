/**
 * modules/oferente — ficha institucional de un oferente.
 *
 * La piden el directorio y el mapa con `oferente:ver`; ninguno de los dos sabe
 * que existe este módulo, y por eso es persistente: tiene que responder aunque
 * la vista abierta sea otra. Si un día se borra esta carpeta, los botones
 * "Ver ficha" quedan sin efecto, pero nada se rompe.
 *
 * El botón "Solicitar vinculación" del prototipo mostraba un `alert()` y no
 * guardaba nada. Ahora deja una solicitud de tipo `vinculacion` en la bandeja
 * de la Dirección, con el oferente y el perfil de quien la pidió.
 */

import { el, icono, reemplazar, marcaEjemplo } from '../../ui/dom.js';
import { abrirModal, cerrarModal } from '../../ui/modal.js';

export default {
  id: 'oferente',
  persistente: true,
  titulo: 'Ficha del oferente',

  montar(_contenedor, ctx) {
    this._ctx = ctx;
    this._cortar = ctx.escuchar('oferente:ver', id => this._abrir(id));
  },

  desmontar() {
    this._cortar?.();
  },

  async _abrir(id) {
    const destino = document.getElementById('modal-detalle-content');
    if (!destino) return;
    const oferente = await this._ctx.api.obtener('oferentes', id);
    if (!oferente) {
      this._ctx.emitir('aviso', { texto: `No se encontró el oferente ${id}.`, tipo: 'error' });
      return;
    }
    reemplazar(destino, ficha(oferente, () => this._vincular(oferente)));
    abrirModal('detalle');
  },

  async _vincular(oferente) {
    await this._ctx.api.crear('solicitudes', {
      tipo: 'vinculacion',
      titulo: oferente.razon_social,
      oferente_id: oferente.id,
      solicitante: `Perfil: ${this._ctx.sesion?.etiquetaRol?.() ?? 'Visitante'}`,
      departamento: oferente.departamento,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente'
    });
    cerrarModal('detalle');
    this._ctx.emitir('solicitudes:cambiaron');
    this._ctx.emitir('aviso', {
      texto: 'Pedido de vinculación registrado. La Dirección de ETP se contacta con el establecimiento.',
      tipo: 'success'
    });
  }
};

function ficha(o, vincular) {
  const caja = { background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)' };

  return el('div', {},
    el('div', { style: { marginBottom: '1.5rem' } },
      el('span', { class: 'org-type-badge', style: { marginBottom: '0.5rem', display: 'inline-block' } },
        o.tipo_organizacion),
      o.ejemplo && ' ', marcaEjemplo(o),
      el('h2', { style: { fontSize: '1.6rem', color: 'var(--primary)' } }, o.razon_social),
      o.cuit && el('p', { style: { color: 'var(--text-muted)', fontWeight: '500' } },
        icono('fa-id-card'), ` CUIT: ${o.cuit}`)
    ),

    el('div', { style: { ...caja, display: 'grid', gap: '1rem', marginBottom: '1.5rem',
                         gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } },
      el('div', {},
        el('strong', {}, icono('fa-location-dot'), ' Ubicación:'), el('br'),
        [o.direccion, o.localidad].filter(Boolean).join(', '), ` (Dpto. ${o.departamento})`),
      el('div', {},
        el('strong', {}, icono('fa-user-tie'), ' Contacto institucional:'), el('br'),
        o.contacto_persona ?? '', el('br'),
        o.correo && el('a', { href: `mailto:${o.correo}` }, o.correo))
    ),

    o.ejemplo && el('p', { role: 'note', style: { background: '#fef3c7', color: '#92400e',
        padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' } },
      'Registro de ejemplo: muestra cómo se verá la ficha de un oferente real. No es una empresa ni un convenio existentes.'),

    o.perfiles_requeridos && el('div', { style: { marginBottom: '1.5rem' } },
      el('h4', {}, 'Perfiles y tareas requeridas'),
      el('p', { style: { marginTop: '0.25rem' } }, o.perfiles_requeridos)),

    el('div', { style: { marginBottom: '1.5rem' } },
      el('h4', {}, 'Especialidades ETP asociadas'),
      el('div', { class: 'specialties-tags', style: { marginTop: '0.5rem' } },
        (o.especialidades ?? []).map(s => el('span', { class: 'tag-spec' }, s)))),

    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                         flexWrap: 'wrap', gap: '1rem', background: 'var(--primary-light)',
                         padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' } },
      el('div', {},
        el('strong', {}, `Vacantes activas: ${o.cupos_disponibles ?? 0} cupos`), el('br'),
        el('small', {}, o.convenio_vigente && o.fecha_vencimiento
          ? `Convenio vigente hasta ${o.fecha_vencimiento}`
          : 'Convenio en trámite')),
      el('button', { type: 'button', class: 'btn-primary-action nav-btn', onclick: vincular },
        icono('fa-paper-plane'), ' Solicitar vinculación')
    )
  );
}
