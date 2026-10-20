/**
 * modules/inicio — portada: buscador rápido e indicadores.
 *
 * Cierra el último pendiente de la fase 1 (SDD §11): los indicadores dejan de
 * ser números escritos a mano y se calculan desde los datos. Va a mostrar
 * cifras más chicas que el prototipo —que anunciaba 164 empresas teniendo 5
 * cargadas— y esa es la idea: un tablero que dice lo que hay, aunque sea poco,
 * es el único que la Dirección puede presentar.
 *
 * El indicador de estudiantes cambió de pregunta. Antes decía "3.560
 * practicantes", un número inventado. Ahora suma la matrícula real de 7° año
 * de la Oferta Educativa, que es el año que hace las prácticas: la base para
 * dimensionar cuántos cupos hacen falta.
 */

import { el, reemplazar, marcaEjemplo } from '../../ui/dom.js';

const formato = new Intl.NumberFormat('es-AR');

export default {
  id: 'inicio',
  ruta: '/inicio',
  titulo: 'Inicio',
  icono: 'fa-house',

  async montar(contenedor, ctx) {
    this.desmontar();
    this._ctx = ctx;
    this._desconectar = [];

    this._conectarBuscador();
    await Promise.all([this._poblarEspecialidades(), this._dibujarIndicadores()]);

    // Una alta en otra pestaña del panel cambia los números.
    for (const evento of ['oferentes:cambiaron', 'casos:cambiaron', 'escuelas:cambiaron']) {
      this._desconectar.push(ctx.escuchar(evento, () => this._dibujarIndicadores()));
    }
  },

  desmontar() {
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
  },

  /* ------------------------------------------------------------ internos */

  _conectarBuscador() {
    const texto = document.querySelector('#search-hero');
    const especialidad = document.querySelector('#spec-hero');
    const boton = document.querySelector('#btn-search-hero');

    const buscar = () => this._ctx.ir('directorio', {
      q: texto?.value.trim() ?? '',
      esp: especialidad?.value ?? ''
    });
    const conEnter = e => { if (e.key === 'Enter') buscar(); };

    boton?.addEventListener('click', buscar);
    texto?.addEventListener('keydown', conEnter);
    this._desconectar.push(
      () => boton?.removeEventListener('click', buscar),
      () => texto?.removeEventListener('keydown', conEnter)
    );
  },

  async _poblarEspecialidades() {
    const selector = document.querySelector('#spec-hero');
    if (!selector) return;
    const { items } = await this._ctx.api.listar('especialidades', { porPagina: 0 });
    const elegido = selector.value;
    const primera = selector.options[0];
    selector.replaceChildren(...(primera ? [primera] : []));
    for (const esp of items) {
      const opcion = document.createElement('option');
      opcion.value = esp;
      opcion.textContent = esp;
      selector.append(opcion);
    }
    selector.value = elegido;
  },

  async _dibujarIndicadores() {
    const kpi = await calcularIndicadores(this._ctx.api);
    poner('#kpi-empresas', kpi.oferentes, 'Empresas y organismos oferentes');
    poner('#kpi-escuelas', kpi.escuelas, 'Escuelas Técnicas y Agrotécnicas');
    poner('#kpi-estudiantes', kpi.alumnos7mo, 'Estudiantes de 7° año');
    poner('#kpi-casos', kpi.casos, 'Casos exitosos publicados');
    avisoEjemplos(kpi.ejemplos);
  }
};

/**
 * Indicadores de portada, todos derivados. Se exporta para probarla sola y
 * para que el panel de la Dirección use exactamente la misma cuenta.
 */
export async function calcularIndicadores(api) {
  const [oferentes, escuelas, casos] = await Promise.all([
    api.listar('oferentes', { porPagina: 0 }),
    api.listar('escuelas', { porPagina: 0 }),
    api.listar('casos', { porPagina: 0 })
  ]);
  // Los registros de ejemplo se ven en las listas, marcados, pero no suman:
  // un indicador solo cuenta lo que existe.
  const reales = lista => lista.filter(i => !i.ejemplo);
  return {
    oferentes: reales(oferentes.items).filter(o => String(o.estado).toLowerCase() === 'activo').length,
    escuelas: reales(escuelas.items).length,
    alumnos7mo: reales(escuelas.items).reduce((suma, e) => suma + (Number(e.alumnos_7mo) || 0), 0),
    casos: reales(casos.items).length,
    ejemplos: [...oferentes.items, ...casos.items].filter(i => i.ejemplo).length
  };
}

function poner(selector, valor, leyenda) {
  const cifra = document.querySelector(selector);
  if (!cifra) return;
  reemplazar(cifra, formato.format(valor));
  const texto = cifra.parentElement?.querySelector('p');
  if (texto) texto.textContent = leyenda;
}

/** Explica, debajo de los indicadores, por qué hay registros marcados. */
function avisoEjemplos(cantidad) {
  const grilla = document.querySelector('#view-inicio .stats-grid');
  if (!grilla) return;
  document.getElementById('aviso-ejemplos')?.remove();
  if (!cantidad) return;
  grilla.after(el('p', {
      id: 'aviso-ejemplos', role: 'note',
      style: { maxWidth: '900px', margin: '1.25rem auto 0', padding: '0 1rem', textAlign: 'center',
               fontSize: '0.85rem', color: 'var(--text-muted)' } },
    marcaEjemplo({ ejemplo: true }),
    ' El portal está en etapa de carga. Los oferentes, casos y documentos marcados como ejemplo ',
    'son ilustrativos y no se cuentan en estos indicadores.'));
}
