/**
 * Un Supabase de prueba, sin internet: Postgres real (PGlite) con las
 * migraciones y semillas del portal, y un cliente que imita la parte de
 * supabase-js que usa el adaptador.
 *
 * La gracia es que las consultas se ejecutan con el rol de quien inició
 * sesión (anon o authenticated), así que las políticas RLS de verdad deciden
 * qué se lee y qué se rechaza. El portal se prueba de punta a punta contra la
 * misma seguridad que va a tener en Supabase.
 *
 * Requiere: npm install @electric-sql/pglite
 */

import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

const raiz = new URL('../../', import.meta.url);
const sql = archivo => fs.readFileSync(new URL(archivo, raiz), 'utf8');

export async function crearBase() {
  // Fechas como texto, igual que las devuelve la API de Supabase.
  const texto = v => v;
  const db = new PGlite({ extensions: { unaccent }, parsers: { 1082: texto, 1114: texto, 1184: texto } });
  await db.exec(`
    create schema extensions; create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, extensions, auth to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id bigint generated always as identity, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated;
  `);
  await db.exec(sql('supabase/migraciones/001_esquema.sql'));
  await db.exec(sql('supabase/migraciones/002_almacenamiento.sql'));
  await db.exec(sql('supabase/migraciones/004_certificados.sql'));
  await db.exec(`
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    grant execute on all functions in schema public to anon, authenticated;
  `);
  await db.exec(sql('supabase/semillas.sql'));
  return db;
}

/** Da de alta una cuenta con rol, como lo haría la Dirección desde Supabase. */
export async function crearCuenta(db, cuentas, { id, correo, clave, rol, nombre = null, escuela_id = null }) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, correo]);
  await db.query('update perfiles set rol = $2, nombre = $3, escuela_id = $4 where id = $1',
    [id, rol, nombre, escuela_id]);
  cuentas.set(correo, { id, clave });
}

const q = nombre => `"${String(nombre).replace(/"/g, '""')}"`;

export function crearCliente(db, cuentas) {
  let usuario = null;          // { id, email }
  let cola = Promise.resolve();
  const oyentes = new Set();
  const avisar = evento => {
    for (const fn of oyentes) fn(evento, usuario ? { user: usuario } : null);
  };

  /** Ejecuta con el rol de la sesión: anon o authenticated. */
  function ejecutar(consulta, params = []) {
    const tarea = cola.then(async () => {
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuario?.id ?? '']);
      await db.exec(`set role ${usuario ? 'authenticated' : 'anon'}`);
      try {
        return { resultado: await db.query(consulta, params) };
      } catch (error) {
        return { error: { code: error.code, message: error.message } };
      } finally {
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
      }
    });
    cola = tarea.catch(() => {});
    return tarea;
  }

  class Consulta {
    constructor(tabla) {
      Object.assign(this, { tabla, op: 'select', columnas: '*', filtros: [], params: [],
        ordenes: [], rango: null, contar: false, devolver: false, unica: null, valores: null });
    }
    param(v) { this.params.push(v); return `$${this.params.length}`; }
    select(columnas = '*', opciones = {}) {
      if (this.op === 'select') { this.columnas = columnas; this.contar = opciones.count === 'exact'; }
      else this.devolver = true;
      return this;
    }
    insert(filas) { this.op = 'insert'; this.valores = Array.isArray(filas) ? filas : [filas]; return this; }
    update(valores) { this.op = 'update'; this.valores = valores; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filtros.push(() => `${q(c)} = ${this.param(v)}`); return this; }
    in(c, v) { this.filtros.push(() => `${q(c)} = any(${this.param(v)})`); return this; }
    contains(c, v) { this.filtros.push(() => `${q(c)} @> ${this.param(v)}::text[]`); return this; }
    overlaps(c, v) { this.filtros.push(() => `${q(c)} && ${this.param(v)}::text[]`); return this; }
    ilike(c, v) { this.filtros.push(() => `${q(c)} ilike ${this.param(v)}`); return this; }
    order(c, { ascending = true, nullsFirst = false } = {}) {
      this.ordenes.push(`${q(c)} ${ascending ? 'asc' : 'desc'} nulls ${nullsFirst ? 'first' : 'last'}`);
      return this;
    }
    range(desde, hasta) { this.rango = [desde, hasta]; return this; }
    single() { this.unica = 'single'; return this; }
    maybeSingle() { this.unica = 'maybe'; return this; }

    async ejecutar() {
      this.params = [];
      const donde = () => {
        const partes = this.filtros.map(f => f());
        return partes.length ? ` where ${partes.join(' and ')}` : '';
      };
      const tabla = `public.${q(this.tabla)}`;
      let consulta;

      if (this.op === 'select') {
        consulta = `select ${this.columnas === '*' ? '*' : q(this.columnas)} from ${tabla}${donde()}`;
        if (this.ordenes.length) consulta += ` order by ${this.ordenes.join(', ')}`;
        if (this.rango) consulta += ` limit ${this.rango[1] - this.rango[0] + 1} offset ${this.rango[0]}`;
      } else if (this.op === 'insert') {
        const columnas = [...new Set(this.valores.flatMap(Object.keys))];
        const filas = this.valores.map(f => `(${columnas.map(c => (c in f ? this.param(f[c]) : 'default')).join(', ')})`);
        consulta = `insert into ${tabla} (${columnas.map(q).join(', ')}) values ${filas.join(', ')}`;
      } else if (this.op === 'update') {
        const asignaciones = Object.entries(this.valores).map(([c, v]) => `${q(c)} = ${this.param(v)}`);
        consulta = `update ${tabla} set ${asignaciones.join(', ')}${donde()}`;
      } else {
        consulta = `delete from ${tabla}${donde()}`;
      }
      if (this.op !== 'select' && this.devolver) consulta += ' returning *';

      const { resultado, error } = await ejecutar(consulta, this.params);
      if (error) return { data: null, error, count: null };
      let data = this.op === 'select' || this.devolver ? resultado.rows : null;

      let count = null;
      if (this.contar) {
        const paramsFiltro = [];
        this.params = paramsFiltro;
        const cuenta = await ejecutar(`select count(*)::int n from ${tabla}${donde()}`, this.params);
        count = cuenta.resultado?.rows[0].n ?? null;
      }
      if (this.unica) {
        if (data.length > 1 || (this.unica === 'single' && data.length === 0)) {
          return { data: null, error: { code: 'PGRST116', message: 'Se esperaba una sola fila' }, count };
        }
        data = data[0] ?? null;
      }
      return { data, error: null, count };
    }
    then(bien, mal) { return this.ejecutar().then(bien, mal); }
  }

  const subidas = [];

  return {
    subidas,
    from: tabla => new Consulta(tabla),

    async rpc(nombre, argumentos = {}) {
      const claves = Object.keys(argumentos);
      const lista = claves.map((c, i) => `${c} => $${i + 1}`).join(', ');
      const { resultado, error } = await ejecutar(`select public.${q(nombre)}(${lista}) as r`,
        claves.map(c => argumentos[c]));
      return error ? { data: null, error } : { data: resultado.rows[0].r, error: null };
    },

    storage: {
      from: bucket => ({
        async upload(ruta, archivo) {
          const { error } = await ejecutar('insert into storage.objects (bucket_id, name) values ($1, $2)',
            [bucket, ruta]);
          if (!error) subidas.push({ bucket, ruta, nombre: archivo.name });
          return { data: error ? null : { path: ruta }, error };
        },
        getPublicUrl: ruta => ({ data: { publicUrl: `https://simulado.supabase.co/storage/v1/object/public/${bucket}/${ruta}` } })
      })
    },

    auth: {
      async getSession() {
        return { data: { session: usuario ? { user: usuario } : null } };
      },
      async signInWithPassword({ email, password }) {
        const cuenta = cuentas.get(email);
        if (!cuenta || cuenta.clave !== password) {
          return { data: {}, error: { message: 'Invalid login credentials' } };
        }
        usuario = { id: cuenta.id, email };
        avisar('SIGNED_IN');
        return { data: { user: usuario }, error: null };
      },
      async signOut() { usuario = null; avisar('SIGNED_OUT'); return { error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser() { avisar('USER_UPDATED'); return { data: { user: usuario }, error: null }; },
      onAuthStateChange(fn) {
        oyentes.add(fn);
        return { data: { subscription: { unsubscribe: () => oyentes.delete(fn) } } };
      }
    }
  };
}
