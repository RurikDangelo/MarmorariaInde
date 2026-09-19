-- =========================================================================
-- 0008_storage.sql - buckets do Supabase Storage e politicas de acesso
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('os-arquivos', 'os-arquivos', false, 26214400,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf',
         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('medicoes', 'medicoes', false, 26214400,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('instalacoes', 'instalacoes', false, 26214400,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('empresa', 'empresa', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/svg+xml','image/x-icon'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------------------
-- Politicas: cada bucket herda a permissao do modulo correspondente
-- -------------------------------------------------------------------------
drop policy if exists storage_os_read on storage.objects;
drop policy if exists storage_os_write on storage.objects;
drop policy if exists storage_os_update on storage.objects;
drop policy if exists storage_os_delete on storage.objects;

create policy storage_os_read on storage.objects
  for select to authenticated
  using (bucket_id = 'os-arquivos' and public.has_perm('work_orders.read'));
create policy storage_os_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'os-arquivos' and public.has_perm('work_orders.write'));
create policy storage_os_update on storage.objects
  for update to authenticated
  using (bucket_id = 'os-arquivos' and public.has_perm('work_orders.write'));
create policy storage_os_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'os-arquivos' and public.has_perm('work_orders.write'));

drop policy if exists storage_medicoes_read on storage.objects;
drop policy if exists storage_medicoes_write on storage.objects;
drop policy if exists storage_medicoes_delete on storage.objects;

create policy storage_medicoes_read on storage.objects
  for select to authenticated
  using (bucket_id = 'medicoes' and public.has_perm('measurements.read'));
create policy storage_medicoes_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medicoes' and public.has_perm('measurements.write'));
create policy storage_medicoes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'medicoes' and public.has_perm('measurements.write'));

drop policy if exists storage_instalacoes_read on storage.objects;
drop policy if exists storage_instalacoes_write on storage.objects;
drop policy if exists storage_instalacoes_delete on storage.objects;

create policy storage_instalacoes_read on storage.objects
  for select to authenticated
  using (bucket_id = 'instalacoes' and public.has_perm('installations.read'));
create policy storage_instalacoes_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'instalacoes' and public.has_perm('installations.write'));
create policy storage_instalacoes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'instalacoes' and public.has_perm('installations.write'));

-- Logo e favicon sao publicos para leitura (aparecem no login), escrita restrita.
drop policy if exists storage_empresa_read on storage.objects;
drop policy if exists storage_empresa_write on storage.objects;
drop policy if exists storage_empresa_update on storage.objects;
drop policy if exists storage_empresa_delete on storage.objects;

create policy storage_empresa_read on storage.objects
  for select using (bucket_id = 'empresa');
create policy storage_empresa_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empresa' and public.has_perm('settings.write'));
create policy storage_empresa_update on storage.objects
  for update to authenticated
  using (bucket_id = 'empresa' and public.has_perm('settings.write'));
create policy storage_empresa_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'empresa' and public.has_perm('settings.write'));
