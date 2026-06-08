alter table public.usuarios
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists avatar_url text;

alter table public.employees
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company_assets_select_mesma_empresa" on storage.objects;
create policy "company_assets_select_mesma_empresa"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and ((storage.foldername(name))[2])::uuid = any(public.current_empresa_ids())
);

drop policy if exists "company_assets_manage_admin_gerente" on storage.objects;
create policy "company_assets_manage_admin_gerente"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and public.has_empresa_role(((storage.foldername(name))[2])::uuid, array['administrador', 'gerente'])
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and public.has_empresa_role(((storage.foldername(name))[2])::uuid, array['administrador', 'gerente'])
);

drop policy if exists "user_avatars_select_empresa_ou_proprio" on storage.objects;
create policy "user_avatars_select_empresa_ou_proprio"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = 'usuarios'
  and exists (
    select 1
    from public.usuarios u
    where u.id = ((storage.foldername(name))[2])::uuid
      and (
        u.auth_user_id = auth.uid()
        or public.belongs_to_empresa(u.empresa_id)
      )
  )
);

drop policy if exists "user_avatars_manage_proprio_ou_admin" on storage.objects;
create policy "user_avatars_manage_proprio_ou_admin"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = 'usuarios'
  and exists (
    select 1
    from public.usuarios u
    where u.id = ((storage.foldername(name))[2])::uuid
      and (
        u.auth_user_id = auth.uid()
        or public.has_empresa_role(u.empresa_id, array['administrador'])
      )
  )
)
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = 'usuarios'
  and exists (
    select 1
    from public.usuarios u
    where u.id = ((storage.foldername(name))[2])::uuid
      and (
        u.auth_user_id = auth.uid()
        or public.has_empresa_role(u.empresa_id, array['administrador'])
      )
  )
);
