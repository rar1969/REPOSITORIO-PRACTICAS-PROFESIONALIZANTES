/**
 * Regenera data/escuelas.json a partir de data/escuelas.csv.
 *
 *   node herramientas/escuelas-desde-csv.mjs           verifica y muestra el informe
 *   node herramientas/escuelas-desde-csv.mjs --escribir  además reescribe el JSON
 *
 * El CSV es la fuente de verdad mientras se depura la nómina: se abre en Excel
 * o en una planilla compartida, lo corrige quien conoce cada escuela, y este
 * script lo convierte al JSON que consume el portal, validando de paso.
 *
 * Nunca inventa datos: una coordenada vacía queda vacía y la escuela se marca
 * como no verificada, para que el mapa pueda mostrarla distinta en vez de
 * ubicarla en un lugar que no es.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = path.join(RAIZ, 'data', 'escuelas.csv');
const SALIDA = path.join(RAIZ, 'data', 'escuelas.json');
const escribir = process.argv.includes('--escribir');

const DEPARTAMENTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'departamentos.json'), 'utf8'));
const ESPECIALIDADES = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'especialidades.json'), 'utf8'));

// Rectángulo que contiene la provincia de Tucumán, con margen.
const LIMITES = { latMin: -28.10, latMax: -26.00, lngMin: -66.30, lngMax: -64.40 };

/* ------------------------------------------------------------------- CSV */

function leerCSV(texto) {
  const filas = [];
  let campo = '', fila = [], entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  const encabezado = filas.shift().map(h => h.replace(/^﻿/, '').trim());
  return filas
    .filter(f => f.some(v => v.trim() !== ''))
    .map(f => Object.fromEntries(encabezado.map((h, i) => [h, (f[i] ?? '').trim()])));
}

/* ------------------------------------------------------------ validación */

const errores = [];
const avisos = [];
const falla = (id, texto) => errores.push(`${id}: ${texto}`);
const aviso = (id, texto) => avisos.push(`${id}: ${texto}`);

function convertir(filas) {
  const vistos = new Set();
  const cues = new Map();

  return filas.map(f => {
    const id = f.id || '(sin id)';

    if (!/^ESC-\d{2,}$/.test(f.id)) falla(id, 'identificador con formato inesperado');
    if (vistos.has(f.id)) falla(id, 'identificador repetido');
    vistos.add(f.id);

    if (!f.nombre) falla(id, 'falta el nombre');
    if (!f.departamento) aviso(id, 'sin departamento');
    else if (!DEPARTAMENTOS.includes(f.departamento)) {
      falla(id, `departamento "${f.departamento}" no es uno de los 17 de Tucumán`);
    }
    if (!f.localidad) aviso(id, 'sin localidad');
    if (!f.direccion) aviso(id, 'sin dirección');
    if (!f.cue) aviso(id, 'sin CUE');
    else if (!/^\d{7}(\d{2})?$/.test(f.cue)) aviso(id, `CUE con formato inesperado: "${f.cue}"`);
    else if (cues.has(f.cue)) falla(id, `CUE repetido con ${cues.get(f.cue)}: ${f.cue}`);
    if (f.cue) cues.set(f.cue, id);

    const especialidades = f.especialidades ? f.especialidades.split('|').map(s => s.trim()).filter(Boolean) : [];
    for (const esp of especialidades) {
      if (!ESPECIALIDADES.includes(esp)) falla(id, `especialidad desconocida: "${esp}"`);
    }
    if (especialidades.length === 0) aviso(id, 'sin especialidades');

    const lat = f.lat === '' ? null : Number(f.lat);
    const lng = f.lng === '' ? null : Number(f.lng);

    if (lat === null || lng === null) {
      aviso(id, 'sin coordenadas: no se dibuja en el mapa');
    } else if (Number.isNaN(lat) || Number.isNaN(lng)) {
      falla(id, 'coordenada no numérica');
    } else if (lat < LIMITES.latMin || lat > LIMITES.latMax || lng < LIMITES.lngMin || lng > LIMITES.lngMax) {
      falla(id, `coordenada fuera de Tucumán (${lat}, ${lng})`);
    } else if (f.precision === 'localidad') {
      aviso(id, 'ubicación aproximada: apunta al centro de la localidad, no a la escuela');
    } else if (minutoEntero(lat) && minutoEntero(lng)) {
      aviso(id, `coordenada en minutos enteros (${lat}, ${lng}): es el centro de la localidad, no la escuela`);
    } else if (decimales(f.lat) < 4 || decimales(f.lng) < 4) {
      aviso(id, `coordenada con poca precisión (${lat}, ${lng}): conviene tomarla del frente de la escuela`);
    }

    const verificado = /^(s[ií]|true|1)$/i.test(f.verificado);
    if (verificado && (lat === null || !f.direccion)) {
      falla(id, 'marcada como verificada pero le falta dirección o coordenadas');
    }

    const escuela = {
      id: f.id,
      cue: f.cue,
      nombre: f.nombre,
      tipo: f.tipo || (/Agrot/i.test(f.nombre) ? 'agrotecnica' : 'tecnica'),
      localidad: f.localidad,
      municipio: f.municipio || '',
      departamento: f.departamento,
      direccion: f.direccion,
      lat, lng,
      precision: f.precision || (lat === null ? '' : 'sin determinar'),
      fuente_datos: f.fuente_datos || '',
      especialidades,
      alumnos_por_especialidad: desglose(f.alumnos_por_especialidad),
      alumnos_7mo: f.alumnos_7mo === '' || f.alumnos_7mo === undefined ? null : Number(f.alumnos_7mo),
      circuito: f.circuito || '',
      supervisor: f.supervisor || '',
      director: f.director || '',
      telefono: f.telefono || '',
      correo: f.correo || '',
      verificado
    };
    if (f.observaciones) escuela.observaciones = f.observaciones;
    return escuela;
  });
}

// "Electromecánica:50|Informática:12" → { Electromecánica: 50, Informática: 12 }
function desglose(texto) {
  const salida = {};
  for (const parte of (texto || '').split('|').filter(Boolean)) {
    const i = parte.lastIndexOf(':');
    if (i > 0) salida[parte.slice(0, i).trim()] = Number(parte.slice(i + 1));
  }
  return salida;
}

const decimales = s => (String(s).split('.')[1] || '').length;

// Un valor que cae en un minuto de arco exacto delata una tabla de localidades
// (los gazetteers publican grados y minutos), no una lectura sobre el terreno.
const minutoEntero = v => Math.abs(v * 60 - Math.round(v * 60)) < 0.02;

/* ------------------------------------------------------------------ main */

if (!fs.existsSync(ENTRADA)) {
  console.error(`No existe ${ENTRADA}`);
  process.exit(1);
}

const escuelas = convertir(leerCSV(fs.readFileSync(ENTRADA, 'utf8')));

console.log(`\n${escuelas.length} escuelas leídas de escuelas.csv`);
const verificadas = escuelas.filter(e => e.verificado).length;
const ubicadas = escuelas.filter(e => e.lat !== null).length;
console.log(`  verificadas: ${verificadas}/${escuelas.length}   con coordenada: ${ubicadas}/${escuelas.length}`);

if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}) — no impiden publicar:`);
  for (const a of avisos) console.log('  · ' + a);
}
if (errores.length) {
  console.log(`\nErrores (${errores.length}) — hay que corregirlos:`);
  for (const e of errores) console.log('  ✗ ' + e);
  console.log('\nNo se escribió nada.\n');
  process.exit(1);
}

if (escribir) {
  fs.writeFileSync(SALIDA, JSON.stringify(escuelas, null, 2) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(RAIZ, SALIDA)}\n`);
} else {
  console.log('\nSin errores. Volvé a correrlo con --escribir para actualizar el JSON.\n');
}
