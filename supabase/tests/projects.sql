-- Run ENTIRE file once as postgres in SQL Editor on disposable staging after
-- audited Phase 3 + Phase 4 migrations. Never run selected statements or COMMIT.
-- Review custom auth/application triggers first: external effects may not roll back.
-- No Storage writes/API calls: Storage SQL is read-only; these are DB/RLS fixtures.
-- On any error explicitly ROLLBACK before continuing. Success ends in ROLLBACK.
begin;
-- Fail closed before seeding; never overwrite existing users/content/cleanup jobs.
do $$ begin
 if current_user <> 'postgres' then raise exception 'Run projects suite as postgres'; end if;
 if exists(select 1 from auth.users where id in (
 '60000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000002'::uuid,
 '60000000-0000-4000-8000-000000000003'::uuid,'60000000-0000-4000-8000-000000000004'::uuid)
 or email in ('project-admin@example.invalid','project-editor@example.invalid','project-outsider@example.invalid','project-inactive@example.invalid'))
 or exists(select 1 from public.projects where id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid)
 or slug in ('rls-published-test','rls-draft-test','anonymous-test','outsider-test','editor-created-test'))
 or exists(select 1 from public.project_images where id in ('80000000-0000-4000-8000-000000000001'::uuid,'80000000-0000-4000-8000-000000000002'::uuid,'80000000-0000-4000-8000-000000000003'::uuid)
 or storage_path in ('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg','70000000-0000-4000-8000-000000000002/80000000-0000-4000-8000-000000000002.jpg','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg'))
 or exists(select 1 from public.project_storage_cleanup where project_id in ('70000000-0000-4000-8000-000000000001'::uuid,'70000000-0000-4000-8000-000000000002'::uuid))
 or exists(select 1 from storage.objects where bucket_id='project-images' and name in ('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg','70000000-0000-4000-8000-000000000002/80000000-0000-4000-8000-000000000002.jpg','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg')) then
  raise exception 'Project test fixture collision; use fresh disposable staging';
 end if;
 if not exists(select 1 from storage.buckets where id='project-images' and not public) then raise exception 'Private project-images bucket required'; end if;
 if not exists(select 1 from pg_catalog.pg_class where oid='storage.objects'::regclass and relrowsecurity) then raise exception 'Storage RLS disabled'; end if;
 if (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and permissive='RESTRICTIVE' and policyname in ('project no direct insert','project no direct update','project no direct delete','project anon restricted read','project staff restricted read'))<>5 then raise exception 'Audited restrictive Storage policies missing'; end if;
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
-- Storage runtime checks live in the local-only extended suite / manual HTTP checks.

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if current_user<>'anon' or auth.uid() is not null then raise exception 'Anonymous context mismatch'; end if;
 if (select count(*) from public.projects where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>1 then raise exception 'Anonymous sees drafts'; end if;
 if (select count(*) from public.project_images where project_id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>1 then raise exception 'Anonymous sees unreferenced/draft images'; end if;
 begin insert into public.projects(slug,category,title_hy) values('anonymous-test','construction','Test'); raise exception 'Anonymous create allowed'; exception when insufficient_privilege then null; end;
 begin update public.projects set title_hy='bad' where id='70000000-0000-4000-8000-000000000001'; raise exception 'Anonymous update allowed'; exception when insufficient_privilege then null; end;
 begin delete from public.projects where id='70000000-0000-4000-8000-000000000001'; raise exception 'Anonymous delete allowed'; exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if current_user<>'authenticated' or auth.uid() is distinct from '60000000-0000-4000-8000-000000000003'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ declare affected integer; begin
 begin insert into public.projects(slug,category,title_hy) values('outsider-test','construction','Test'); raise exception 'Outsider create allowed'; exception when insufficient_privilege then null; end;
 update public.projects set title_hy='bad' where slug='rls-published-test'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Outsider update allowed'; end if;
 delete from public.projects where slug='rls-published-test'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Outsider delete allowed'; end if;
end $$;

select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if current_user<>'authenticated' or auth.uid() is distinct from '60000000-0000-4000-8000-000000000002'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ declare affected integer; begin
 if (select count(*) from public.projects where id in ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002'))<>2 then raise exception 'Editor cannot read drafts'; end if;
 insert into public.projects(slug,category,title_hy) values('editor-created-test','construction','Test');
 begin update public.projects set created_by='60000000-0000-4000-8000-000000000001' where slug='editor-created-test'; raise exception 'Editor forged authorship'; exception when insufficient_privilege then null; end;
 update public.projects set title_hy='Editor update' where slug='rls-draft-test'; get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Editor update failed'; end if;
 begin update public.projects set cover_image_id='80000000-0000-4000-8000-000000000002' where slug='rls-published-test'; raise exception 'Cross-project cover accepted'; exception when check_violation then null; end;
 begin update public.projects set status='published' where slug='rls-draft-test'; raise exception 'Incomplete publication accepted'; exception when check_violation then null; end;
 delete from public.projects where slug='rls-draft-test'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Editor delete allowed'; end if;
 begin insert into public.project_images(project_id,legacy_path) values('70000000-0000-4000-8000-000000000002','/Images/Furniture.jpeg'); raise exception 'Editor forged image registry'; exception when insufficient_privilege then null; end;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000001'); raise exception 'Referenced image deleted'; exception when check_violation then null; end;
 perform public.discard_project_image('80000000-0000-4000-8000-000000000003');
 if exists(select 1 from public.project_images where id='80000000-0000-4000-8000-000000000003') then raise exception 'Unused image discard was a no-op'; end if;
end $$;

-- Verify the discard trigger independently, before parent deletion can mask it.
reset role;
do $$ begin
 if (select count(*) from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001')<>1
 or not exists(select 1 from public.project_storage_cleanup where storage_path='70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg' and project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Unused discard did not queue exact file'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if current_user<>'authenticated' or auth.uid() is distinct from '60000000-0000-4000-8000-000000000004'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ declare affected integer; begin
 update public.projects set title_hy='bad' where slug='rls-published-test'; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Inactive staff update allowed'; end if;
 begin perform public.discard_project_image('80000000-0000-4000-8000-000000000002'); raise exception 'Inactive discard allowed'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if current_user<>'authenticated' or auth.uid() is distinct from '60000000-0000-4000-8000-000000000001'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ declare affected integer; begin
 delete from public.projects where slug='rls-published-test'; get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Admin delete failed'; end if;
 delete from public.projects where slug='editor-created-test'; get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Admin failed to delete editor project'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.projects where slug in ('rls-published-test','editor-created-test')) or exists(select 1 from public.project_images where project_id='70000000-0000-4000-8000-000000000001') or exists(select 1 from public.project_gallery_links where project_id='70000000-0000-4000-8000-000000000001') then raise exception 'Project cascade left references'; end if;
 if not exists(select 1 from public.projects where id='70000000-0000-4000-8000-000000000002' and title_hy='Editor update') or not exists(select 1 from public.project_images where id='80000000-0000-4000-8000-000000000002') then raise exception 'Draft fixture unexpectedly modified/deleted'; end if;
 if (select count(*) from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001')<>2 then raise exception 'Cleanup queue lost removed files'; end if;
 if exists(select 1 from public.project_storage_cleanup where project_id='70000000-0000-4000-8000-000000000001' and storage_path not in ('70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000001.jpg','70000000-0000-4000-8000-000000000001/80000000-0000-4000-8000-000000000003.jpg')) then raise exception 'Unexpected cleanup paths'; end if;
end $$;
rollback;
