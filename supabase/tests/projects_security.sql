-- LOCAL embedded/disposable full-stack audit suite; NOT unchanged hosted SQL Editor SQL.
-- Writes Storage metadata and tests SQL DELETE: managed Storage guards/triggers differ.
-- Do not disable hosted guards or use storage.allow_delete_query to run this suite.
-- Use projects.sql for hosted DB authorization and Storage API checks separately.
-- Disposable staging/local database only, after both migrations. All fixtures roll back.
begin;
insert into auth.users(id,email) values
 ('60000000-0000-4000-8000-000000000001','project-admin@example.invalid'),
 ('60000000-0000-4000-8000-000000000002','project-editor@example.invalid'),
 ('60000000-0000-4000-8000-000000000003','project-outsider@example.invalid'),
 ('60000000-0000-4000-8000-000000000004','project-inactive@example.invalid');
insert into public.admin_users(user_id,role,active) values
 ('60000000-0000-4000-8000-000000000001','admin',true),
 ('60000000-0000-4000-8000-000000000002','editor',true),
 ('60000000-0000-4000-8000-000000000004','admin',false);
insert into public.projects(id,slug,category,title_hy,title_en,title_ru,description_hy,description_en,description_ru,long_description_hy,long_description_en,long_description_ru) values
 ('70000000-0000-4000-8000-000000000001','rls-published-test','construction','Test','Test','Test','Test','Test','Test','Test','Test','Test'),
 ('70000000-0000-4000-8000-000000000002','rls-draft-test','design','Draft','','','','','','','','');
insert into public.project_images(id,project_id,storage_path,mime_type,byte_size,created_by) values
 ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001'),
 ('80000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002/80000000-0000-4000-8000-000000000002.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001'),
 ('80000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001');
update public.projects set cover_image_id='80000000-0000-4000-8000-000000000001',gallery_image_ids=array['80000000-0000-4000-8000-000000000001'::uuid],status='published' where slug='rls-published-test';
-- Storage metadata fixtures test policies, not actual file bytes/signing endpoints.
insert into storage.objects(bucket_id,name) select 'project-images',storage_path from public.project_images where project_id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002');

do $$ declare signature text; role_name text; begin
 foreach signature in array array['private.validate_project()','private.queue_project_file()','private.sync_project_gallery()','private.validate_image_actor()','private.immutable_project_image()'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if pg_catalog.has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Unexpected trigger EXECUTE: % %',role_name,signature; end if;
  end loop;
 end loop;
 if pg_catalog.has_function_privilege('anon','public.discard_project_image(uuid)','EXECUTE') then raise exception 'Anon discard EXECUTE'; end if;
 if pg_catalog.has_table_privilege('authenticated','public.project_storage_cleanup','SELECT') or pg_catalog.has_table_privilege('authenticated','public.project_gallery_links','INSERT') or pg_catalog.has_table_privilege('service_role','public.project_gallery_links','DELETE') then raise exception 'Internal table ACL leak'; end if;
 if pg_catalog.has_column_privilege('authenticated','public.projects','created_by','UPDATE') or pg_catalog.has_table_privilege('authenticated','public.projects','TRUNCATE') then raise exception 'System-column/TRUNCATE grant leak'; end if;
 if private.valid_features(null::text[]) or private.valid_features(array[['a','b'],['c','d']]) or private.valid_features('[0:0]={a}'::text[]) then raise exception 'Invalid feature shape accepted'; end if;
 begin update public.projects set features_hy=array[['a','b'],['c','d']] where slug='rls-draft-test'; raise exception '2D features accepted'; exception when check_violation then null; end;
 begin update public.projects set gallery_image_ids=array[['80000000-0000-4000-8000-000000000001'::uuid,'80000000-0000-4000-8000-000000000003'::uuid]] where slug='rls-published-test'; raise exception '2D gallery accepted'; exception when check_violation then null; end;
 begin update public.projects set gallery_image_ids='[0:0]={80000000-0000-4000-8000-000000000001}'::uuid[] where slug='rls-published-test'; raise exception 'Nonstandard gallery bounds accepted'; exception when check_violation then null; end;
end $$;
-- Reject mismatched file identity/format and re-registration of queued paths.
do $$ begin
 begin
  insert into public.project_images(id,project_id,storage_path,mime_type,byte_size,created_by)
  values('80000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000009.png','image/jpeg',100,'60000000-0000-4000-8000-000000000001');
  raise exception 'MIME/path mismatch accepted';
 exception when check_violation then null; end;
 insert into public.project_storage_cleanup(storage_path,project_id)
 values('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000009.jpg','70000000-0000-4000-8000-000000000001');
 begin
  insert into public.project_images(id,project_id,storage_path,mime_type,byte_size,created_by)
  values('80000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000009.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001');
  raise exception 'Queued path registered';
 exception when check_violation then null; end;
 delete from public.project_storage_cleanup where storage_path='70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000009.jpg';
end $$;
-- Prove foreign keys work independently of the validation trigger.
alter table public.projects disable trigger validate_project;
do $$ begin
 begin update public.projects set cover_image_id='80000000-0000-4000-8000-000000000002' where slug='rls-published-test'; raise exception 'Cross-project cover FK missing'; exception when foreign_key_violation then null; end;
 begin update public.projects set gallery_image_ids=array['80000000-0000-4000-8000-000000000002'::uuid] where slug='rls-published-test'; raise exception 'Cross-project gallery FK missing'; exception when foreign_key_violation then null; end;
end $$;
alter table public.projects enable trigger validate_project;
update public.projects set gallery_image_ids=array['80000000-0000-4000-8000-000000000001'::uuid,'80000000-0000-4000-8000-000000000003'::uuid] where slug='rls-published-test';
do $$ begin
 if (select array_agg(image_id order by position) from public.project_gallery_links where project_id='70000000-0000-4000-8000-000000000001') is distinct from (select gallery_image_ids from public.projects where slug='rls-published-test') then raise exception 'Gallery mirror/order mismatch'; end if;
end $$;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin delete from public.project_images where id='80000000-0000-4000-8000-000000000003'; raise exception 'Used gallery image deleted'; exception when foreign_key_violation or restrict_violation then null; end;
 begin update public.project_images set byte_size=byte_size+1 where id='80000000-0000-4000-8000-000000000003'; raise exception 'Registry can be rewritten'; exception when check_violation then null; end;
 begin delete from public.project_gallery_links; raise exception 'Backend can bypass gallery mirror'; exception when insufficient_privilege then null; end;
 update public.projects set title_en='Backend update' where slug='rls-published-test';
end $$;
reset role;
-- Existing broad permissive policies must not bypass our restrictive bucket policies.
create policy audit_broad_storage on storage.objects for all to anon,authenticated using(true) with check(true);
insert into storage.buckets(id,name,public) values('audit-other','audit-other',false);
insert into storage.objects(bucket_id,name) values('audit-other','other.jpg');
insert into public.project_images(id,project_id,storage_path,mime_type,byte_size,created_by) values
 ('80000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000004.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001');
insert into storage.objects(bucket_id,name) values('project-images','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000004.jpg');
set local role anon;
do $$ declare affected integer; begin
 if (select count(*) from storage.objects where bucket_id='project-images' and name like '70000000-%')<>2 then raise exception 'Broad policy leaks private files'; end if;
 if (select count(*) from storage.objects where bucket_id='audit-other')<>1 then raise exception 'Other bucket affected'; end if;
 begin insert into storage.objects(bucket_id,name) values('project-images','forged.jpg'); raise exception 'Project insert allowed'; exception when insufficient_privilege then null; end;
 update storage.objects set name='changed.jpg' where bucket_id='project-images'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Project overwrite allowed'; end if;
 delete from storage.objects where bucket_id='project-images'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Project delete allowed'; end if;
 begin insert into storage.objects(bucket_id,name) values('project-images','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg') on conflict(bucket_id,name) do update set name=excluded.name; raise exception 'Project upsert allowed'; exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values('audit-other','allowed-by-other-policy.jpg');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from storage.objects where bucket_id='project-images' and name like '70000000-%')<>2 then raise exception 'Nonstaff broad-policy read leak'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Nonstaff discard allowed'; exception when insufficient_privilege then null; end;
 begin execute 'create function private.attacker() returns boolean language sql as ''select true'''; raise exception 'Private schema CREATE allowed'; exception when insufficient_privilege then null; end;
 create temp table audit_forged(storage_path text,project_id uuid);
 begin execute 'create trigger audit_forged_queue after delete on audit_forged for each row execute function private.queue_project_file()'; raise exception 'Client attached privileged trigger'; exception when insufficient_privilege then null; end;
end $$;
-- Broad policies cannot authorize writes even for active staff; revocation
-- must remove draft visibility immediately without waiting for JWT expiration.
do $$ declare actor text; affected integer; begin
 foreach actor in array array['60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000004'] loop
  perform set_config('request.jwt.claim.sub',actor,true);
  if (select count(*) from storage.objects where bucket_id='project-images' and name like '70000000-%') <> (case when actor='60000000-0000-4000-8000-000000000004' then 2 else 4 end) then raise exception 'Staff/inactive Storage visibility mismatch'; end if;
  begin insert into storage.objects(bucket_id,name) values('project-images','staff-forged.jpg'); raise exception 'Staff direct upload accepted'; exception when insufficient_privilege then null; end;
  update storage.objects set name='staff-overwrite.jpg' where bucket_id='project-images'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Staff direct overwrite accepted'; end if;
  delete from storage.objects where bucket_id='project-images'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Staff direct deletion accepted'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Inactive discard accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Existing restrictive rules combine with AND and can block legitimate reads.
create policy audit_existing_restriction on storage.objects as restrictive for select to authenticated using(bucket_id<>'project-images');
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='project-images') then raise exception 'Existing restrictive policy bypassed'; end if;
end $$;
reset role;
drop policy audit_existing_restriction on storage.objects;
-- Membership revocation takes effect on the next statement with the same JWT.
update public.admin_users set active=false where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if (select count(*) from storage.objects where bucket_id='project-images' and name like '70000000-%')<>2 then raise exception 'Revoked staff retains draft Storage access'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Revoked staff discard accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.admin_users set active=true where user_id='60000000-0000-4000-8000-000000000001';
-- A future accidental EXECUTE grant is also defeated by relation/context binding.
grant execute on function private.queue_project_file() to authenticated;
set local role authenticated;
create trigger audit_forged_queue after delete on audit_forged for each row execute function private.queue_project_file();
insert into audit_forged values('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000004.jpg','70000000-0000-4000-8000-000000000001');
do $$ begin
 begin delete from audit_forged; raise exception 'Forged queue job accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
revoke execute on function private.queue_project_file() from authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
insert into public.projects(slug,category,title_hy) values('audit-author-test','construction','Author test');
reset role;
-- ON DELETE SET NULL must remain valid despite immutable metadata safeguards.
delete from auth.users where id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002');
do $$ begin
 if exists(select 1 from public.projects where slug='audit-author-test' and created_by is not null) then raise exception 'Project attribution not cleared'; end if;
 if exists(select 1 from public.project_images where project_id='70000000-0000-4000-8000-000000000001' and created_by is not null) then raise exception 'Image attribution not cleared'; end if;
end $$;
delete from public.projects where slug='rls-published-test';
do $$ begin
 if exists(select 1 from public.project_gallery_links where project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Gallery links survived deletion'; end if;
 if (select count(*) from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001')<>3 then raise exception 'Cleanup jobs lost during cascade'; end if;
end $$;
rollback;
