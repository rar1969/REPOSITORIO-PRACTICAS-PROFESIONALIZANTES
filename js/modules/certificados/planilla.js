/**
 * modules/certificados/planilla — lee planillas .xlsx y .csv en el navegador.
 *
 * Un .xlsx es un ZIP con XML adentro. Este lector abre solo lo necesario (la
 * primera hoja con datos y sus textos compartidos) con las herramientas que ya
 * trae el navegador —DecompressionStream y DOMParser—, sin librerías externas.
 * Devuelve las celdas como texto, tal cual se ven, para que la grilla de carga
 * las muestre y la persona las revise antes de guardar.
 *
 * También reconoce las columnas por su encabezado ("DNI", "Apellido",
 * "Nombre de la Charla", "Escuela"…), así sirve tanto una planilla nueva como
 * las que ya usa la DETyFP para las certificaciones.
 */

/* ------------------------------------------------------------------- ZIP */

async function inflar(datos) {
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Lista los archivos de un ZIP: nombre → función que devuelve su texto. */
function abrirZip(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (vista.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es una planilla de Excel (.xlsx) válida.');
  const cantidad = vista.getUint16(fin + 10, true);
  let p = vista.getUint32(fin + 16, true);
  const archivos = new Map();
  const decodificar = new TextDecoder();
  for (let n = 0; n < cantidad; n++) {
    if (vista.getUint32(p, true) !== 0x02014b50) break;
    const metodo = vista.getUint16(p + 10, true);
    const comprimido = vista.getUint32(p + 20, true);
    const largoNombre = vista.getUint16(p + 28, true);
    const largoExtra = vista.getUint16(p + 30, true);
    const largoComentario = vista.getUint16(p + 32, true);
    const local = vista.getUint32(p + 42, true);
    const nombre = decodificar.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    archivos.set(nombre, async () => {
      const inicio = local + 30 + vista.getUint16(local + 26, true) + vista.getUint16(local + 28, true);
      const crudo = bytes.subarray(inicio, inicio + comprimido);
      const datos = metodo === 0 ? crudo : metodo === 8 ? await inflar(crudo) : null;
      if (!datos) throw new Error('La planilla usa una compresión que no se puede leer.');
      return decodificar.decode(datos);
    });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

/* ------------------------------------------------------------------ XLSX */

const xml = texto => new DOMParser().parseFromString(texto, 'application/xml');
const hijos = (nodo, nombre) => [...nodo.getElementsByTagNameNS('*', nombre)];

function columnaANumero(ref) {
  let n = 0;
  for (const letra of ref.replace(/\d+$/, '')) n = n * 26 + (letra.charCodeAt(0) - 64);
  return n - 1;
}

/** Fecha de Excel (número de días desde 1899-12-30) a 'AAAA-MM-DD'. */
export function fechaDeExcel(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

async function leerXlsx(bytes) {
  const zip = abrirZip(bytes);
  const leer = async ruta => (zip.has(ruta) ? zip.get(ruta)() : null);

  const compartidos = [];
  const sst = await leer('xl/sharedStrings.xml');
  if (sst) {
    for (const si of hijos(xml(sst), 'si')) {
      compartidos.push(hijos(si, 't').map(t => t.textContent).join(''));
    }
  }

  // Hojas en el orden del libro.
  const libro = xml(await leer('xl/workbook.xml'));
  const relaciones = xml(await leer('xl/_rels/workbook.xml.rels'));
  const destino = new Map(hijos(relaciones, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const hojas = hijos(libro, 'sheet').map(h => {
    const id = h.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
      h.getAttribute('r:id');
    const ruta = destino.get(id) ?? '';
    return { nombre: h.getAttribute('name'), ruta: ruta.startsWith('/') ? ruta.slice(1) : `xl/${ruta.replace(/^\.\//, '')}` };
  });

  const resultado = [];
  for (const hoja of hojas) {
    const texto = await leer(hoja.ruta);
    if (!texto) continue;
    const filas = [];
    for (const fila of hijos(xml(texto), 'row')) {
      const valores = [];
      for (const c of hijos(fila, 'c')) {
        const tipo = c.getAttribute('t');
        const v = hijos(c, 'v')[0]?.textContent ?? '';
        let valor;
        if (tipo === 's') valor = compartidos[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = hijos(c, 't').map(t => t.textContent).join('');
        else if (tipo === 'b') valor = v === '1' ? 'VERDADERO' : 'FALSO';
        else valor = v;
        valores[columnaANumero(c.getAttribute('r') || 'A1')] = String(valor).trim();
      }
      filas.push(Array.from(valores, v => v ?? ''));
    }
    resultado.push({ nombre: hoja.nombre, filas });
  }
  return resultado;
}

/* ------------------------------------------------------------------- CSV */

function leerCsv(texto) {
  const primera = texto.split(/\r?\n/, 1)[0];
  const separador = [';', '\t', ','].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [''];
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { fila[fila.length - 1] += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else fila[fila.length - 1] += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) fila.push('');
    else if (c === '\n') { filas.push(fila); fila = ['']; }
    else if (c !== '\r') fila[fila.length - 1] += c;
  }
  if (fila.some(v => v !== '')) filas.push(fila);
  return [{ nombre: 'CSV', filas: filas.map(f => f.map(v => v.trim())) }];
}

/** Lee un archivo elegido por la persona. Devuelve [{ nombre, filas: [[texto]] }]. */
export async function leerPlanilla(archivo) {
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (esZip) return leerXlsx(bytes);
  if (/\.xls$/i.test(archivo.name)) {
    throw new Error('Es un Excel viejo (.xls). Abrilo y guardalo como .xlsx, o como CSV.');
  }
  return leerCsv(new TextDecoder().decode(bytes));
}

/* ---------------------------------------------------- columnas reconocidas */

const sinTildes = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const ENCABEZADOS = {
  dni: /^(dni|documento|n.? ?de documento|nro.? documento)/,
  apellido: /^apellidos?$/,
  nombre: /^nombres?$/,
  apellidoYNombre: /^(apellido y nombres?|nombre y apellido|estudiante|alumno\/?a?)$/,
  curso: /^(curso|ano|anio|division|curso y division)/,
  especialidad: /^(especialidad|especializacion|orientacion|tecnicatura)/,
  escuela: /^(escuela|institucion|establecimiento)/,
  charla: /^(nombre de la charla|charla|capacitacion|taller|curso dictado)/,
  fecha: /^fecha/,
  horas: /^(horas|hs)/,
  disertantes: /^(disertantes?|capacitador|docente a cargo)/
};

/**
 * Busca la fila de encabezados entre las primeras 15 y arma, para cada fila
 * de datos, un objeto { dni, apellido, nombre, curso, especialidad, escuela,
 * charla, fecha, horas, disertantes } con lo que encuentre.
 */
export function interpretar(filas) {
  let indiceEncabezado = -1;
  let columnas = {};
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const encontradas = {};
    filas[i].forEach((celda, j) => {
      const t = sinTildes(celda);
      if (!t) return;
      for (const [campo, patron] of Object.entries(ENCABEZADOS)) {
        if (encontradas[campo] === undefined && patron.test(t)) { encontradas[campo] = j; break; }
      }
    });
    const tieneNombre = encontradas.apellido !== undefined || encontradas.apellidoYNombre !== undefined;
    if (tieneNombre && Object.keys(encontradas).length >= 2) {
      indiceEncabezado = i;
      columnas = encontradas;
      break;
    }
  }
  if (indiceEncabezado < 0) {
    throw new Error('No encontré los encabezados. La planilla necesita al menos una columna "Apellido" ' +
      '(o "Apellido y nombre") y otra como "DNI", "Nombre" o "Curso".');
  }

  // Una columna de escuelas sin título (pasa en planillas armadas a mano):
  // se reconoce por el contenido, si la mayoría empieza con "Escuela".
  if (columnas.escuela === undefined) {
    const usadas = new Set(Object.values(columnas));
    const ancho = Math.max(...filas.slice(indiceEncabezado, indiceEncabezado + 30).map(f => f.length));
    for (let j = 0; j < ancho; j++) {
      if (usadas.has(j) || sinTildes(filas[indiceEncabezado][j])) continue;
      const valores = filas.slice(indiceEncabezado + 1, indiceEncabezado + 51).map(f => sinTildes(f[j])).filter(Boolean);
      if (valores.length && valores.filter(v => /^(escuela|e\.?t\.?\s|agrotecnica|instituto)/.test(v)).length / valores.length > 0.6) {
        columnas.escuela = j;
        break;
      }
    }
  }

  const datos = [];
  for (const fila of filas.slice(indiceEncabezado + 1)) {
    const celda = campo => (columnas[campo] !== undefined ? String(fila[columnas[campo]] ?? '').trim() : '');
    let apellido = celda('apellido');
    let nombre = celda('nombre');
    if (!apellido && columnas.apellidoYNombre !== undefined) {
      const completo = celda('apellidoYNombre');
      [apellido, nombre] = completo.includes(',')
        ? completo.split(',').map(s => s.trim())
        : [completo, ''];
    }
    if (!apellido && !nombre && !celda('dni')) continue;
    const fecha = celda('fecha');
    datos.push({
      dni: celda('dni'), apellido, nombre,
      curso: celda('curso'), especialidad: celda('especialidad'),
      escuela: celda('escuela'), charla: celda('charla'),
      fecha: /^\d+(\.\d+)?$/.test(fecha) ? fechaDeExcel(fecha) : fecha,
      horas: celda('horas'), disertantes: celda('disertantes')
    });
  }
  return { columnas: Object.keys(columnas), filas: datos };
}
