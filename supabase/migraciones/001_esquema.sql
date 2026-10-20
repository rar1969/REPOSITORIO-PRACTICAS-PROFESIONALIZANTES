-- ============================================================================
-- Portal de Prácticas Profesionalizantes · DETyFP Tucumán
-- Migración 001 — esquema, permisos por rol y auditoría
--
-- Se ejecuta una sola vez, en el editor SQL de Supabase, sobre un proyecto
-- nuevo. Las tablas espejan los archivos de data/*.json campo por campo: por
-- eso ningún módulo del portal cambia al pasar del adaptador estático a este.
--
-- La seguridad vive acá, no en el navegador (SDD §9). El portal oculta el
-- panel a quien no es administrador, pero quien decide qué se puede leer o
-- escribir es la base, con Row Level Security: aunque alguien arme a mano un
-- pedido con la clave pública, no lee un solo estudiante sin el rol que
-- corresponde.
-- ============================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- utilidades

-- Minúsculas y sin tildes: "Famailla" encuentra "Famaillá". Envoltorio
-- inmutable de unaccent para poder usarlo en columnas generadas.
create or replace function public.normalizar(texto text)
returns text language sql immutable parallel safe as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))
$$;

create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

-- ---------------------------------------------------------------- catálogos

create table public.departamentos (
  nombre text primary key
);

create table public.especialidades (
  nombre     text primary key,
  resolucion text
);

-- ------------------------------------------------------------------ escuelas
-- Fuente de verdad: data/escuelas.csv. Se vuelca acá con
-- herramientas/semillas-sql.mjs; no editar a mano en el panel de Supabase.

create sequence public.escuelas_seq;
create table public.escuelas (
  id          text primary key default ('ESC-' || lpad(nextval('public.escuelas_seq')::text, 2, '0')),
  cue         text,
  nombre      text not null,
  tipo        text check (tipo in ('tecnica', 'agrotecnica')),
  localidad   text,
  municipio   text,
  departamento text references public.departamentos (nombre),
  direccion   text,
  lat         double precision,
  lng         double precision,
  precision   text,
  fuente_datos text,
  especialidades text[] not null default '{}',
  alumnos_por_especialidad jsonb not null default '{}',
  alumnos_7mo integer,
  circuito    text,
  supervisor  text,
  director    text,
  telefono    text,
  correo      text,
  verificado  boolean not null default false,
  observaciones text,
  ejemplo     boolean not null default false,
  actualizado timestamptz not null default now(),
  busqueda    text generated always as (
    public.normalizar(nombre || ' ' || coalesce(localidad, '') || ' ' ||
                      coalesce(departamento, '') || ' ' || coalesce(direccion, ''))
  ) stored
);

-- ----------------------------------------------------------------- oferentes

create sequence public.oferentes_seq;
create table public.oferentes (
  id               text primary key default ('OFER-TUC-' || lpad(nextval('public.oferentes_seq')::text, 3, '0')),
  razon_social     text not null,
  cuit             text,
  tipo_organizacion text,
  departamento     text references public.departamentos (nombre),
  localidad        text,
  direccion        text,
  latitud          double precision,
  longitud         double precision,
  telefono         text,
  correo           text,
  sitio_web        text,
  contacto_persona text,
  especialidades   text[] not null default '{}',
  perfiles_requeridos text,
  escuelas_vinculadas text[] not null default '{}',
  convenio_vigente boolean not null default false,
  fecha_inicio     date,
  fecha_vencimiento date,
  cupos_disponibles integer not null default 0 check (cupos_disponibles >= 0),
  tipo_practica    text,
  estado           text not null default 'revision',
  observaciones    text,
  fecha_actualizacion date,
  ejemplo          boolean not null default false,
  actualizado      timestamptz not null default now(),
  busqueda         text generated always as (
    public.normalizar(razon_social || ' ' || coalesce(localidad, '') || ' ' ||
                      coalesce(departamento, '') || ' ' || coalesce(perfiles_requeridos, ''))
  ) stored
);
create index oferentes_departamento on public.oferentes (departamento);
create index oferentes_especialidades on public.oferentes using gin (especialidades);

-- --------------------------------------------- estudiantes (datos sensibles)
-- Datos personales de menores de edad. Ninguna lectura pública (ver RLS).

create sequence public.estudiantes_seq;
create table public.estudiantes (
  id           text primary key default ('ALU-' || lpad(nextval('public.estudiantes_seq')::text, 2, '0')),
  dni          text not null,
  nombre       text not null,
  escuela      text,
  especialidad text,
  curso        text,
  estado       text,
  empresa      text,
  ejemplo      boolean not null default false,
  actualizado  timestamptz not null default now(),
  busqueda     text generated always as (
    public.normalizar(nombre || ' ' || coalesce(escuela, ''))
  ) stored
);
create unique index estudiantes_dni on public.estudiantes (regexp_replace(dni, '\D', '', 'g'));

-- ------------------------------------------------------------ capacitaciones

create sequence public.capacitaciones_seq;
create table public.capacitaciones (
  id           text primary key default ('CAP-' || lpad(nextval('public.capacitaciones_seq')::text, 2, '0')),
  titulo       text not null,
  organismo    text,
  tipo         text,
  horas_certificadas integer,
  modalidad    text,
  destinatarios text,
  escuelas_participantes integer,
  participantes_inscritos integer,
  estado       text,
  fecha_inicio date,
  fecha_fin    date,
  lugar        text,
  ejemplo      boolean not null default false,
  actualizado  timestamptz not null default now(),
  busqueda     text generated always as (
    public.normalizar(titulo || ' ' || coalesce(organismo, '') || ' ' || coalesce(destinatarios, ''))
  ) stored
);

-- ---------------------------------------------------------------- documentos

create sequence public.documentos_seq;
create table public.documentos (
  id           text primary key default ('DOC-TUC-' || lpad(nextval('public.documentos_seq')::text, 3, '0')),
  titulo       text not null,
  descripcion  text,
  categoria    text,
  tipo_archivo text,
  tamanio      text,
  fecha        date,
  version      text,
  organismo    text,
  estado       text,
  descargas    integer not null default 0,
  url          text,
  nombre_archivo text,
  archivo_en_sesion boolean not null default false,
  ejemplo      boolean not null default false,
  actualizado  timestamptz not null default now(),
  busqueda     text generated always as (
    public.normalizar(titulo || ' ' || coalesce(descripcion, '') || ' ' ||
                      coalesce(categoria, '') || ' ' || coalesce(organismo, ''))
  ) stored
);

-- --------------------------------------------------------------------- casos

create sequence public.casos_seq;
create table public.casos (
  id           text primary key default ('CASO-TUC-' || lpad(nextval('public.casos_seq')::text, 3, '0')),
  titulo       text not null,
  escuela      text,
  localidad    text,
  departamento text,
  especialidad text,
  empresa      text,
  cantidad_estudiantes integer,
  duracion     text,
  problematica text,
  actividades  text,
  competencias text,
  resultados   text,
  testimonio_estudiante text,
  testimonio_empresa text,
  imagen_url   text,
  video_url    text,
  destacado    boolean not null default false,
  ejemplo      boolean not null default false,
  actualizado  timestamptz not null default now(),
  busqueda     text generated always as (
    public.normalizar(titulo || ' ' || coalesce(escuela, '') || ' ' || coalesce(empresa, '') || ' ' ||
                      coalesce(especialidad, '') || ' ' || coalesce(problematica, ''))
  ) stored
);

-- --------------------------------------------------------------- solicitudes
-- Las envía cualquiera desde los formularios públicos; las lee y resuelve
-- solo la Dirección.

create sequence public.solicitudes_seq start 101;
create table public.solicitudes (
  id           text primary key default ('SOL-TUC-' || lpad(nextval('public.solicitudes_seq')::text, 3, '0')),
  tipo         text not null check (tipo in ('oferente', 'experiencia', 'replica', 'vinculacion')),
  titulo       text not null,
  solicitante  text,
  correo       text,
  cuit         text,
  tipo_organizacion text,
  departamento text,
  especialidad text,
  empresa      text,
  cantidad_estudiantes integer,
  caso_id      text,
  oferente_id  text,
  detalles     text,
  fecha        date not null default current_date,
  estado       text not null default 'Pendiente' check (estado in ('Pendiente', 'Aprobada', 'Rechazada')),
  fecha_cierre date,
  resuelta_por text,
  ejemplo      boolean not null default false,
  actualizado  timestamptz not null default now(),
  busqueda     text generated always as (
    public.normalizar(titulo || ' ' || coalesce(solicitante, '') || ' ' || coalesce(departamento, ''))
  ) stored
);

-- ------------------------------------------------------------------- perfiles
-- Quién es cada persona que inicia sesión y con qué rol. Se crea solo, como
-- "visitante", cuando la Dirección da de alta un usuario en Supabase; el rol
-- lo cambia un administrador.

create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  correo      text,
  nombre      text,
  rol         text not null default 'visitante'
              check (rol in ('visitante', 'estudiante', 'docente', 'escuela', 'empresa', 'admin')),
  escuela_id  text references public.escuelas (id),
  oferente_id text references public.oferentes (id),
  creado      timestamptz not null default now()
);

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, correo) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Rol de quien hace el pedido. Sin sesión, "visitante".
create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select rol from public.perfiles where id = auth.uid()), 'visitante')
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$ select public.rol_actual() = 'admin' $$;

-- ----------------------------------------------------------------- auditoría
-- SDD §3: toda alta, cambio y baja queda registrada con autor y fecha.
-- Las descargas también, porque se cuentan con un UPDATE sobre documentos.

create table public.auditoria (
  id        bigint generated always as identity primary key,
  tabla     text not null,
  registro  text,
  accion    text not null,
  autor     uuid,
  fecha     timestamptz not null default now(),
  cambios   jsonb
);
create index auditoria_registro on public.auditoria (tabla, registro);

create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  cambios jsonb;
begin
  if tg_op = 'UPDATE' then
    -- Solo lo que cambió, para que el registro se pueda leer.
    select jsonb_object_agg(clave, valor) into cambios
    from jsonb_each(to_jsonb(new)) as n(clave, valor)
    where clave not in ('actualizado', 'busqueda')
      and to_jsonb(old) -> clave is distinct from valor;
    if cambios is null then return new; end if;
  else
    cambios := fila - 'busqueda';
  end if;

  insert into public.auditoria (tabla, registro, accion, autor, cambios)
  values (tg_table_name, coalesce(fila ->> 'id', fila ->> 'nombre'), tg_op, auth.uid(), cambios);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['escuelas', 'oferentes', 'estudiantes', 'capacitaciones',
                           'documentos', 'casos', 'solicitudes'] loop
    execute format('create trigger tocar before update on public.%I
                    for each row execute function public.tocar_actualizado()', t);
  end loop;
  foreach t in array array['especialidades', 'escuelas', 'oferentes', 'estudiantes',
                           'capacitaciones', 'documentos', 'casos', 'solicitudes', 'perfiles'] loop
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ===================================================== permisos (RLS, SDD §9)

alter table public.departamentos   enable row level security;
alter table public.especialidades  enable row level security;
alter table public.escuelas        enable row level security;
alter table public.oferentes       enable row level security;
alter table public.estudiantes     enable row level security;
alter table public.capacitaciones  enable row level security;
alter table public.documentos      enable row level security;
alter table public.casos           enable row level security;
alter table public.solicitudes     enable row level security;
alter table public.perfiles        enable row level security;
alter table public.auditoria       enable row level security;

-- Lectura pública y escritura de la Dirección: catálogo, mapa, repositorio,
-- casos, capacitaciones.
do $$
declare t text;
begin
  foreach t in array array['departamentos', 'especialidades', 'escuelas', 'oferentes',
                           'capacitaciones', 'documentos', 'casos'] loop
    execute format('create policy lectura_publica on public.%I for select using (true)', t);
    execute format('create policy gestion_admin on public.%I for all to authenticated
                    using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

-- Una empresa actualiza su propia ficha (cupos, perfiles, contacto)...
create policy empresa_propia on public.oferentes for update to authenticated
  using (id = (select oferente_id from public.perfiles where id = auth.uid()))
  with check (id = (select oferente_id from public.perfiles where id = auth.uid()));

-- ...pero no se valida sola el convenio: esos campos solo los cambia la Dirección.
create or replace function public.proteger_convenio()
returns trigger language plpgsql as $$
begin
  -- Desde el editor SQL (semillas, mantenimiento) el usuario es postgres y no
  -- se restringe; desde el portal, el pedido llega como anon o authenticated.
  if current_user in ('anon', 'authenticated') and not public.es_admin() then
    new.convenio_vigente  := old.convenio_vigente;
    new.fecha_inicio      := old.fecha_inicio;
    new.fecha_vencimiento := old.fecha_vencimiento;
    new.estado            := old.estado;
    new.cuit              := old.cuit;
    new.ejemplo           := old.ejemplo;
  end if;
  return new;
end $$;
create trigger proteger_convenio before update on public.oferentes
  for each row execute function public.proteger_convenio();

-- Estudiantes: la Dirección ve toda la provincia; una escuela, solo los suyos.
-- Visitantes, estudiantes, docentes y empresas: nada (hasta que exista el
-- vínculo tutor–practicante de la fase 4).
create policy estudiantes_admin on public.estudiantes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy estudiantes_escuela on public.estudiantes for all to authenticated
  using (public.rol_actual() = 'escuela' and escuela = (
    select e.nombre from public.escuelas e join public.perfiles p on p.escuela_id = e.id
    where p.id = auth.uid()))
  with check (public.rol_actual() = 'escuela' and escuela = (
    select e.nombre from public.escuelas e join public.perfiles p on p.escuela_id = e.id
    where p.id = auth.uid()));

-- Solicitudes: cualquiera envía, solo como pendiente; solo la Dirección lee.
create policy solicitudes_enviar on public.solicitudes for insert to anon, authenticated
  with check (estado = 'Pendiente' and fecha_cierre is null and resuelta_por is null
              and ejemplo = false);
create policy solicitudes_admin on public.solicitudes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada uno ve el suyo; la Dirección los ve y los cambia todos.
create policy perfil_propio on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());
create policy perfiles_admin on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy auditoria_admin on public.auditoria for select to authenticated
  using (public.es_admin());

-- Contar una descarga no requiere permiso de edición sobre el documento.
create or replace function public.contar_descarga(documento text)
returns integer language sql security definer set search_path = public as $$
  update public.documentos set descargas = descargas + 1 where id = documento
  returning descargas
$$;
revoke all on function public.contar_descarga(text) from public;
grant execute on function public.contar_descarga(text) to anon, authenticated;
