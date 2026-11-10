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
    const ampliar = tieneActa(oferente);
    await this._ctx.api.crear('solicitudes', {
      tipo: 'vinculacion',
      titulo: ampliar ? `${oferente.razon_social} — sumar otra escuela` : oferente.razon_social,
      oferente_id: oferente.id,
      solicitante: `Perfil: ${this._ctx.sesion?.etiquetaRol?.() ?? 'Visitante'}`,
      departamento: oferente.departamento,
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'Pendiente'
    });
    cerrarModal('detalle');
    this._ctx.emitir('solicitudes:cambiaron');
    this._ctx.emitir('aviso', {
      texto: ampliar
        ? 'Pedido registrado. La Dirección de ETP evalúa sumar otra escuela al acuerdo con esta organización.'
        : 'Pedido de vinculación registrado. La Dirección de ETP se contacta con el establecimiento.',
      tipo: 'success'
    });
  }
};

/** Convenio vigente y al menos una escuela con acta: ya no hay que «vincular». */
function tieneActa(o) {
  return Boolean(o.convenio_vigente) && (o.escuelas_vinculadas ?? []).length > 0;
}

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
        [o.direccion, o.localidad].filter(Boolean).join(', ') || 'A confirmar',
        o.departamento ? ` (Dpto. ${o.departamento})` : ''),
      el('div', {},
        el('strong', {}, icono('fa-user-tie'), ' Contacto institucional:'), el('br'),
        o.contacto_persona || o.correo
          ? [o.contacto_persona ?? '', el('br'),
             o.correo && el('a', { href: `mailto:${o.correo}` }, o.correo)]
          : 'A través de la DETyFP')
    ),

    o.ejemplo && el('p', { role: 'note', style: { background: '#fef3c7', color: '#92400e',
        padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' } },
      'Registro de ejemplo: muestra cómo se verá la ficha de un oferente real. No es una empresa ni un convenio existentes.'),

    o.perfiles_requeridos && el('div', { style: { marginBottom: '1.5rem' } },
      el('h4', {}, 'Perfiles y tareas requeridas'),
      el('p', { style: { marginTop: '0.25rem' } }, o.perfiles_requeridos)),

    (o.escuelas_vinculadas ?? []).length > 0 && el('div', { style: { marginBottom: '1.5rem' } },
      el('h4', {}, 'Escuelas con acta acuerdo'),
      el('ul', { style: { marginTop: '0.35rem', paddingLeft: '1.2rem' } },
        o.escuelas_vinculadas.map(e => el('li', {}, e)))),

    el('div', { style: { marginBottom: '1.5rem' } },
      el('h4', {}, 'Especialidades ETP asociadas'),
      el('div', { class: 'specialties-tags', style: { marginTop: '0.5rem' } },
        (o.especialidades ?? []).map(s => el('span', { class: 'tag-spec' }, s)))),

    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                         flexWrap: 'wrap', gap: '1rem', background: 'var(--primary-light)',
                         padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)' } },
      el('div', {},
        el('strong', {}, o.cupos_disponibles > 0
          ? `Vacantes activas: ${o.cupos_disponibles} cupos`
          : 'Vacantes: a informar'), el('br'),
        el('small', {}, !o.convenio_vigente
          ? 'Convenio en trámite'
          : o.fecha_vencimiento
            ? `Convenio vigente hasta ${o.fecha_vencimiento}`
            : 'Convenio vigente (acta acuerdo firmada)'),
        tieneActa(o) && [el('br'), el('small', {},
          'Ya tiene acta firmada. Si otra escuela quiere hacer prácticas acá, pedilo a la DETyFP.')]),
      el('button', { type: 'button', class: 'btn-primary-action nav-btn', onclick: vincular },
        icono('fa-paper-plane'), tieneActa(o) ? ' Sumar otra escuela' : ' Solicitar vinculación')
    )
  );
}
