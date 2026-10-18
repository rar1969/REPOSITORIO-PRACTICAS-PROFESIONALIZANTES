/**
 * ui/dom — construcción de nodos sin `innerHTML`.
 *
 * El prototipo arma su interfaz interpolando datos dentro de plantillas de
 * texto. Mientras los datos son de la propia Dirección eso no se nota; el día
 * que una empresa cargue su razón social desde un formulario, cualquier
 * etiqueta que escriba se ejecuta. `el()` crea nodos y pone el texto como
 * texto, así que ese problema no existe por construcción, no por cuidado.
 */

/**
 * el('div', { class: 'card', onclick: fn }, 'texto', otroNodo)
 *
 * - `class`, `id`, `href`, … se aplican como atributos.
 * - `onclick` y similares (on + evento) se registran como oyentes.
 * - `dataset: { id: 'x' }` y `style: { color: 'red' }` aceptan objetos.
 * - Los hijos pueden ser nodos, texto, números, o null para omitirlos.
 */
export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(props || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave === 'style' && typeof valor === 'object') Object.assign(nodo.style, valor);
    else if (clave.startsWith('on') && typeof valor === 'function') {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === 'class') nodo.className = valor;
    else nodo.setAttribute(clave, valor);
  }

  agregar(nodo, hijos);
  return nodo;
}

function agregar(nodo, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

/** Ícono de Font Awesome. Decorativo: oculto para los lectores de pantalla. */
export const icono = nombre => el('i', { class: `fas ${nombre}`, 'aria-hidden': 'true' });

/** Vacía un contenedor y le pone los nodos nuevos. */
export function reemplazar(contenedor, ...nodos) {
  contenedor.replaceChildren();
  agregar(contenedor, nodos);
  return contenedor;
}

/** Mensaje para cuando una lista no tiene nada que mostrar. */
export const vacio = texto =>
  el('p', { class: 'estado-vacio', role: 'status',
            style: { gridColumn: '1 / -1', textAlign: 'center',
                     color: 'var(--text-muted)', padding: '2rem 1rem' } }, texto);
