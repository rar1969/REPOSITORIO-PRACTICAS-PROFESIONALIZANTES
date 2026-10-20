/**
 * Adaptador Supabase: PostgreSQL + autenticación + archivos (SDD §7, fase 2).
 *
 * Cumple el mismo contrato que el adaptador estático, campo por campo, para
 * que pasar de uno a otro sea cambiar una línea de PORTAL_CONFIG. Las tablas
 * de la base (supabase/migraciones/001_esquema.sql) tienen los mismos nombres
 * y columnas que los archivos de data/, así que no hay traducción de datos:
 * solo se traduce la forma de pedirlos.
 *
 * Diferencias de comportamiento que vale la pena conocer:
 *   - Filtra y pagina en el servidor: con 2.000 oferentes, el navegador
 *     recibe 12, no 2.000 (SDD §3, escalabilidad).
 *   - Lo que el rol no permite, la base no lo devuelve o lo rechaza. El error
 *     llega a la persona como un aviso claro, no como un código.
 *   - Lo guardado es de todos: no hay "capa de cambios" por navegador, así que
 *     restablecer() no hace nada.
 */

import { esquemaDe } from '../../data/esquemas.js';
import { obtenerCliente } from '../supabase.js';

const normalizar = texto => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const comodines = texto => texto.replace(/[\\%_]/g, c => `\\${c}`);

/** Columnas que calcula la base y que nunca se envían. */
const CALCULADAS = new Set(['busqueda', 'actualizado']);

function limpiarSalida(fila) {
  if (!fila || typeof fila !== 'object') return fila;
  const { busqueda, ...resto } = fila;
  return resto;
}

function limpiarEntrada(datos) {
  const limpio = {};
  for (const [campo, valor] of Object.entries(datos ?? {})) {
    if (CALCULADAS.has(campo) || campo.startsWith('_') || valor === undefined) continue;
    limpio[campo] = valor;
  }
  return limpio;
}

/** Convierte un error de la base en un mensaje para la persona. */
function fallo(error, accion) {
  if (!error) return null;
  const texto = String(error.message ?? '');
  let mensaje;
  if (error.code === '42501' || /row-level security|permission denied/i.test(texto)) {
    mensaje = 'Tu perfil no tiene permiso para esta acción. Iniciá sesión con un usuario autorizado.';
  } else if (error.code === '23505') {
    mensaje = 'Ya existe un registro con ese dato.';
  } else if (error.code === '23503') {
    mensaje = 'Un dato hace referencia a algo que no existe (por ejemplo, un departamento mal escrito).';
  } else if (/fetch|network|Failed to/i.test(texto)) {
    mensaje = 'No hay conexión con la base de datos. Revisá internet y probá de nuevo.';
  } else {
    mensaje = `No se pudo ${accion}: ${texto}`;
  }
  const envuelto = new Error(mensaje);
  envuelto.causa = error;
  envuelto.codigo = error.code;
  return envuelto;
}

function aplicarFiltros(consulta, filtros, esquema) {
  const arreglos = new Set(esquema.arreglos ?? []);
  for (const [campo, valor] of Object.entries(filtros ?? {})) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor) && valor.length === 0) continue;

    if (campo === 'q') {
      consulta = consulta.ilike('busqueda', `%${comodines(normalizar(valor))}%`);
    } else if (arreglos.has(campo)) {
      consulta = Array.isArray(valor) ? consulta.overlaps(campo, valor) : consulta.contains(campo, [valor]);
    } else {
      consulta = Array.isArray(valor) ? consulta.in(campo, valor) : consulta.eq(campo, valor);
    }
  }
  return consulta;
}

export function crearAdaptador(config) {
  const cliente = () => obtenerCliente(config);
  const tablaDe = coleccion => esquemaDe(coleccion).tabla ?? coleccion;

  return {
    nombre: 'supabase',

    async listar(coleccion, { filtros, orden, pagina = 1, porPagina = 20 } = {}) {
      const esquema = esquemaDe(coleccion);
      const db = await cliente();

      if (esquema.tipo === 'lista') {
        const columna = esquema.columna ?? 'nombre';
        const { data, error } = await db.from(tablaDe(coleccion)).select(columna).order(columna);
        if (error) throw fallo(error, `leer ${coleccion}`);
        const items = data.map(fila => fila[columna]);
        return { items, total: items.length, pagina: 1, porPagina: 0 };
      }

      let consulta = db.from(tablaDe(coleccion)).select('*', { count: 'exact' });
      consulta = aplicarFiltros(consulta, filtros, esquema);

      if (orden) {
        const descendente = orden.startsWith('-');
        consulta = consulta.order(descendente ? orden.slice(1) : orden,
          { ascending: !descendente, nullsFirst: false });
      }
      // Desempate estable: sin él, una página podría repetir o saltear filas.
      consulta = consulta.order(esquema.clave, { ascending: true });

      if (porPagina > 0) {
        const desde = (pagina - 1) * porPagina;
        consulta = consulta.range(desde, desde + porPagina - 1);
      }

      const { data, error, count } = await consulta;
      if (error) throw fallo(error, `leer ${coleccion}`);
      return {
        items: data.map(limpiarSalida),
        total: count ?? data.length,
        pagina: porPagina > 0 ? pagina : 1,
        porPagina
      };
    },

    async obtener(coleccion, id) {
      const esquema = esquemaDe(coleccion);
      const db = await cliente();
      const clave = esquema.tipo === 'lista' ? (esquema.columna ?? 'nombre') : esquema.clave;
      const { data, error } = await db.from(tablaDe(coleccion)).select('*').eq(clave, id).maybeSingle();
      if (error) throw fallo(error, `leer ${coleccion}`);
      if (!data) return null;
      return esquema.tipo === 'lista' ? data[clave] : limpiarSalida(data);
    },

    async crear(coleccion, datos) {
      const esquema = esquemaDe(coleccion);
      const db = await cliente();
      const tabla = db.from(tablaDe(coleccion));

      if (esquema.tipo === 'lista') {
        const { error } = await tabla.insert({ [esquema.columna ?? 'nombre']: datos });
        if (error) throw fallo(error, `agregar a ${coleccion}`);
        return datos;
      }

      const fila = limpiarEntrada(datos);
      if (!fila[esquema.clave]) delete fila[esquema.clave];   // la base numera

      // Quien envía una solicitud no puede leerla después: no se pide la fila.
      if (esquema.privada) {
        const { error } = await tabla.insert(fila);
        if (error) throw fallo(error, `guardar en ${coleccion}`);
        return { ...fila };
      }

      const { data, error } = await tabla.insert(fila).select().single();
      if (error) throw fallo(error, `guardar en ${coleccion}`);
      return limpiarSalida(data);
    },

    async actualizar(coleccion, id, cambios) {
      const esquema = esquemaDe(coleccion);
      const db = await cliente();
      const { data, error } = await db.from(tablaDe(coleccion))
        .update(limpiarEntrada(cambios)).eq(esquema.clave, id).select().maybeSingle();
      if (error) throw fallo(error, `modificar ${coleccion}`);
      // Sin fila devuelta: no existe, o el rol no tiene permiso para tocarla.
      if (!data) throw fallo({ code: '42501', message: 'sin filas' }, `modificar ${coleccion}`);
      return limpiarSalida(data);
    },

    async eliminar(coleccion, id) {
      const esquema = esquemaDe(coleccion);
      const db = await cliente();
      const clave = esquema.tipo === 'lista' ? (esquema.columna ?? 'nombre') : esquema.clave;
      const { data, error } = await db.from(tablaDe(coleccion)).delete().eq(clave, id).select(clave);
      if (error) throw fallo(error, `eliminar de ${coleccion}`);
      if (!data?.length) throw fallo({ code: '42501', message: 'sin filas' }, `eliminar de ${coleccion}`);
    },

    /** Suma 1 a un contador sin exigir permiso de edición sobre la fila. */
    async incrementar(coleccion, id, campo) {
      const db = await cliente();
      if (coleccion === 'documentos' && campo === 'descargas') {
        const { data, error } = await db.rpc('contar_descarga', { documento: id });
        if (error) throw fallo(error, 'contar la descarga');
        return data;
      }
      const actual = await this.obtener(coleccion, id);
      const nuevo = (Number(actual?.[campo]) || 0) + 1;
      await this.actualizar(coleccion, id, { [campo]: nuevo });
      return nuevo;
    },

    async subirArchivo(bucket, archivo) {
      const db = await cliente();
      const nombre = String(archivo.name)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\w.-]+/g, '-').toLowerCase();
      const ruta = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${nombre}`;

      const { error } = await db.storage.from(bucket).upload(ruta, archivo, {
        contentType: archivo.type || undefined, upsert: false
      });
      if (error) throw fallo(error, 'subir el archivo');
      const { data } = db.storage.from(bucket).getPublicUrl(ruta);
      return { url: data.publicUrl, tamanio: archivo.size, ruta, efimero: false };
    },

    restablecer() {
      // Los datos viven en la base, compartidos: no hay copia local que descartar.
    }
  };
}
