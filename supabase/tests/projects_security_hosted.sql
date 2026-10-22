-- HOSTED STAGING: execute this ENTIRE file as postgres, after audited Phase 3/4.
-- Disposable staging only; review custom Auth/application triggers for external effects.
-- No Storage mutations/policy changes/API calls; Storage checks are catalog-only.
-- Temporarily disables ONE application trigger and grants ONE function EXECUTE
-- within an uncommitted transaction. Table locks can block traffic (3s lock timeout).
-- Do not run fragments, change role/claims in SQL Editor, or replace ROLLBACK.
-- On ANY error issue ROLLBACK on the SAME backend if available; pooled SQL Editor
-- requests may use different backends. Do not COMMIT or assume closing a tab cancels.
-- Post-rollback checks run in a separate READ ONLY transaction and return a PASS row.
-- HTTP timeout is not proof of cancellation; inspect backend/locks before rerunning.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- Fail closed before seeding; never overwrite existing users/content/cleanup jobs.
do $$ begin
 if current_user <> 'postgres' then raise exception 'Run hosted security suite as postgres'; end if;
 if to_regclass('pg_temp.parametr_hosted_forged') is not null then raise exception 'Hosted temp fixture collision'; end if;
 if exists(select 1 from auth.users where id in (
 '60000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000002'::uuid,
 '60000000-0000-4000-8000-000000000003'::uuid,'60000000-0000-4000-8000-000000000004'::uuid)
 or email in ('project-admin@example.invalid','project-editor@example.invalid','project-outsider@example.invalid','project-inactive@example.invalid'))
 or exists(select 1 from public.projects where id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid)
 or slug in ('rls-published-test','rls-draft-test','anonymous-test','outsider-test','editor-created-test','audit-author-test'))
 or exists(select 1 from public.project_images where id in ('80000000-0000-4000-8000-000000000001'::uuid,'80000000-0000-4000-8000-000000000002'::uuid,'80000000-0000-4000-8000-000000000003'::uuid,'80000000-0000-4000-8000-000000000004'::uuid,'80000000-0000-4000-8000-000000000009'::uuid)
 or storage_path in ('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg','70000000-0000-4000-8000-000000000002/80000000-0000-4000-8000-000000000002.jpg','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg'))
 or exists(select 1 from public.project_storage_cleanup where project_id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid))
 or exists(select 1 from storage.objects where bucket_id='project-images' and (name like '70000000-0000-4000-8000-000000000001/%' or name like '70000000-0000-4000-8000-000000000002/%')) then
  raise exception 'Project test fixture collision; use fresh disposable staging';
 end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.projects'::regclass and tgname='validate_project' and tgenabled='O') then raise exception 'Enabled validation trigger required'; end if;
 if not exists(select 1 from storage.buckets where id='project-images' and not public) then raise exception 'Private project-images bucket required'; end if;
 if not exists(select 1 from pg_catalog.pg_class where oid='storage.objects'::regclass and relrowsecurity) then raise exception 'Storage RLS disabled'; end if;
 if (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and permissive='RESTRICTIVE' and policyname in ('project no direct insert','project no direct update','project no direct delete','project anon restricted read','project staff restricted read'))<>5 then raise exception 'Audited restrictive Storage policies missing'; end if;
 if (select count(*) from pg_catalog.pg_policies p join (values
 ('project no direct insert','INSERT'),('project no direct update','UPDATE'),('project no direct delete','DELETE'),
 ('project anon restricted read','SELECT'),('project staff restricted read','SELECT')) expected(policy,command)
 on p.policyname=expected.policy and p.cmd=expected.command
 where p.schemaname='storage' and p.tablename='objects' and p.permissive='RESTRICTIVE')<>5 then raise exception 'Storage policy command drift'; end if;
end $$;
-- Clear stale SQL Editor request context before owner-run trigger execution.
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
-- Minimal policy fixtures, not login-capable Auth accounts (no credentials).
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
do $$ declare signature text; role_name text; begin
 foreach signature in array array['private.validate_project()','private.queue_project_file()','private.sync_project_gallery()','private.validate_image_actor()','private.immutable_project_image()'] loop
  foreach role_name in array array['anon','authenticated','service_role'] loop
   if pg_catalog.has_function_privilege(role_name,signature,'EXECUTE') then raise exception 'Unexpected trigger EXECUTE: % %',role_name,signature; end if;
  end loop;
 end loop;
 if pg_catalog.has_function_privilege('anon','public.discard_project_image(uuid)','EXECUTE') then raise exception 'Anon discard EXECUTE'; end if;
 if pg_catalog.has_table_privilege('authenticated','public.project_storage_cleanup','SELECT') or pg_catalog.has_table_privilege('authenticated','public.project_gallery_links','INSERT') or pg_catalog.has_table_privilege('service_role','public.project_gallery_links','DELETE') then raise exception 'Internal table ACL leak'; end if;
 if pg_catalog.has_column_privilege('authenticated','public.projects','created_by','UPDATE') or pg_catalog.has_table_privilege('authenticated','public.projects','TRUNCATE') then raise exception 'System-column/TRUNCATE grant leak'; end if;
 if private.valid_features(null::text[]) is distinct from false or private.valid_features(array[['a','b'],['c','d']]) is distinct from false or private.valid_features('[0:0]={a}'::text[]) is distinct from false then raise exception 'Invalid feature shape accepted'; end if;
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
 begin delete from public.project_gallery_links where project_id='70000000-0000-4000-8000-000000000001'; raise exception 'Backend can bypass gallery mirror'; exception when insufficient_privilege then null; end;
 update public.projects set title_en='Backend update' where slug='rls-published-test';
 if not found then raise exception 'Service update was a no-op'; end if;
end $$;
reset role;
insert into public.project_images(id,project_id,storage_path,mime_type,byte_size,created_by) values
 ('80000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000004.jpg','image/jpeg',100,'60000000-0000-4000-8000-000000000001');
-- Public application metadata remains limited to published, referenced images.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if current_user<>'anon' or auth.uid() is not null then raise exception 'Anonymous context mismatch'; end if;
 if (select count(*) from public.projects where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>1 then raise exception 'Anonymous project visibility regression'; end if;
 if (select count(*) from public.project_images where project_id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>2 then raise exception 'Anonymous referenced-image visibility regression'; end if;
end $$;
reset role;
-- Owner-created temporary table avoids assuming authenticated has TEMP privilege.
create temp table parametr_hosted_forged(storage_path text,project_id uuid);
alter table pg_temp.parametr_hosted_forged owner to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if auth.uid() is distinct from '60000000-0000-4000-8000-000000000003'::uuid or current_user<>'authenticated' then raise exception 'Nonstaff context mismatch'; end if;
 if private.has_staff_role(array['admin','editor']) then raise exception 'Metadata authorized nonstaff'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Nonstaff discard allowed'; exception when insufficient_privilege then null; end;
 if pg_catalog.has_schema_privilege(current_user,'private','CREATE') then raise exception 'Private schema CREATE allowed'; end if;
 begin execute 'create trigger hosted_forged_queue after delete on pg_temp.parametr_hosted_forged for each row execute function private.queue_project_file()'; raise exception 'Client attached privileged trigger'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- A temporary, uncommitted EXECUTE grant tests context binding; rollback restores ACLs.
grant execute on function private.queue_project_file() to authenticated;
set local role authenticated;
create trigger hosted_forged_queue after delete on pg_temp.parametr_hosted_forged for each row execute function private.queue_project_file();
insert into pg_temp.parametr_hosted_forged values('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000004.jpg','70000000-0000-4000-8000-000000000001');
do $$ begin
 begin delete from pg_temp.parametr_hosted_forged; raise exception 'Forged queue job accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
revoke execute on function private.queue_project_file() from authenticated;
-- Inactive and newly revoked staff must not read drafts or discard metadata.
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
do $$ begin
 if auth.uid() is distinct from '60000000-0000-4000-8000-000000000004'::uuid then raise exception 'Inactive context mismatch'; end if;
 if exists(select 1 from public.projects where id='70000000-0000-4000-8000-000000000002') then raise exception 'Inactive draft read allowed'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Inactive discard allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.admin_users set active=false where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if auth.uid() is distinct from '60000000-0000-4000-8000-000000000001'::uuid then raise exception 'Revoked context mismatch'; end if;
 if private.has_staff_role(array['admin']) or exists(select 1 from public.projects where id='70000000-0000-4000-8000-000000000002') then raise exception 'Revoked staff retains draft access'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000004'); raise exception 'Revoked discard allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.admin_users set active=true where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.projects(slug,category,title_hy) values('audit-author-test','construction','Author test');
reset role;
do $$ begin
 if not exists(select 1 from public.projects where slug='audit-author-test' and created_by='60000000-0000-4000-8000-000000000002') then raise exception 'Authorship trigger failed'; end if;
 if exists(select 1 from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Forged cleanup job persisted'; end if;
end $$;
-- ON DELETE SET NULL must remain valid despite immutable metadata safeguards.
delete from auth.users where id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002');
do $$ begin
 if exists(select 1 from public.projects where slug='audit-author-test' and created_by is not null) then raise exception 'Project attribution not cleared'; end if;
 if exists(select 1 from public.project_images where project_id='70000000-0000-4000-8000-000000000001' and created_by is not null) then raise exception 'Image attribution not cleared'; end if;
end $$;
delete from public.projects where slug='rls-published-test';
do $$ begin
 if exists(select 1 from public.projects where slug='rls-published-test') or exists(select 1 from public.project_images where project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Project/image cascade failed'; end if;
 if exists(select 1 from public.project_gallery_links where project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Gallery links survived deletion'; end if;
 if (select count(*) from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001')<>3 then raise exception 'Cleanup jobs lost during cascade'; end if;
end $$;
rollback;
-- Read-only post-rollback checks: run with the file, never as a selected fragment.
-- Use a separate explicitly READ ONLY transaction; no fixture writes can commit here.
begin transaction read only;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $$ begin
 if current_user<>'postgres' then raise exception 'Role was not restored'; end if;
 if exists(select 1 from auth.users where id in ('60000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000002'::uuid,'60000000-0000-4000-8000-000000000003'::uuid,'60000000-0000-4000-8000-000000000004'::uuid))
 or exists(select 1 from public.projects where slug in ('rls-published-test','rls-draft-test','audit-author-test'))
 or exists(select 1 from public.project_images where project_id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid))
 or exists(select 1 from public.project_gallery_links where project_id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid))
 or exists(select 1 from public.project_storage_cleanup where project_id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid)) then raise exception 'Fixture rollback failed'; end if;
 if to_regclass('pg_temp.parametr_hosted_forged') is not null then raise exception 'Temporary table survived rollback'; end if;
 if pg_catalog.has_function_privilege('authenticated','private.queue_project_file()','EXECUTE') then raise exception 'Temporary grant survived rollback'; end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.projects'::regclass and tgname='validate_project' and tgenabled='O') then raise exception 'Validation trigger not restored'; end if;
 raise notice 'PASS: hosted security assertions completed and fixture/DDL rollback verified';
end $$;
-- The SQL Editor may otherwise show an earlier set_config result as its last rowset.
select 'PASS: hosted security assertions completed and fixture/DDL rollback verified' as security_test_result;
rollback;
