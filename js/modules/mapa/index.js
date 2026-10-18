/**
 * modules/mapa — visor cartográfico de escuelas y oferentes.
 *
 * Es el módulo que justifica el contrato `montar`/`desmontar`. Un mapa de
 * Leaflet no es marcado que se tira y se vuelve a dibujar: reserva oyentes de
 * teclado, de rueda y de cambio de tamaño de ventana. Si al salir de la vista
 * no se destruye, cada visita deja una instancia viva atrás, y el navegador se
 * degrada sin que nada falle a la vista. Por eso `desmontar()` llama a
 * `remove()` y suelta las referencias.
 *
 * Dos cosas que el prototipo no hacía:
 *
 *   1. Leaflet se descarga recién al abrir esta vista (SDD §10).
 *   2. Las escuelas con ubicación aproximada se dibujan distinto y lo dicen.
 *      Hoy es una sola, pero la regla vale para cualquiera que se cargue sin
 *      domicilio verificado.
 */

import { cargarLeaflet, VISTA_TUCUMAN, TESELAS } from '../../services/geo.js';
import { el, icono, reemplazar } from '../../ui/dom.js';

const CAPAS = ['todo', 'escuelas', 'oferentes'];

export default {
  id: 'mapa',
  ruta: '/mapa',
  titulo: 'Mapa',
  icono: 'fa-map-location-dot',
  contenedor: '#map-container',

  async montar(contenedor, ctx) {
    this._ctx = ctx;
    this._capa = CAPAS.includes(ctx.params?.get('capa')) ? ctx.params.get('capa') : 'todo';

    reemplazar(contenedor, el('p', { role: 'status', style: { padding: '2rem', textAlign: 'center',
      color: 'var(--text-muted)' } }, 'Cargando el mapa…'));

    let L;
    try {
      L = await cargarLeaflet();
    } catch {
      reemplazar(contenedor, el('p', { role: 'alert', style: { padding: '2rem', textAlign: 'center' } },
        'No se pudo cargar el mapa. Revisá la conexión y actualizá la página.'));
      return;
    }

    const [escuelas, oferentes] = await Promise.all([
      ctx.api.listar('escuelas', { porPagina: 0 }),
      ctx.api.listar('oferentes', { porPagina: 0 })
    ]);

    // Leaflet exige un contenedor limpio: si quedó marcado por una instancia
    // anterior, se niega a inicializar ("Map container is already initialized").
    contenedor.replaceChildren();
    delete contenedor._leaflet_id;

    this._mapa = L.map(contenedor).setView(VISTA_TUCUMAN.centro, VISTA_TUCUMAN.zoom);
    L.tileLayer(TESELAS.url, TESELAS.opciones).addTo(this._mapa);

    this._marcadores = {
      escuelas: escuelas.items
        .filter(e => e.lat !== null && e.lng !== null)
        .map(e => marcadorEscuela(L, e)),
      oferentes: oferentes.items
        .filter(o => o.latitud !== null && o.latitud !== undefined)
        .map(o => marcadorOferente(L, o, ctx))
    };

    this._conectarBotones();
    this._aplicarCapa(this._capa);

    // El mapa se monta mientras su sección recién aparece: sin esto, Leaflet
    // mide un contenedor de altura cero y dibuja las teselas en gris.
    this._ajuste = setTimeout(() => this._mapa?.invalidateSize(), 200);
  },

  desmontar() {
    clearTimeout(this._ajuste);
    for (const quitar of this._desconectar ?? []) quitar();
    this._desconectar = [];
    this._mapa?.remove();          // suelta oyentes de ventana, rueda y teclado
    this._mapa = null;
    this._marcadores = null;
  },

  /* ------------------------------------------------------------ internos */

  _conectarBotones() {
    this._desconectar = [];
    for (const capa of CAPAS) {
      const boton = document.querySelector(`#map-filter-${capa === 'todo' ? 'all' : capa}`)
        ?? document.querySelector(`#map-filter-${capa === 'oferentes' ? 'empresas' : capa}`);
      if (!boton) continue;
      const alHacerClic = evento => {
        evento.preventDefault();
        this._aplicarCapa(capa);
        this._ctx.actualizarParams?.({ capa: capa === 'todo' ? '' : capa });
      };
      boton.addEventListener('click', alHacerClic);
      this._desconectar.push(() => boton.removeEventListener('click', alHacerClic));
    }
  },

  _aplicarCapa(capa) {
    this._capa = capa;

    for (const [nombre, marcadores] of Object.entries(this._marcadores ?? {})) {
      const visible = capa === 'todo' || capa === nombre;
      for (const marcador of marcadores) {
        if (visible) marcador.addTo(this._mapa);
        else this._mapa.removeLayer(marcador);
      }
    }

    for (const otra of CAPAS) {
      const boton = document.querySelector(`#map-filter-${otra === 'todo' ? 'all' : otra === 'oferentes' ? 'empresas' : otra}`);
      boton?.classList.toggle('active', otra === capa);
    }
  }
};

/* -------------------------------------------------------------- marcadores */

const redondo = (fondo, color, borde, ico, extra = '') => `
  <div style="background:${fondo};color:${color};width:32px;height:32px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;font-size:1rem;
              box-shadow:0 4px 8px rgba(0,0,0,.3);border:2px ${borde};${extra}">
    <i class="fas ${ico}"></i>
  </div>`;

function marcadorEscuela(L, escuela) {
  const aproximada = escuela.precision !== 'domicilio';

  const marca = L.divIcon({
    className: `custom-map-icon school-icon${aproximada ? ' school-icon--aprox' : ''}`,
    html: aproximada
      ? redondo('#7dd3fc', '#0c4a6e', 'dashed #fff', 'fa-graduation-cap', 'opacity:.75;')
      : redondo('#0284c7', '#fff', 'solid #fff', 'fa-graduation-cap'),
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  return L.marker([escuela.lat, escuela.lng], {
    icon: marca,
    title: aproximada ? `${escuela.nombre} — ubicación aproximada` : escuela.nombre,
    alt: escuela.nombre
  }).bindPopup(globoEscuela(escuela, aproximada));
}

function globoEscuela(escuela, aproximada) {
  const nodo = el('div', { style: { fontFamily: 'var(--font-sans)', padding: '.2rem', maxWidth: '260px' } },
    el('span', { class: 'org-type-badge', style: { fontSize: '.7rem', marginBottom: '.3rem', display: 'inline-block' } },
      escuela.tipo === 'agrotecnica' ? 'ESCUELA AGROTÉCNICA' : 'ESCUELA TÉCNICA'),

    el('h4', { style: { margin: '0 0 .25rem', fontSize: '.95rem', fontWeight: '700' } }, escuela.nombre),

    aproximada && el('p', {
        style: { margin: '0 0 .4rem', fontSize: '.72rem', color: '#b45309',
                 background: '#fef3c7', borderRadius: '4px', padding: '.2rem .4rem' } },
      icono('fa-triangle-exclamation'), ' Ubicación aproximada: apunta a la localidad, no al edificio.'),

    el('p', { style: { margin: '0 0 .4rem', fontSize: '.8rem', color: 'var(--text-muted)' } },
      icono('fa-location-dot'), ` ${escuela.direccion ? escuela.direccion + ' — ' : ''}${escuela.localidad} (Dpto. ${escuela.departamento})`,
      el('br'),
      icono('fa-barcode'), ` CUE: ${escuela.cue || 's/d'}`),

    el('p', { style: { margin: '0', fontSize: '.8rem' } },
      el('strong', {}, 'Especialidades: '),
      (escuela.especialidades ?? []).join(', ') || 's/d'),

    el('p', { style: { margin: '.25rem 0 0', fontSize: '.8rem' } },
      el('strong', {}, 'Alumnos de 7°: '),
      escuela.alumnos_7mo ?? 's/d')
  );
  return nodo;   // Leaflet acepta un nodo: no hay interpolación de texto
}

function marcadorOferente(L, oferente, ctx) {
  const marca = L.divIcon({
    className: 'custom-map-icon company-icon',
    html: redondo('#0f172a', '#38bdf8', 'solid #38bdf8', 'fa-industry'),
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const globo = el('div', { style: { fontFamily: 'var(--font-sans)', padding: '.2rem', maxWidth: '260px' } },
    el('span', { class: 'org-type-badge', style: { fontSize: '.7rem', marginBottom: '.3rem', display: 'inline-block' } },
      oferente.tipo_organizacion),
    el('h4', { style: { margin: '0 0 .25rem', fontSize: '.95rem', fontWeight: '700' } }, oferente.razon_social),
    el('p', { style: { margin: '0 0 .4rem', fontSize: '.8rem', color: 'var(--text-muted)' } },
      icono('fa-location-dot'), ` ${oferente.localidad} (Dpto. ${oferente.departamento})`),
    el('p', { style: { margin: '0 0 .5rem', fontSize: '.8rem' } },
      el('strong', {}, 'Cupos: '), `${oferente.cupos_disponibles ?? 0}`),
    el('button', {
      class: 'btn-card', style: { width: '100%' },
      onclick: () => ctx.emitir('oferente:ver', oferente.id)
    }, 'Ver ficha completa')
  );

  return L.marker([oferente.latitud, oferente.longitud], {
    icon: marca, title: oferente.razon_social, alt: oferente.razon_social
  }).bindPopup(globo);
}
