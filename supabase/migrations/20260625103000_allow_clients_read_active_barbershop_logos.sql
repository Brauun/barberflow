update public.barbershops b
set logo_url = e.logo_url
from public.empresas e
where b.empresa_id = e.id
  and b.logo_url is null
  and e.logo_url is not null;

drop policy if exists "company_assets_select_active_barbershop" on storage.objects;
create policy "company_assets_select_active_barbershop"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'empresas'
  and exists (
    select 1
    from public.barbershops b
    where b.empresa_id = ((storage.foldername(name))[2])::uuid
      and b.status = 'ativa'
  )
);

notify pgrst, 'reload schema';
