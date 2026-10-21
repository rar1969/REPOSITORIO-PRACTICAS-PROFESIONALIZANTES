-- ============================================================================
-- Migración 005 — carga manual de certificados desde el portal
--
-- Desde el Panel DETyFP se cargan a mano charlas (dictados), estudiantes y
-- certificados, sin pasar por la planilla. Los estudiantes de 6.° año son en
-- su mayoría menores: la escuela autoriza su participación y reciben el mismo
-- certificado. Sus datos siguen protegidos por las políticas de la 004 (solo
-- el administrador los ve y los carga).
--
-- Lo que agrega esta migración: el catálogo público de capacitaciones muestra
-- cuántas escuelas e inscriptos tuvo cada una y sus fechas. Antes eran números
-- cargados a mano; ahora se recalculan solos cada vez que cambia un dictado o
-- un certificado, así no quedan desactualizados con la carga manual.
-- ============================================================================

create or replace function public.resumir_capacitacion(cap text)
returns void language sql security invoker set search_path = public as $$
  update public.capacitaciones k
     set escuelas_participantes = s.escuelas,
         participantes_inscritos = s.personas,
         fecha_inicio = coalesce(s.desde, k.fecha_inicio),
         fecha_fin    = coalesce(s.hasta, k.fecha_fin)
    from (
      select count(distinct d.escuela_id) filter (where c.id is not null) as escuelas,
             count(distinct c.participante_id) as personas,
             min(d.fecha) as desde,
             max(d.fecha) as hasta
        from public.dictados d
        left join public.certificados c on c.dictado_id = d.id and c.estado <> 'anulado'
       where d.capacitacion_id = cap
    ) s
   where k.id = cap
     and (k.escuelas_participantes, k.participantes_inscritos, k.fecha_inicio, k.fecha_fin)
         is distinct from (s.escuelas, s.personas, coalesce(s.desde, k.fecha_inicio), coalesce(s.hasta, k.fecha_fin))
$$;

create or replace function public.resumir_desde_certificado()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  perform public.resumir_capacitacion(d.capacitacion_id)
     from public.dictados d
    where d.id in (case when tg_op <> 'INSERT' then old.dictado_id end,
                   case when tg_op <> 'DELETE' then new.dictado_id end);
  return null;
end $$;

create or replace function public.resumir_desde_dictado()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.resumir_capacitacion(old.capacitacion_id); end if;
  if tg_op <> 'DELETE' then perform public.resumir_capacitacion(new.capacitacion_id); end if;
  return null;
end $$;

create trigger resumir after insert or update of dictado_id, estado or delete on public.certificados
  for each row execute function public.resumir_desde_certificado();
create trigger resumir after insert or update of capacitacion_id, fecha or delete on public.dictados
  for each row execute function public.resumir_desde_dictado();

-- Solo corren como disparadores (o las llama el administrador).
revoke execute on function public.resumir_capacitacion(text) from public, anon;
revoke execute on function public.resumir_desde_certificado() from public, anon, authenticated;
revoke execute on function public.resumir_desde_dictado() from public, anon, authenticated;

-- Puesta al día de las capacitaciones que ya tienen dictados.
select public.resumir_capacitacion(id) from public.capacitaciones
 where id in (select capacitacion_id from public.dictados);
