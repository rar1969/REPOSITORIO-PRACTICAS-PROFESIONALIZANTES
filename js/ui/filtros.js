/**
 * ui/filtros — barra de filtros conectada a la URL.
 *
 * Toma los `<select>` y el `<input>` que ya existen en el HTML en lugar de
 * dibujar los suyos: así el módulo no duplica marcado que el prototipo ya
 * tiene resuelto y con estilo. Lo que aporta es el comportamiento — poblar las
 * listas desde los datos, leer el estado inicial de la URL y avisar de cada
 * cambio — que es justamente lo que estaba disperso en `app.js`.
 */

import { el } from './dom.js';

/**
 * @param {object} config
 * @param {object} config.campos    { clave: '#selector' }
 * @param {string} config.limpiar   selector del botón de limpiar
 * @param {object} config.inicial   valores con los que arranca
 * @param {Function} config.alCambiar  recibe el estado completo
 * @param {number} config.esperaTexto  ms antes de avisar un cambio de texto
 */
export function conectarFiltros({ campos, limpiar, inicial = {}, alCambiar, esperaTexto = 250 }) {
  const estado = {};
  const nodos = {};
  const desconectar = [];
  let temporizador = null;

  for (const [clave, selector] of Object.entries(campos)) {
    const nodo = document.querySelector(selector);
    if (!nodo) continue;
    nodos[clave] = nodo;
    estado[clave] = inicial[clave] ?? '';
    nodo.value = estado[clave];

    const esTexto = nodo.tagName === 'INPUT';
    const avisar = () => {
      estado[clave] = nodo.value;
      if (!esTexto) return alCambiar({ ...estado });
      // El texto se escribe de a una tecla: se espera a que la persona pare.
      clearTimeout(temporizador);
      temporizador = setTimeout(() => alCambiar({ ...estado }), esperaTexto);
    };

    const evento = esTexto ? 'input' : 'change';
    nodo.addEventListener(evento, avisar);
    desconectar.push(() => nodo.removeEventListener(evento, avisar));
  }

  const botonLimpiar = limpiar ? document.querySelector(limpiar) : null;
  if (botonLimpiar) {
    const limpiarTodo = () => {
      for (const [clave, nodo] of Object.entries(nodos)) {
        estado[clave] = '';
        nodo.value = '';
      }
      clearTimeout(temporizador);
      alCambiar({ ...estado });
    };
    botonLimpiar.addEventListener('click', limpiarTodo);
    desconectar.push(() => botonLimpiar.removeEventListener('click', limpiarTodo));
  }

  return {
    estado: () => ({ ...estado }),

    /** Llena un `<select>` con opciones, conservando la primera ("Todos…"). */
    poblar(clave, valores, etiqueta = v => v) {
      const nodo = nodos[clave];
      if (!nodo || nodo.tagName !== 'SELECT') return;
      const elegido = nodo.value;
      const primera = nodo.options[0];
      nodo.replaceChildren();
      if (primera) nodo.append(primera);
      for (const valor of valores) {
        nodo.append(el('option', { value: valor }, etiqueta(valor)));
      }
      nodo.value = elegido;   // si la opción ya no existe, queda en "todos"
    },

    /** Obligatorio al desmontar: si no, los oyentes se acumulan. */
    desmontar() {
      clearTimeout(temporizador);
      for (const quitar of desconectar) quitar();
    }
  };
}
