-- ============================================================================
-- Migración 004 — participantes de capacitaciones y certificados
--
-- Modelo:
--   capacitaciones (ya existe)  el tema: título, horas, organismo.
--   dictados                    cada vez que una capacitación se dio en una
--                               escuela: fecha y disertantes.
--   participantes               la persona (estudiante) que asistió.
--   certificados                une participante y dictado; es lo que se
--                               imprime. Lleva un código único de verificación.
--
-- Permisos: participantes y certificados son datos de menores de edad y por
-- ahora solo los ve y gestiona el administrador DETyFP. Los dictados no tienen
-- datos personales y son de lectura pública, igual que las capacitaciones.
-- ============================================================================

-- ----------------------------------------------------------------- dictados

create sequence public.dictados_seq;
create table public.dictados (
  id              text primary key default ('DIC-' || lpad(nextval('public.dictados_seq')::text, 3, '0')),
  capacitacion_id text not null references public.capacitaciones (id) on update cascade,
  escuela_id      text not null references public.escuelas (id) on update cascade,
  fecha           date,
  disertantes     text,
  observaciones   text,
  actualizado     timestamptz not null default now()
);
create index dictados_capacitacion on public.dictados (capacitacion_id);
create index dictados_escuela on public.dictados (escuela_id);

-- ------------------------------------------------------------ participantes

create sequence public.participantes_seq;
create table public.participantes (
  id            text primary key default ('PAR-' || lpad(nextval('public.participantes_seq')::text, 4, '0')),
  dni           text check (dni ~ '^\d{7,8}$'),
  apellido      text not null,
  nombre        text not null,
  escuela_id    text references public.escuelas (id) on update cascade,
  revisar       boolean not null default false,  -- dato dudoso: no emitir hasta corregir
  observaciones text,
  actualizado   timestamptz not null default now(),
  busqueda      text generated always as (
    public.normalizar(apellido || ' ' || nombre || ' ' || coalesce(dni, ''))
  ) stored
);
create unique index participantes_dni on public.participantes (dni) where dni is not null;
create index participantes_escuela on public.participantes (escuela_id);

-- ------------------------------------------------------------- certificados

create sequence public.certificados_seq;
create table public.certificados (
  id              text primary key default ('CER-' || lpad(nextval('public.certificados_seq')::text, 4, '0')),
  participante_id text not null references public.participantes (id) on update cascade on delete restrict,
  dictado_id      text not null references public.dictados (id) on update cascade on delete restrict,
  curso           text,
  especialidad    text,
  horas           integer not null check (horas > 0),
  codigo          text not null unique
                  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'impreso', 'anulado')),
  impreso_en      timestamptz,
  descargas       integer not null default 0,
  ultima_descarga timestamptz,
  fuente          text,   -- de dónde salió el dato (planilla, hoja, fila)
  actualizado     timestamptz not null default now(),
  unique (participante_id, dictado_id)
);
create index certificados_dictado on public.certificados (dictado_id);
create index certificados_estado on public.certificados (estado);

-- ------------------------------------------------- disparadores (como en 001)

do $$
declare t text;
begin
  foreach t in array array['dictados', 'participantes', 'certificados'] loop
    execute format('create trigger tocar before update on public.%I
                    for each row execute function public.tocar_actualizado()', t);
    execute format('create trigger auditar after insert or update or delete on public.%I
                    for each row execute function public.auditar()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ permisos

alter table public.dictados      enable row level security;
alter table public.participantes enable row level security;
alter table public.certificados  enable row level security;

create policy lectura_publica on public.dictados for select using (true);
create policy gestion_admin on public.dictados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy participantes_admin on public.participantes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy certificados_admin on public.certificados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- -------------------------------------------- registro de emisión (descarga)
-- El portal la llama cada vez que genera PDFs. Cuenta la descarga, marca el
-- certificado como impreso y deja constancia en la auditoría. Solo admin.

create or replace function public.registrar_emision(ids text[])
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede emitir certificados';
  end if;
  update public.certificados
     set descargas = descargas + 1,
         ultima_descarga = now(),
         estado = case when estado = 'pendiente' then 'impreso' else estado end,
         impreso_en = coalesce(impreso_en, now())
   where id = any (ids) and estado <> 'anulado';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.registrar_emision(text[]) from public, anon;
grant execute on function public.registrar_emision(text[]) to authenticated;

-- ----------------------------------------------------- vista para el panel
-- Una fila por certificado con todo lo que va en el diploma. Respeta los
-- permisos de las tablas de base (security_invoker).

create view public.certificados_detalle with (security_invoker = on) as
select c.id, c.codigo, c.estado, c.horas, c.curso, c.especialidad,
       c.descargas, c.ultima_descarga, c.impreso_en,
       p.id as participante_id, p.apellido, p.nombre, p.dni, p.revisar,
       p.observaciones as observaciones_participante,
       d.id as dictado_id, d.fecha, d.disertantes,
       k.id as capacitacion_id, k.titulo as capacitacion,
       e.id as escuela_id, e.nombre as escuela, e.localidad
  from public.certificados c
  join public.participantes p on p.id = c.participante_id
  join public.dictados d      on d.id = c.dictado_id
  join public.capacitaciones k on k.id = d.capacitacion_id
  join public.escuelas e      on e.id = d.escuela_id;
