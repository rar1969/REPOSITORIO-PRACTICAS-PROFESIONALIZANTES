/**
 * services/geo — carga diferida de Leaflet.
 *
 * Leaflet y sus estilos pesan alrededor de 150 KB. El prototipo los descarga
 * siempre, aunque nadie abra el mapa. Acá se piden la primera vez que alguien
 * entra a esa vista, y una sola vez por sesión: es el requisito de rendimiento
 * del SDD §10, y el motivo por el que los módulos se importan dinámicamente.
 *
 * Si la etiqueta ya está en el HTML (como hoy, mientras exista el app.js
 * heredado), no se vuelve a pedir nada: se usa la que está.
 */

const LEAFLET = {
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
};

let promesa = null;

/** Devuelve el objeto `L` de Leaflet, cargándolo si hace falta. */
export function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (promesa) return promesa;

  promesa = new Promise((resolver, rechazar) => {
    if (!document.querySelector(`link[href="${LEAFLET.css}"]`)) {
      const estilos = document.createElement('link');
      estilos.rel = 'stylesheet';
      estilos.href = LEAFLET.css;
      document.head.append(estilos);
    }

    const script = document.createElement('script');
    script.src = LEAFLET.js;
    script.async = true;
    script.onload = () => resolver(window.L);
    script.onerror = () => {
      promesa = null;   // permite reintentar si vuelve la conexión
      rechazar(new Error('No se pudo cargar Leaflet.'));
    };
    document.head.append(script);
  });

  return promesa;
}

/** Centro y acercamiento con que abre el mapa de la provincia. */
export const VISTA_TUCUMAN = { centro: [-26.9, -65.35], zoom: 9 };

/** Teselas de OpenStreetMap, con la atribución que exige su licencia. */
export const TESELAS = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  opciones: {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | DETyFP Tucumán'
  }
};
