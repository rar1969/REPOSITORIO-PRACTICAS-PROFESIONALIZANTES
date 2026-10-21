/**
 * modules/certificados/diploma — arma los PDF de los certificados.
 *
 * Toma la plantilla oficial sin texto (assets/certificados/plantilla-pp.pdf:
 * fondo, logos, título, sello y firma del modelo de Word de la DETyFP) y
 * escribe encima los datos de cada certificado, en las mismas posiciones que
 * el modelo. Todo ocurre en el navegador: los datos de los alumnos no salen
 * hacia ningún servidor para hacer el PDF.
 *
 * La plantilla se incrusta una sola vez como objeto reutilizable, así un lote
 * de 100 diplomas pesa poco más que uno.
 *
 * No depende del DOM: las librerías y los archivos se reciben ya cargados, de
 * modo que las pruebas lo corren en Node con los mismos archivos.
 */

export const ARCHIVOS = {
  plantilla: 'assets/certificados/plantilla-pp.pdf',
  texto: 'assets/fuentes/Philosopher-Regular.ttf',          // en el modelo: Albertus MT
  textoNegrita: 'assets/fuentes/Philosopher-Bold.ttf',
  negrita: 'assets/fuentes/LiberationSans-Bold.ttf',        // Arial Bold
  cursiva: 'assets/fuentes/LiberationSans-Italic.ttf',      // Arial Italic
  negritaCursiva: 'assets/fuentes/LiberationSans-BoldItalic.ttf'
};

/* ------------------------------------------------------- textos del modelo */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
               'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Título que se nombra en el certificado para cada especialidad de la base. */
export const TITULO_ESPECIALIDAD = {
  'Informática': 'Técnico en Informática Personal y Profesional',
  'Electromecánica': 'Técnico Electromecánico',
  'Maestro Mayor de Obras': 'Maestro Mayor de Obras',
  'Gestión y Administración de las Organizaciones':
    'Técnico en Gestión y Administración de las Organizaciones'
};

const UNIDADES = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho',
  'diecinueve', 'veinte', 'veintiuna', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = { 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta',
                  70: 'setenta', 80: 'ochenta', 90: 'noventa' };
const CENTENAS = { 100: 'ciento', 200: 'doscientas', 300: 'trescientas', 400: 'cuatrocientas',
  500: 'quinientas', 600: 'seiscientas', 700: 'setecientas', 800: 'ochocientas', 900: 'novecientas' };

/** 10 → "diez"; 21 → "veintiuna" (concuerda con "horas"). Hasta 999. */
export function enLetras(n) {
  n = Math.trunc(Number(n));
  if (!(n >= 0 && n < 1000)) return String(n);
  if (n < 30) return UNIDADES[n];
  if (n < 100) {
    const d = n - (n % 10);
    return n % 10 ? `${DECENAS[d]} y ${UNIDADES[n % 10]}` : DECENAS[d];
  }
  if (n === 100) return 'cien';
  const c = n - (n % 100);
  return n % 100 ? `${CENTENAS[c]} ${enLetras(n % 100)}` : CENTENAS[c];
}

/** "6to 1ra" → "6° 1°"; "7mo B" → "7° B"; "7mo" → "7°". */
export function cursoCorto(curso) {
  return String(curso ?? '').trim()
    .replace(/(\d+)\s*(?:ro|do|to|mo|vo|no|er|ra|da|°|º)\b\.?/gi, '$1°')
    .replace(/\s+/g, ' ');
}

/** "Agosto de 2026" a partir de una fecha (Date o 'AAAA-MM-DD'). */
export function mesYAnio(fecha) {
  const f = fecha instanceof Date ? fecha : new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return `${MESES[f.getMonth()]} de ${f.getFullYear()}`;
}

const mayusculas = texto => String(texto ?? '').toLocaleUpperCase('es-AR');

/** Los datos ya redactados como van en el diploma. */
export function contenidoDe(cert, { fecha = new Date(), lugar = 'San Miguel de Tucumán' } = {}) {
  const horas = Number(cert.horas) || 0;
  return {
    nombre: `${mayusculas(cert.apellido)} ${mayusculas(cert.nombre)}`.trim(),
    dni: cert.dni ? `DNI N.° ${cert.dni}` : '',
    curso: cursoCorto(cert.curso),
    escuela: cert.escuela ?? '',
    charla: cert.capacitacion ?? '',
    especialidad: TITULO_ESPECIALIDAD[cert.especialidad] ?? cert.especialidad ?? '',
    horas: `${horas} (${enLetras(horas)}) horas`,
    lugarYFecha: `${lugar}, ${mesYAnio(fecha)}`,
    codigo: cert.codigo ? `${cert.id} · Código de verificación ${cert.codigo}` : ''
  };
}

/* ----------------------------------------------------------- composición */

// Medidas tomadas del modelo de Word (puntos PDF, origen abajo a la izquierda).
const AZUL = [0.122, 0.22, 0.392];
const NEGRO = [0, 0, 0];
const GRIS_OSCURO = [0.2, 0.2, 0.2];
const GRIS = [0.333, 0.333, 0.333];
const CENTRO = 424;                 // eje de los renglones centrados
const ANCHO_UTIL = 540;             // entre los bordes celestes de la plantilla
const PARRAFO = { x: 144.3, ancho: 530.4, base: 177.4, interlineado: 15.3 };

/**
 * Escribe una línea hecha de tramos con distinto estilo, centrada en `centro`
 * o alineada a la izquierda desde `x`. Achica todo el renglón si no entra.
 */
function linea(pagina, tramos, { centro, x, base, anchoMax = ANCHO_UTIL, minimo = 0.75 }) {
  const ancho = escala => tramos.reduce((s, t) => s + t.fuente.widthOfTextAtSize(t.texto, t.tam * escala), 0);
  let escala = 1;
  while (ancho(escala) > anchoMax && escala > minimo) escala -= 0.02;
  let cursor = centro !== undefined ? centro - ancho(escala) / 2 : x;
  for (const t of tramos) {
    escribir(pagina, t, cursor, base, escala);
    cursor += t.fuente.widthOfTextAtSize(t.texto, t.tam * escala);
  }
  return ancho(escala) <= anchoMax;
}

function escribir(pagina, tramo, x, y, escala = 1) {
  pagina.drawText(tramo.texto, { x, y, size: tramo.tam * escala, font: tramo.fuente,
                                 color: tramo.rgb(...tramo.color) });
}

const contarRenglones = (tramos, ancho) => renglonesDe(tramos, ancho).renglones.length;

/** Parte el párrafo en palabras que conservan su estilo y lo justifica. */
function parrafo(pagina, tramos, { x, ancho, base, interlineado }) {
  const { renglones, anchoDe, espacio } = renglonesDe(tramos, ancho);
  renglones.forEach((renglon, n) => {
    const y = base - n * interlineado;
    const llenos = renglon.reduce((s, tok) => s + anchoDe(tok), 0);
    const huecos = renglon.length - 1;
    const ultimo = n === renglones.length - 1;
    const sep = !ultimo && huecos > 0 ? (ancho - llenos) / huecos : espacio;
    let cursor = x;
    for (const tok of renglon) {
      for (const p of tok) {
        escribir(pagina, p, cursor, y);
        cursor += p.fuente.widthOfTextAtSize(p.texto, p.tam);
      }
      cursor += sep;
    }
  });
  return renglones.length;
}

function renglonesDe(tramos, ancho) {
  const palabras = [];
  for (const t of tramos) {
    for (const [i, trozo] of t.texto.split(/(\s+)/).entries()) {
      if (!trozo) continue;
      if (/^\s+$/.test(trozo)) { palabras.push({ espacio: true, t }); continue; }
      palabras.push({ ...t, texto: trozo, pegada: i === 0 && !/^\s/.test(t.texto) });
    }
  }
  // Agrupa en "tokens": palabra + puntuación pegada de otro estilo ("Profesional" + ",").
  const tokens = [];
  for (const p of palabras) {
    if (p.espacio) { tokens.push(null); continue; }
    const ultimo = tokens[tokens.length - 1];
    if (ultimo && p.pegada) ultimo.push(p); else tokens.push([p]);
  }
  const anchoDe = tok => tok.reduce((s, p) => s + p.fuente.widthOfTextAtSize(p.texto, p.tam), 0);
  const espacio = tramos[0].fuente.widthOfTextAtSize(' ', tramos[0].tam);

  const renglones = [[]];
  let ocupado = 0;
  for (const tok of tokens.filter(Boolean)) {
    const w = anchoDe(tok);
    const actual = renglones[renglones.length - 1];
    if (actual.length && ocupado + espacio + w > ancho) { renglones.push([tok]); ocupado = w; }
    else { ocupado += (actual.length ? espacio : 0) + w; actual.push(tok); }
  }

  return { renglones, anchoDe, espacio };
}

/** Corta un texto en renglones que entren en `ancho`. */
function cortar(texto, fuente, tam, ancho) {
  const renglones = [''];
  for (const palabra of texto.split(/\s+/)) {
    const prueba = renglones[renglones.length - 1] ? `${renglones[renglones.length - 1]} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, tam) > ancho && renglones[renglones.length - 1]) renglones.push(palabra);
    else renglones[renglones.length - 1] = prueba;
  }
  return renglones;
}

/**
 * Genera un PDF con un certificado por página.
 *
 * @param {Array<object>} certificados  filas de `certificados_detalle`
 * @param {object} recursos  { PDFLib, fontkit, plantilla, texto, textoNegrita, negrita, cursiva, negritaCursiva }
 *                           (las librerías y los bytes de cada archivo de ARCHIVOS)
 * @param {object} [opciones] { fecha, lugar, mostrarCodigo }
 * @returns {Promise<Uint8Array>}
 */
export async function generarPdf(certificados, recursos, opciones = {}) {
  const { PDFDocument, rgb } = recursos.PDFLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(recursos.fontkit);
  doc.setTitle(certificados.length === 1
    ? `Certificado ${certificados[0].id}`
    : `Certificados de Prácticas Profesionalizantes (${certificados.length})`);
  doc.setAuthor('Dirección de Educación Técnica y Formación Profesional — Tucumán');
  doc.setCreator('Portal de Prácticas Profesionalizantes');
  doc.setLanguage('es-AR');

  const [fondo] = await doc.embedPdf(recursos.plantilla, [0]);
  const f = {
    texto: await doc.embedFont(recursos.texto, { subset: true }),
    textoNegrita: await doc.embedFont(recursos.textoNegrita, { subset: true }),
    negrita: await doc.embedFont(recursos.negrita, { subset: true }),
    cursiva: await doc.embedFont(recursos.cursiva, { subset: true }),
    negritaCursiva: await doc.embedFont(recursos.negritaCursiva, { subset: true })
  };
  const tramo = (texto, fuente, tam, color, extra = {}) => ({ texto, fuente, tam, color, rgb, ...extra });

  for (const cert of certificados) {
    const c = contenidoDe(cert, opciones);
    const pagina = doc.addPage([fondo.width, fondo.height]);
    pagina.drawPage(fondo, { x: 0, y: 0 });

    // Encabezado fijo.
    linea(pagina, [tramo('La Dirección de Educación Técnica y Formación Profesional (DETyFP)', f.texto, 14.04, AZUL)],
      { centro: 430, base: 405.7 });
    linea(pagina, [tramo('de la Provincia de Tucumán certifica que:', f.texto, 14.04, AZUL)],
      { centro: 430, base: 387.4 });

    // Nombre y DNI.
    linea(pagina, [
      tramo(c.dni ? `${c.nombre}, ` : c.nombre, f.negrita, 15.96, AZUL),
      ...(c.dni ? [tramo(c.dni, f.cursiva, 11.04, GRIS)] : [])
    ], { centro: 420.6, base: 329.1 });

    // Curso y escuela: en un renglón si entra; si no, en dos.
    const curso = tramo(c.curso, f.negrita, 12, GRIS_OSCURO);
    const escuela = tramo(c.escuela, f.negrita, 12, GRIS_OSCURO);
    const unRenglon = [tramo('Estudiante de ', f.texto, 12, NEGRO), curso,
      tramo(' perteneciente a la institución educativa ', f.texto, 12, NEGRO), escuela];
    const anchoUno = unRenglon.reduce((s, t) => s + t.fuente.widthOfTextAtSize(t.texto, t.tam), 0);
    if (anchoUno <= ANCHO_UTIL / 0.92) {   // entra achicando la letra hasta un 8 %
      linea(pagina, unRenglon, { centro: CENTRO, base: 279.1, minimo: 0.92 });
      linea(pagina, [tramo('ha participado de la charla:', f.texto, 12, NEGRO)], { centro: CENTRO, base: 263.7 });
    } else {
      linea(pagina, [tramo('Estudiante de ', f.texto, 12, NEGRO), curso,
        tramo(' perteneciente a la institución educativa', f.texto, 12, NEGRO)], { centro: CENTRO, base: 285 });
      linea(pagina, [escuela, tramo(', ha participado de la charla:', f.texto, 12, NEGRO)],
        { centro: CENTRO, base: 269.6 });
    }

    // Charla, entre comillas, en uno o dos renglones.
    const tamCharla = 15.96;
    const renglones = cortar(c.charla, f.negritaCursiva, tamCharla, 500);
    const bases = renglones.length === 1 ? [228.7] : [237.5, 218.5];
    renglones.slice(0, 2).forEach((texto, i) => {
      const primero = i === 0;
      const ultimo = i === Math.min(renglones.length, 2) - 1;
      linea(pagina, [
        tramo(primero ? '“' : '', f.negritaCursiva, tamCharla, AZUL),
        tramo(texto, f.negritaCursiva, tamCharla, AZUL),
        tramo(ultimo ? '”' : '', f.negritaCursiva, tamCharla, AZUL)
      ], { centro: 416, base: bases[i] });
    });

    // Párrafo de acreditación: en dos renglones, como el modelo. Si la
    // especialidad es larga, se achica la letra antes que pisar el sello.
    const tramosParrafo = tam => [
      tramo('En el marco de las Prácticas Profesionalizantes correspondientes a la especialidad ', f.texto, tam, NEGRO),
      tramo(c.especialidad, f.textoNegrita, tam, NEGRO),
      tramo(', acreditando un total de ', f.texto, tam, NEGRO),
      tramo(c.horas, f.textoNegrita, tam, NEGRO),
      tramo(' en dicho concepto.', f.texto, tam, NEGRO)
    ];
    let tamParrafo = 12;
    while (tamParrafo > 10 && contarRenglones(tramosParrafo(tamParrafo), PARRAFO.ancho) > 2) tamParrafo -= 0.25;
    const renglonesParrafo = parrafo(pagina, tramosParrafo(tamParrafo), PARRAFO);

    // Lugar y fecha, alineado a la derecha como en el modelo.
    const baseFecha = Math.min(138.6, PARRAFO.base - renglonesParrafo * PARRAFO.interlineado - 8);
    linea(pagina, [tramo(c.lugarYFecha, f.texto, 12, NEGRO)],
      { x: 609 - f.texto.widthOfTextAtSize(c.lugarYFecha, 12), base: baseFecha });

    if (opciones.mostrarCodigo && c.codigo) {
      linea(pagina, [tramo(c.codigo, f.cursiva, 7, GRIS)], { x: 160, base: 30 });
    }
  }

  return doc.save();
}

/** Nombre de archivo para descargar: "CER-0001_Aducci_Ortiz_Valentino.pdf". */
export function nombreArchivo(certificados) {
  const limpiar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  if (certificados.length === 1) {
    const c = certificados[0];
    return `${c.id}_${limpiar(c.apellido)}_${limpiar(c.nombre)}.pdf`;
  }
  const charlas = new Set(certificados.map(c => c.capacitacion));
  const escuelas = new Set(certificados.map(c => c.escuela));
  const partes = ['Certificados'];
  if (charlas.size === 1) partes.push(limpiar([...charlas][0]).slice(0, 40));
  if (escuelas.size === 1) partes.push(limpiar([...escuelas][0]).replace(/^Escuela_Tecnica_/, 'ET_'));
  partes.push(`${certificados.length}`);
  return `${partes.join('_')}.pdf`;
}
