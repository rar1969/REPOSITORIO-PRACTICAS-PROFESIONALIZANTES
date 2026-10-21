/**
 * Pruebas del esquema y los permisos de la base (fase 2), en un Postgres real.
 *
 *   npm install @electric-sql/pglite      (una sola vez)
 *   node pruebas/base-de-datos.mjs
 *
 * PGlite es Postgres compilado para correr dentro de Node, sin servidor. Se le
 * agrega lo mínimo que Supabase trae de fábrica —los roles anon y
 * authenticated, auth.users, auth.uid() y el esquema de almacenamiento— y se
 * corren las migraciones y las semillas tal cual se van a pegar en Supabase.
 *
 * Lo que importa probar acá es lo que no se puede probar desde el navegador:
 * que un visitante con la clave pública no lea un solo estudiante, que una
 * escuela vea solo los suyos, que una empresa no se valide sola el convenio.
 */

import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

const raiz = new URL('../', import.meta.url);
const sql = archivo => fs.readFileSync(new URL(archivo, raiz), 'utf8');

const db = new PGlite({ extensions: { unaccent } });

let fallas = 0;
const ok = (etiqueta, condicion) => {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'}  ${etiqueta}`);
};
const falla = async (consulta, params) => {
  try { await db.query(consulta, params); return false; } catch { return true; }
};

/* ------------------------------------------- lo que Supabase trae de fábrica */

await db.exec(`
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, extensions, auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id bigint generated always as identity, bucket_id text, name text);
  alter table storage.objects enable row level security;
`);

/* ------------------------------------------------- migraciones y semillas */

console.log('\nMigraciones');
let error = null;
try {
  await db.exec(sql('supabase/migraciones/001_esquema.sql'));
  await db.exec(sql('supabase/migraciones/002_almacenamiento.sql'));
  await db.exec(sql('supabase/migraciones/004_certificados.sql'));
  await db.exec(sql('supabase/migraciones/005_carga_certificados.sql'));
} catch (e) { error = e; }
ok(`001, 002, 004 y 005 corren sin error${error ? `: ${error.message}` : ''}`, !error);

// Supabase concede estos privilegios por defecto; las políticas RLS acotan.
await db.exec(`
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;
  revoke execute on function public.contar_descarga(text) from public;
  grant execute on function public.contar_descarga(text) to anon, authenticated;
  revoke execute on function public.registrar_emision(text[]) from public, anon;
`);

error = null;
try { await db.exec(sql('supabase/semillas.sql')); } catch (e) { error = e; await db.exec('rollback'); }
ok(`las semillas cargan${error ? `: ${error.message}` : ''}`, !error);
error = null;
try { await db.exec(sql('supabase/semillas.sql')); } catch (e) { error = e; await db.exec('rollback'); }
ok('y se pueden volver a correr sin duplicar', !error &&
  (await db.query('select count(*)::int n from escuelas')).rows[0].n === 39);

const cuenta = async tabla => (await db.query(`select count(*)::int n from ${tabla}`)).rows[0].n;
const datos = archivo => JSON.parse(sql(`data/${archivo}`));
// Certificados de prueba (migración 004): un dictado y dos estudiantes.
await db.exec(`
  insert into capacitaciones (id, titulo, horas_certificadas) values ('CAP-90', 'Charla de prueba', 10);
  insert into dictados (capacitacion_id, escuela_id, fecha) values ('CAP-90', 'ESC-01', '2026-05-07');
  insert into participantes (dni, apellido, nombre, escuela_id) values ('49000001', 'Prueba', 'Uno', 'ESC-01');
  insert into participantes (apellido, nombre, escuela_id, revisar, observaciones)
    values ('Prueba', 'Dos', 'ESC-01', true, 'Sin DNI');
  insert into certificados (participante_id, dictado_id, curso, especialidad, horas)
    select id, 'DIC-001', '7mo', 'Informática', 10 from participantes;
`);
ok('los certificados se numeran y llevan un código único',
  (await db.query(`select count(distinct codigo)::int n, min(id) primero from certificados`)).rows[0].primero === 'CER-0001' &&
  (await db.query(`select count(distinct codigo)::int n from certificados`)).rows[0].n === 2);
ok('una persona no recibe dos veces el mismo certificado',
  await falla(`insert into certificados (participante_id, dictado_id, horas) values ('PAR-0001', 'DIC-001', 10)`));
const resumen = async () => (await db.query(
  `select escuelas_participantes e, participantes_inscritos p, fecha_inicio::text i from capacitaciones where id = 'CAP-90'`)).rows[0];
ok('la capacitación cuenta sola escuelas e inscriptos', (r => r.e === 1 && r.p === 2 && r.i === '2026-05-07')(await resumen()));
await db.exec(`insert into dictados (capacitacion_id, escuela_id, fecha) values ('CAP-90', 'ESC-02', '2026-04-30');
  insert into participantes (dni, apellido, nombre, escuela_id) values ('49000003', 'Prueba', 'Tres', 'ESC-02');
  insert into certificados (participante_id, dictado_id, horas) values ('PAR-0003', 'DIC-002', 10);`);
ok('una carga a mano en otra escuela actualiza el catálogo', (r => r.e === 2 && r.p === 3 && r.i === '2026-04-30')(await resumen()));
await db.exec(`delete from certificados where participante_id = 'PAR-0003'; delete from dictados where id = 'DIC-002';`);
ok('y quitarla lo vuelve atrás', (r => r.e === 1 && r.p === 2 && r.i === '2026-05-07')(await resumen()));
ok('un DNI no se repite entre participantes',
  await falla(`insert into participantes (dni, apellido, nombre) values ('49000001', 'Otro', 'Igual')`));

ok('39 escuelas, 17 departamentos, 14 especialidades',
  await cuenta('escuelas') === 39 && await cuenta('departamentos') === 17 && await cuenta('especialidades') === 14);
ok('las especialidades llevan su resolución',
  (await db.query(`select resolucion from especialidades where nombre = 'Electrónica'`)).rows[0].resolucion === 'Res. 510/5');
ok('las especialidades de cada escuela llegan como arreglo',
  (await db.query(`select count(*)::int n from escuelas where 'Producción Agropecuaria' = any(especialidades)`)).rows[0].n > 10);
ok('la búsqueda ignora tildes y mayúsculas',
  (await db.query(`select razon_social from oferentes where busqueda like '%' || normalizar('TORNERIA') || '%'`)).rows.length === 1);

/* ------------------------------------------------------------------ roles */

const USUARIOS = {
  admin:    '00000000-0000-0000-0000-00000000000a',
  escuela:  '00000000-0000-0000-0000-00000000000e',
  empresa:  '00000000-0000-0000-0000-0000000000e1',
  logueado: '00000000-0000-0000-0000-00000000000f'
};
for (const [nombre, id] of Object.entries(USUARIOS)) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${nombre}@ejemplo.com`]);
}
ok('dar de alta un usuario le crea el perfil, como visitante', await cuenta('perfiles') === 4 &&
  (await db.query('select rol from perfiles where id = $1', [USUARIOS.logueado])).rows[0].rol === 'visitante');

const escuelaPrueba = (await db.query(`select id, nombre from escuelas order by id limit 1`)).rows[0];
await db.query(`update perfiles set rol = 'admin' where id = $1`, [USUARIOS.admin]);
await db.query(`update perfiles set rol = 'escuela', escuela_id = $2 where id = $1`, [USUARIOS.escuela, escuelaPrueba.id]);
await db.query(`update perfiles set rol = 'empresa', oferente_id = 'OFER-TUC-001' where id = $1`, [USUARIOS.empresa]);

async function como(quien, fn) {
  if (quien === 'anon') {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [USUARIOS[quien]]);
    await db.exec('set role authenticated');
  }
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

console.log('\nVisitante sin sesión (la clave pública del portal)');
await como('anon', async () => {
  ok('ve oferentes, escuelas y documentos', await cuenta('oferentes') === 4 && await cuenta('escuelas') === 39 &&
    await cuenta('documentos') === datos('documentos.json').length);
  ok('NO ve ningún estudiante', await cuenta('estudiantes') === 0);
  ok('NO ve las solicitudes', await cuenta('solicitudes') === 0);
  ok('NO ve participantes ni certificados, ni por la vista',
    await cuenta('participantes') === 0 && await cuenta('certificados') === 0 && await cuenta('certificados_detalle') === 0);
  ok('sí ve los dictados (sin datos personales)', await cuenta('dictados') === 1);
  ok('no puede registrar una emisión', await falla(`select registrar_emision(array['CER-0001'])`));
  ok('NO ve perfiles ni auditoría', await cuenta('perfiles') === 0 && await cuenta('auditoria') === 0);
  await db.query(`insert into solicitudes (tipo, titulo, correo) values ('oferente', 'Empresa nueva', 'a@b.com')`);
  ok('puede enviar una solicitud (queda pendiente)', true);
  ok('no puede enviarla ya aprobada',
    await falla(`insert into solicitudes (tipo, titulo, estado) values ('oferente', 'Trampa', 'Aprobada')`));
  ok('no puede marcarla como ejemplo',
    await falla(`insert into solicitudes (tipo, titulo, ejemplo) values ('oferente', 'Trampa', true)`));
  const r = await db.query(`update oferentes set cupos_disponibles = 999 returning id`);
  ok('no puede modificar oferentes', r.rows.length === 0);
  ok('no puede borrar documentos', (await db.query(`delete from documentos returning id`)).rows.length === 0);
  ok('no puede agregar especialidades', await falla(`insert into especialidades (nombre) values ('Trampa')`));
  ok('no puede darse rol de admin', (await db.query(`update perfiles set rol = 'admin' returning id`)).rows.length === 0);
  const antes = (await db.query(`select descargas from documentos where id = 'DOC-TUC-001'`)).rows[0].descargas;
  await db.query(`select contar_descarga('DOC-TUC-001')`);
  ok('sí puede contar una descarga',
    (await db.query(`select descargas from documentos where id = 'DOC-TUC-001'`)).rows[0].descargas === antes + 1);
});
ok('la solicitud anónima recibió el número siguiente (SOL-TUC-102)',
  (await db.query(`select id from solicitudes where titulo = 'Empresa nueva'`)).rows[0]?.id === 'SOL-TUC-102');

console.log('\nUsuario con sesión pero sin rol asignado');
await como('logueado', async () => {
  ok('ve su propio perfil y ninguno más', await cuenta('perfiles') === 1);
  ok('NO ve estudiantes', await cuenta('estudiantes') === 0);
  ok('no puede cambiarse el rol', (await db.query(`update perfiles set rol = 'admin' returning id`)).rows.length === 0);
});

console.log('\nEscuela');
await como('escuela', async () => {
  ok('no ve estudiantes de otras escuelas (los de ejemplo)', await cuenta('estudiantes') === 0);
  await db.query(`insert into estudiantes (dni, nombre, escuela) values ('47.000.001', 'Practicante Propio', $1)`,
    [escuelaPrueba.nombre]);
  ok('carga un practicante de su escuela', await cuenta('estudiantes') === 1);
  ok('no puede cargarlo en otra escuela',
    await falla(`insert into estudiantes (dni, nombre, escuela) values ('47.000.002', 'Ajeno', 'Otra escuela')`));
  ok('el mismo DNI no se carga dos veces',
    await falla(`insert into estudiantes (dni, nombre, escuela) values ('47000001', 'Repetido', $1)`, [escuelaPrueba.nombre]));
  ok('no ve la bandeja de solicitudes', await cuenta('solicitudes') === 0);
  ok('NO ve certificados (por ahora solo la DETyFP)', await cuenta('certificados_detalle') === 0);
  ok('no puede cargar estudiantes ni certificados',
    await falla(`insert into participantes (apellido, nombre) values ('Intruso', 'Uno')`) &&
    await falla(`insert into certificados (participante_id, dictado_id, horas) values ('PAR-0001', 'DIC-001', 99)`) &&
    await falla(`insert into dictados (capacitacion_id, escuela_id) values ('CAP-90', 'ESC-01')`));
  ok('no puede registrar una emisión', await falla(`select registrar_emision(array['CER-0001'])`));
});

console.log('\nEmpresa');
await como('empresa', async () => {
  const propia = await db.query(
    `update oferentes set cupos_disponibles = 9, convenio_vigente = false, estado = 'activo'
     where id = 'OFER-TUC-001' returning cupos_disponibles, convenio_vigente`);
  ok('actualiza los cupos de su ficha', propia.rows[0]?.cupos_disponibles === 9);
  ok('pero no puede tocar su convenio', propia.rows[0]?.convenio_vigente === true);
  ok('no modifica la ficha de otra empresa',
    (await db.query(`update oferentes set cupos_disponibles = 0 where id = 'OFER-TUC-002' returning id`)).rows.length === 0);
  ok('NO ve estudiantes', await cuenta('estudiantes') === 0);
});

console.log('\nAdministrador (DETyFP)');
await como('admin', async () => {
  ok('ve toda la nómina', await cuenta('estudiantes') === datos('estudiantes.json').length + 1);
  ok('ve la bandeja', await cuenta('solicitudes') === datos('solicitudes.json').length + 1);
  const r = await db.query(`update solicitudes set estado = 'Aprobada', fecha_cierre = current_date,
    resuelta_por = 'Administrador Provincial' where id = 'SOL-TUC-102' returning estado`);
  ok('resuelve una solicitud', r.rows[0]?.estado === 'Aprobada');
  await db.query(`insert into especialidades (nombre) values ('Especialidad de prueba')`);
  ok('gestiona el catálogo de especialidades', await cuenta('especialidades') === 15);
  await db.query(`update oferentes set convenio_vigente = false where id = 'OFER-TUC-003'`);
  ok('valida o da de baja un convenio',
    (await db.query(`select convenio_vigente from oferentes where id = 'OFER-TUC-003'`)).rows[0].convenio_vigente === false);
  await db.query(`update perfiles set nombre = 'Docente de prueba' where id = $1`, [USUARIOS.logueado]);
  ok('administra perfiles', await cuenta('perfiles') === 4);
  ok('lee la auditoría', await cuenta('auditoria') > 0);
  ok('ve los certificados con todo lo que va en el diploma',
    (await db.query(`select apellido, capacitacion, escuela from certificados_detalle where id = 'CER-0001'`)).rows[0]?.capacitacion === 'Charla de prueba');
  ok('registrar la emisión cuenta la descarga y los pasa a impreso',
    (await db.query(`select registrar_emision(array['CER-0001','CER-0002']) n`)).rows[0].n === 2 &&
    (await db.query(`select count(*)::int n from certificados where estado = 'impreso' and descargas = 1 and impreso_en is not null`)).rows[0].n === 2);
  await db.query(`update certificados set estado = 'anulado' where id = 'CER-0002'`);
  await db.query(`insert into dictados (capacitacion_id, escuela_id, fecha) values ('CAP-90', 'ESC-03', '2026-10-20')`);
  const nuevo = (await db.query(`insert into participantes (dni, apellido, nombre, escuela_id)
    values ('50000001', 'Carga', 'Manual', 'ESC-03') returning id`)).rows[0].id;
  await db.query(`insert into certificados (participante_id, dictado_id, curso, especialidad, horas)
    select $1, id, '6° 1°', 'Informática', 10 from dictados where escuela_id = 'ESC-03'`, [nuevo]);
  ok('carga a mano una charla, un estudiante de 6.° y su certificado',
    (await db.query(`select count(*)::int n from certificados_detalle where dni = '50000001' and curso = '6° 1°'`)).rows[0].n === 1);
  ok('el catálogo público suma la escuela nueva',
    (await db.query(`select escuelas_participantes e from capacitaciones where id = 'CAP-90'`)).rows[0].e === 2);
  ok('quita un certificado cargado por error',
    (await db.query(`delete from certificados where participante_id = $1 returning id`, [nuevo])).rows.length === 1);
  ok('un certificado anulado no se vuelve a emitir',
    (await db.query(`select registrar_emision(array['CER-0002']) n`)).rows[0].n === 0);
  await db.query(`insert into documentos (titulo) values ('Documento nuevo')`);
  ok('los identificadores siguen la numeración de los datos',
    (await db.query(`select id from documentos where titulo = 'Documento nuevo'`)).rows[0].id ===
    `DOC-TUC-${String(datos('documentos.json').length + 1).padStart(3, '0')}`);
});

console.log('\nAuditoría');
const registro = await db.query(`select * from auditoria where tabla = 'oferentes' and registro = 'OFER-TUC-001'
  and accion = 'UPDATE' order by id desc limit 1`);
ok('el cambio de la empresa quedó con autor y solo los campos cambiados',
  registro.rows[0]?.autor === USUARIOS.empresa &&
  Object.keys(registro.rows[0].cambios).join() === 'cupos_disponibles');
ok('la descarga anónima quedó registrada',
  (await db.query(`select count(*)::int n from auditoria where tabla = 'documentos' and registro = 'DOC-TUC-001'
    and accion = 'UPDATE' and autor is null`)).rows[0].n === 1);
ok('la emisión de certificados quedó con su autor',
  (await db.query(`select autor from auditoria where tabla = 'certificados' and registro = 'CER-0001'
    and accion = 'UPDATE' order by id desc limit 1`)).rows[0]?.autor === USUARIOS.admin);
ok('la resolución de la solicitud, con su autor',
  (await db.query(`select autor from auditoria where registro = 'SOL-TUC-102' and accion = 'UPDATE'`)).rows[0]?.autor === USUARIOS.admin);

await db.close();
console.log(fallas === 0 ? '\nTodo en orden.\n' : `\n${fallas} prueba(s) con falla.\n`);
process.exit(fallas === 0 ? 0 : 1);
