begin;
-- This unapplied migration must run as the trusted Phase 3 object owner.
-- Do not silently replace an unknown authorization helper or change its owner.
do $$
declare helper pg_catalog.pg_proc%rowtype; membership pg_catalog.pg_class%rowtype;
begin
 if pg_catalog.to_regclass('public.admin_users') is null or pg_catalog.to_regprocedure('private.has_staff_role(text[])') is null then
   raise exception 'Apply Phase 3 admin_auth before projects';
 end if;
 select * into helper from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('private.has_staff_role(text[])');
 select * into membership from pg_catalog.pg_class where oid='public.admin_users'::pg_catalog.regclass;
 if not helper.prosecdef or helper.prorettype <> 'boolean'::pg_catalog.regtype or not ('search_path=""'=any(coalesce(helper.proconfig,array[]::text[]))) then
   raise exception 'Phase 3 helper must be SECURITY DEFINER boolean with empty search_path';
 end if;
 if helper.proowner <> membership.relowner or helper.proowner <> (select oid from pg_catalog.pg_roles where rolname=current_user) or membership.relforcerowsecurity or not membership.relrowsecurity then
   raise exception 'Run as the trusted Phase 3 owner; verify helper ownership and admin_users RLS';
 end if;
 if current_user in ('anon','authenticated','service_role') or exists (select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
    or pg_catalog.pg_has_role('anon',current_user,'MEMBER') or pg_catalog.pg_has_role('authenticated',current_user,'MEMBER')
    or pg_catalog.pg_has_role('anon','service_role','MEMBER') or pg_catalog.pg_has_role('authenticated','service_role','MEMBER') then
   raise exception 'Client roles must not inherit privileged migration/server roles';
 end if;
end;
$$;
revoke create on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
revoke all on function private.has_staff_role(text[]) from public, anon, authenticated, service_role;
grant execute on function private.has_staff_role(text[]) to authenticated;
do $$ begin
 if pg_catalog.has_schema_privilege('anon','private','CREATE') or pg_catalog.has_schema_privilege('authenticated','private','CREATE') then
   raise exception 'Remove inherited client CREATE grants on private';
 end if;
end $$;
create table public.projects (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 legacy_id integer unique,
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
 category text not null check (category in ('construction','surveying','design','furniture','doorsWindows')),
 title_hy text not null check (length(trim(title_hy)) between 1 and 200),
 title_en text not null default '' check (length(title_en) <= 200),
 title_ru text not null default '' check (length(title_ru) <= 200),
 description_hy text not null default '' check (length(description_hy) <= 2000),
 description_en text not null default '' check (length(description_en) <= 2000),
 description_ru text not null default '' check (length(description_ru) <= 2000),
 long_description_hy text not null default '' check (length(long_description_hy) <= 15000),
 long_description_en text not null default '' check (length(long_description_en) <= 15000),
 long_description_ru text not null default '' check (length(long_description_ru) <= 15000),
 location_hy text not null default '' check (length(location_hy) <= 300),
 location_en text not null default '' check (length(location_en) <= 300),
 location_ru text not null default '' check (length(location_ru) <= 300),
 features_hy text[] not null default '{}', features_en text[] not null default '{}', features_ru text[] not null default '{}',
 cover_image_id uuid,
 gallery_image_ids uuid[] not null default '{}' check (cardinality(gallery_image_ids) <= 30 and (cardinality(gallery_image_ids)=0 or (array_ndims(gallery_image_ids)=1 and array_lower(gallery_image_ids,1)=1))),
 status text not null default 'draft' check (status in ('draft','published')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 published_at timestamptz, created_by uuid references auth.users(id) on delete set null
);
create index projects_public_order on public.projects(status, published_at desc);
create index projects_category on public.projects(category);
create table public.project_images (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 storage_path text unique,
 legacy_path text,
 mime_type text check (mime_type in ('image/jpeg','image/png','image/webp')),
 byte_size integer check (byte_size between 1 and 5242880),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null,
 check ((storage_path is not null and legacy_path is null and mime_type is not null and byte_size is not null)
     or (storage_path is null and legacy_path is not null and legacy_path in ('/Images/Construction.avif','/Images/Geodesy.jpeg','/Images/Furniture.jpeg','/Images/Naxagic.jpeg','/Images/DoorWindow.jpeg'))),
 check (storage_path is null or storage_path = project_id::text || '/' || id::text || case mime_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png' when 'image/webp' then '.webp' end),
 unique(project_id,id)
);
create index project_images_project on public.project_images(project_id);
alter table public.projects add constraint projects_cover_fk foreign key (id,cover_image_id) references public.project_images(project_id,id) on delete restrict;
-- Array API compatibility with actual foreign keys for gallery integrity.
-- Internal mirror: no browser access; synchronized by bound table triggers.
create table public.project_gallery_links (
 project_id uuid not null references public.projects(id) on delete cascade,
 image_id uuid not null,
 position integer not null check(position between 0 and 29),
 primary key(project_id,image_id), unique(project_id,position),
 foreign key(project_id,image_id) references public.project_images(project_id,id) on delete restrict
);
alter table public.project_gallery_links enable row level security;
revoke all on public.project_gallery_links from public, anon, authenticated, service_role;
grant select on public.project_gallery_links to service_role;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
revoke all on public.projects, public.project_images from public, anon, authenticated;
grant select on public.projects, public.project_images to anon, authenticated;
grant delete on public.projects to authenticated;
-- Staff can edit content, never system identity, authorship or timestamps.
grant insert (slug, category, status, cover_image_id, gallery_image_ids, title_hy, description_hy, long_description_hy, location_hy, features_hy, title_en, description_en, long_description_en, location_en, features_en, title_ru, description_ru, long_description_ru, location_ru, features_ru) on public.projects to authenticated;
grant update (slug, category, status, cover_image_id, gallery_image_ids, title_hy, description_hy, long_description_hy, location_hy, features_hy, title_en, description_en, long_description_en, location_en, features_en, title_ru, description_ru, long_description_ru, location_ru, features_ru) on public.projects to authenticated;
grant all on public.projects, public.project_images to service_role;
create policy "published projects" on public.projects for select to anon, authenticated using (status = 'published');
create policy "staff project read" on public.projects for select to authenticated using ((select private.has_staff_role(array['admin','editor'])));
create policy "staff project create" on public.projects for insert to authenticated with check ((select private.has_staff_role(array['admin','editor'])));
create policy "staff project edit" on public.projects for update to authenticated using ((select private.has_staff_role(array['admin','editor']))) with check ((select private.has_staff_role(array['admin','editor'])));
create policy "admin project delete" on public.projects for delete to authenticated using ((select private.has_staff_role(array['admin'])));
create policy "staff image read" on public.project_images for select to authenticated using ((select private.has_staff_role(array['admin','editor'])));
create policy "published referenced images" on public.project_images for select to anon, authenticated using (exists (
 select 1 from public.projects p where p.id = project_images.project_id and p.status = 'published' and (p.cover_image_id = project_images.id or project_images.id = any(p.gallery_image_ids))
));

create function private.valid_features(items text[]) returns boolean language sql immutable set search_path = '' as $$
 select coalesce(cardinality(items) <= 20 and (cardinality(items)=0 or (array_ndims(items)=1 and array_lower(items,1)=1)) and not exists (select 1 from unnest(items) value where value is null or length(trim(value)) not between 1 and 500),false);
$$;
create function private.validate_project() returns trigger language plpgsql set search_path = '' as $$
declare reference_id uuid;
begin
 if tg_relid <> 'public.projects'::pg_catalog.regclass or tg_level <> 'ROW' or tg_when <> 'BEFORE' or tg_op not in ('INSERT','UPDATE') then raise exception 'Invalid trigger context' using errcode='42501'; end if;
 if tg_op = 'UPDATE' then
   if new.id <> old.id or new.slug <> old.slug or new.legacy_id is distinct from old.legacy_id then raise exception 'Project identity is immutable' using errcode='23514'; end if;
   new.created_at := old.created_at;
 else
   if auth.uid() is not null then new.created_by := auth.uid(); end if;
 end if;
 if not private.valid_features(new.features_hy) or not private.valid_features(new.features_en) or not private.valid_features(new.features_ru) then raise exception 'Invalid features' using errcode='23514'; end if;
 if cardinality(new.gallery_image_ids)>0 and (array_ndims(new.gallery_image_ids)<>1 or array_lower(new.gallery_image_ids,1)<>1) then raise exception 'Invalid gallery array shape' using errcode='23514'; end if;
 if cardinality(new.gallery_image_ids) <> (select count(distinct value) from unnest(new.gallery_image_ids) value) then raise exception 'Duplicate images' using errcode='23514'; end if;
 foreach reference_id in array (new.gallery_image_ids || array[new.cover_image_id]) loop
   if reference_id is not null and not exists (select 1 from public.project_images where id = reference_id and project_id = new.id) then raise exception 'Image belongs to another project or is missing' using errcode='23514'; end if;
 end loop;
 if new.status = 'published' then
   if new.cover_image_id is null or trim(new.title_en) = '' or trim(new.title_ru) = '' or trim(new.description_hy) = '' or trim(new.description_en) = '' or trim(new.description_ru) = '' or trim(new.long_description_hy) = '' or trim(new.long_description_en) = '' or trim(new.long_description_ru) = ''
      or cardinality(new.features_hy) <> cardinality(new.features_en) or cardinality(new.features_hy) <> cardinality(new.features_ru) then
      raise exception 'Publication requires translations and cover image' using errcode='23514';
   end if;
   if tg_op = 'INSERT' or old.status <> 'published' then new.published_at := now(); else new.published_at := old.published_at; end if;
 else new.published_at := null;
 end if;
 new.updated_at := clock_timestamp();
 return new;
end;
$$;
create trigger validate_project before insert or update on public.projects for each row execute function private.validate_project();

-- Maintain FK-backed gallery links without allowing client writes to the mirror.
-- On parent delete, remove links BEFORE image cascades regardless of FK trigger order.
create function private.sync_project_gallery() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_relid <> 'public.projects'::pg_catalog.regclass or tg_level <> 'ROW'
    or not ((tg_op in ('INSERT','UPDATE') and tg_when='AFTER') or (tg_op='DELETE' and tg_when='BEFORE')) then
   raise exception 'Invalid trigger context' using errcode='42501';
 end if;
 if tg_op='DELETE' then delete from public.project_gallery_links where project_id=old.id; return old; end if;
 delete from public.project_gallery_links where project_id=new.id;
 insert into public.project_gallery_links(project_id,image_id,position)
 select new.id,value,ordinality-1 from unnest(new.gallery_image_ids) with ordinality as gallery(value,ordinality);
 return new;
end;
$$;
create trigger sync_project_gallery after insert or update of gallery_image_ids on public.projects for each row execute function private.sync_project_gallery();
create trigger remove_project_gallery before delete on public.projects for each row execute function private.sync_project_gallery();

-- Durable cleanup metadata survives project/image deletion. No browser access.
create table public.project_storage_cleanup (
 storage_path text primary key, project_id uuid not null, queued_at timestamptz not null default now(),
 check(storage_path ~ ('^' || project_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))
);
alter table public.project_storage_cleanup enable row level security;
revoke all on public.project_storage_cleanup from public, anon, authenticated;
grant all on public.project_storage_cleanup to service_role;
create function private.queue_project_file() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_relid <> 'public.project_images'::pg_catalog.regclass or tg_level <> 'ROW' or tg_when <> 'AFTER' or tg_op <> 'DELETE' then raise exception 'Invalid trigger context' using errcode='42501'; end if;
 if old.storage_path is not null then insert into public.project_storage_cleanup(storage_path,project_id) values(old.storage_path,old.project_id) on conflict do nothing; end if;
 return old;
end;
$$;
create trigger queue_project_file after delete on public.project_images for each row execute function private.queue_project_file();

-- Remove only unreferenced image records; serialize with project saves.
create function public.discard_project_image(image_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare image public.project_images%rowtype; project public.projects%rowtype;
begin
 if not private.has_staff_role(array['admin','editor']) then raise exception 'Staff access required' using errcode='42501'; end if;
 select * into image from public.project_images where id = image_id;
 if not found then return; end if;
 select * into project from public.projects where id = image.project_id for update;
 if not found or project.cover_image_id = image_id or image_id = any(project.gallery_image_ids) then raise exception 'Image is in use' using errcode='23514'; end if;
 delete from public.project_images where id = image_id;
end;
$$;
revoke all on function public.discard_project_image(uuid) from public, anon, authenticated, service_role;
grant execute on function public.discard_project_image(uuid) to authenticated;
revoke all on function private.valid_features(text[]), private.validate_project(), private.queue_project_file(), private.sync_project_gallery() from public, anon, authenticated, service_role;
grant execute on function private.valid_features(text[]) to authenticated, service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('project-images','project-images',false,5242880,array['image/jpeg','image/png','image/webp']);
-- Restrictive policies prevent a broader existing policy from bypassing this bucket.
create policy "project no direct insert" on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'project-images');
create policy "project no direct update" on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'project-images') with check (bucket_id <> 'project-images');
create policy "project no direct delete" on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'project-images');
create policy "project anon restricted read" on storage.objects as restrictive for select to anon using (
 bucket_id <> 'project-images' or exists (select 1 from public.project_images i join public.projects p on p.id=i.project_id where i.storage_path=name and p.status='published' and (p.cover_image_id=i.id or i.id=any(p.gallery_image_ids)))
);
create policy "project staff restricted read" on storage.objects as restrictive for select to authenticated using (
 bucket_id <> 'project-images' or (select private.has_staff_role(array['admin','editor'])) or exists (select 1 from public.project_images i join public.projects p on p.id=i.project_id where i.storage_path=name and p.status='published' and (p.cover_image_id=i.id or i.id=any(p.gallery_image_ids)))
);
-- No INSERT/UPDATE/DELETE permissive policy is created for this bucket.
create policy "project image staff download" on storage.objects for select to authenticated using (bucket_id = 'project-images' and (select private.has_staff_role(array['admin','editor'])));
create policy "project image published download" on storage.objects for select to anon, authenticated using (
 bucket_id = 'project-images' and exists (select 1 from public.project_images i join public.projects p on p.id=i.project_id
 where i.storage_path=name and p.status='published' and (p.cover_image_id=i.id or i.id=any(p.gallery_image_ids)))
);
create function private.validate_image_actor() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_relid <> 'public.project_images'::pg_catalog.regclass or tg_level <> 'ROW' or tg_when <> 'BEFORE' or tg_op <> 'INSERT' then raise exception 'Invalid trigger context' using errcode='42501'; end if;
 if new.storage_path is not null and exists(select 1 from public.project_storage_cleanup where storage_path=new.storage_path) then raise exception 'Path is pending cleanup' using errcode='23514'; end if;
 if new.storage_path is not null and not exists (select 1 from public.admin_users where user_id=new.created_by and active and role in ('admin','editor')) then raise exception 'Staff access required' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function private.validate_image_actor() from public, anon, authenticated, service_role;
create trigger validate_image_actor before insert on public.project_images for each row execute function private.validate_image_actor();
-- Registry paths cannot be repointed behind existing project/cleanup references.
-- Auth user deletion may still clear attribution through ON DELETE SET NULL.
create function private.immutable_project_image() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_relid <> 'public.project_images'::pg_catalog.regclass or tg_level <> 'ROW' or tg_when <> 'BEFORE' or tg_op <> 'UPDATE' then raise exception 'Invalid trigger context' using errcode='42501'; end if;
 if new.id is distinct from old.id or new.project_id is distinct from old.project_id or new.storage_path is distinct from old.storage_path
    or new.legacy_path is distinct from old.legacy_path or new.mime_type is distinct from old.mime_type or new.byte_size is distinct from old.byte_size
    or new.created_at is distinct from old.created_at or (new.created_by is distinct from old.created_by and new.created_by is not null) then
   raise exception 'Image registry is immutable; upload a replacement' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.immutable_project_image() from public, anon, authenticated, service_role;
create trigger immutable_project_image before update on public.project_images for each row execute function private.immutable_project_image();
commit;
