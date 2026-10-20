/**
 * modules/solicitudes — formularios que llegan a la bandeja de la Dirección.
 *
 * "Quiero ser oferente", "Publicar experiencia" y "Replicar esta experiencia"
 * se abren desde cualquier vista, así que este módulo es persistente: se monta
 * una vez al arrancar y queda escuchando. Todo lo que recibe termina en la
 * colección `solicitudes`, que el panel DETyFP modera.
 *
 * Diferencias con el prototipo:
 *   - El pedido de réplica ahora se guarda. Antes solo mostraba un aviso y se
 *     perdía, aunque es justamente el dato que mide si un caso sirve.
 *   - Se guarda todo lo que la persona escribió (CUIT, tipo, tareas). Antes se
 *     tiraban la mitad de los campos.
 *   - Los departamentos salen de los datos: el formulario tenía 13 de 17.
 *   - El CUIT se valida con su dígito verificador (SDD §7).
 */

import { abrirModal, cerrarModal } from '../../ui/modal.js';
import { el } from '../../ui/dom.js';

const hoy = () => new Date().toISOString().slice(0, 10);
const valor = id => document.getElementById(id)?.value.trim() ?? '';

export default {
  id: 'solicitudes',
  persistente: true,
  titulo: 'Formularios de solicitud',

  async montar(_contenedor, ctx) {
    this._ctx = ctx;
    this._desconectar = [];

    this._alEnviar('form-oferente', () => this._oferente());
    this._alEnviar('form-experiencia', () => this._experiencia());
    this._alEnviar('form-replica', () => this._replica());

    this._desconectar.push(
      ctx.escuchar('caso:replicar', id => this._abrirReplica(id)),
      ctx.escuchar('especialidades:cambiaron', () => this._poblarListas())
    );
    await this._poblarListas();
  },

  desmontar() {
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
  },

  /* ------------------------------------------------------------ internos */

  _alEnviar(idFormulario, accion) {
    const formulario = document.getElementById(idFormulario);
    if (!formulario) return;
    const manejar = async evento => {
      evento.preventDefault();
      const boton = formulario.querySelector('[type=submit]');
      if (boton) boton.disabled = true;
      try {
        await accion();
      } catch (error) {
        // Un dato mal cargado no es una falla del portal: se avisa y listo.
        if (!error.validacion) console.error(`[solicitudes] ${idFormulario}`, error);
        this._ctx.emitir('aviso', { texto: error.message || 'No se pudo enviar. Probá de nuevo.', tipo: 'error' });
      } finally {
        if (boton) boton.disabled = false;
      }
    };
    formulario.addEventListener('submit', manejar);
    this._desconectar.push(() => formulario.removeEventListener('submit', manejar));
  },

  async _poblarListas() {
    const [especialidades, departamentos] = await Promise.all([
      this._ctx.api.listar('especialidades', { porPagina: 0 }),
      this._ctx.api.listar('departamentos', { porPagina: 0 })
    ]);
    llenar('oferente-spec', especialidades.items, 'Seleccionar especialidad…');
    llenar('exp-spec', especialidades.items, 'Seleccionar especialidad…');
    llenar('oferente-dept', [...departamentos.items].sort((a, b) => a.localeCompare(b, 'es')),
      'Seleccionar departamento…');
  },

  async _oferente() {
    const cuit = valor('oferente-cuit');
    if (!cuitValido(cuit)) {
      throw Object.assign(new Error('El CUIT no es válido: revisá los 11 dígitos (formato 30-12345678-9).'),
        { validacion: true });
    }
    await this._guardar('form-oferente', 'oferente', {
      tipo: 'oferente',
      titulo: valor('oferente-razon'),
      cuit: formatearCuit(cuit),
      tipo_organizacion: valor('oferente-tipo'),
      solicitante: valor('oferente-contacto'),
      correo: valor('oferente-correo'),
      departamento: valor('oferente-dept'),
      especialidad: valor('oferente-spec'),
      detalles: valor('oferente-perfil')
    }, 'Solicitud enviada a la Dirección de ETP. Queda pendiente de aprobación.');
  },

  async _experiencia() {
    await this._guardar('form-experiencia', 'experiencia', {
      tipo: 'experiencia',
      titulo: valor('exp-titulo'),
      solicitante: valor('exp-escuela'),
      empresa: valor('exp-empresa'),
      especialidad: valor('exp-spec'),
      cantidad_estudiantes: Number(valor('exp-alumnos')) || null,
      detalles: valor('exp-problema'),
      departamento: ''
    }, 'Experiencia enviada a la Supervisión de ETP para su revisión.');
  },

  async _replica() {
    await this._guardar('form-replica', 'replica', {
      tipo: 'replica',
      titulo: valor('replica-caso-nombre'),
      caso_id: this._casoEnReplica ?? null,
      solicitante: `${valor('replica-contacto')} — ${valor('replica-institucion')}`,
      correo: valor('replica-correo'),
      departamento: ''
    }, 'Pedido de réplica registrado. La Coordinación de PP se va a contactar.');
    this._casoEnReplica = null;
  },

  async _guardar(idFormulario, tipo, datos, mensaje) {
    const creada = await this._ctx.api.crear('solicitudes', { ...datos, fecha: hoy(), estado: 'Pendiente' });
    document.getElementById(idFormulario)?.reset();
    cerrarModal();
    this._ctx.emitir('solicitudes:cambiaron', creada);
    this._ctx.emitir('aviso', { texto: mensaje, tipo: 'success' });
    return creada;
  },

  async _abrirReplica(idCaso) {
    this._casoEnReplica = idCaso;
    const caso = idCaso ? await this._ctx.api.obtener('casos', idCaso) : null;
    const campo = document.getElementById('replica-caso-nombre');
    if (campo) campo.value = caso ? `${caso.titulo} (${caso.escuela})` : '';
    abrirModal('replica');
  }
};

/* ---------------------------------------------------------------- utilidades */

function llenar(id, valores, invitacion) {
  const selector = document.getElementById(id);
  if (!selector) return;
  const elegido = selector.value;
  selector.replaceChildren(
    el('option', { value: '' }, invitacion),
    ...valores.map(v => el('option', { value: v }, v))
  );
  selector.value = valores.includes(elegido) ? elegido : '';
}

/** Dígito verificador del CUIT/CUIL (módulo 11). */
export function cuitValido(texto) {
  const d = String(texto).replace(/\D/g, '');
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  if (verificador === 10) return false;   // esos CUIT no se emiten con este prefijo
  return verificador === Number(d[10]);
}

const formatearCuit = texto => {
  const d = String(texto).replace(/\D/g, '');
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
};
