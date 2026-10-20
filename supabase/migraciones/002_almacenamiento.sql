-- ============================================================================
-- Migración 002 — almacenamiento de archivos del repositorio documental
--
-- Un "bucket" público llamado documentos: cualquiera descarga, solo la
-- Dirección sube, reemplaza o borra. Reemplaza la "URL de sesión" del
-- adaptador estático, que se perdía al cerrar la pestaña.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', true, 20971520)   -- 20 MB por archivo
on conflict (id) do nothing;

create policy documentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.es_admin());

create policy documentos_reemplazar on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.es_admin());

create policy documentos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.es_admin());
