-- ============================================================================
-- Migración 003 — ajustes recomendados por el asesor de seguridad de Supabase
--
-- 1. search_path fijo en las funciones: evita que alguien con permiso para
--    crear objetos "intercepte" una función reemplazando lo que llama.
-- 2. Las funciones que solo deben correr como disparadores (auditar,
--    crear_perfil) dejan de poder llamarse desde la API pública. Los
--    disparadores siguen funcionando: Postgres no revisa ese permiso al
--    dispararlos.
--
-- Se mantienen públicas, a propósito:
--   rol_actual()       las políticas RLS la evalúan con el rol de quien pide;
--                      solo devuelve el rol de esa misma persona.
--   contar_descarga()  un visitante puede contar una descarga.
-- ============================================================================

alter function public.normalizar(text)    set search_path = '';
alter function public.tocar_actualizado() set search_path = '';
alter function public.es_admin()          set search_path = public;
alter function public.proteger_convenio() set search_path = public;

revoke execute on function public.auditar()      from public, anon, authenticated;
revoke execute on function public.crear_perfil() from public, anon, authenticated;
