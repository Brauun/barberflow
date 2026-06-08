drop policy if exists "user_avatars_select_empresa_ou_proprio" on storage.objects;
create policy "user_avatars_select_empresa_ou_proprio"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = 'usuarios'
  and (
    exists (
      select 1
      from public.usuarios u
      where u.id = ((storage.foldername(name))[2])::uuid
        and (
          u.auth_user_id = auth.uid()
          or public.belongs_to_empresa(u.empresa_id)
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = ((storage.foldername(name))[2])::uuid
        and p.auth_user_id = auth.uid()
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
  and (
    exists (
      select 1
      from public.usuarios u
      where u.id = ((storage.foldername(name))[2])::uuid
        and (
          u.auth_user_id = auth.uid()
          or public.has_empresa_role(u.empresa_id, array['administrador'])
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = ((storage.foldername(name))[2])::uuid
        and p.auth_user_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = 'usuarios'
  and (
    exists (
      select 1
      from public.usuarios u
      where u.id = ((storage.foldername(name))[2])::uuid
        and (
          u.auth_user_id = auth.uid()
          or public.has_empresa_role(u.empresa_id, array['administrador'])
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = ((storage.foldername(name))[2])::uuid
        and p.auth_user_id = auth.uid()
    )
  )
);
