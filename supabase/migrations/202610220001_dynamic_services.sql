begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
set local search_path='';
do $$ declare owner_id oid; begin
 select relowner into owner_id from pg_catalog.pg_class where oid='public.admin_users'::regclass;
 if owner_id is distinct from (select oid from pg_catalog.pg_roles where rolname=current_user)
 or not exists(select 1 from pg_catalog.pg_proc where oid='private.has_staff_role(text[])'::regprocedure and proowner=owner_id and prosecdef and 'search_path=""'=any(proconfig))
 or current_user in ('anon','authenticated','service_role') then raise exception 'Run as trusted Phase 3 owner'; end if;
 if not exists(select 1 from pg_catalog.pg_class where oid='public.admin_users'::regclass and relrowsecurity and not relforcerowsecurity)
 or pg_catalog.has_schema_privilege('authenticated','private','CREATE') or pg_catalog.has_schema_privilege('anon','private','CREATE')
 or exists(select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
 or pg_catalog.has_table_privilege('authenticated','public.admin_users','INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Unsafe membership privileges or RLS'; end if;
 if pg_catalog.pg_has_role('anon',current_user,'MEMBER') or pg_catalog.pg_has_role('authenticated',current_user,'MEMBER')
 or pg_catalog.pg_has_role('anon','service_role','MEMBER') or pg_catalog.pg_has_role('authenticated','service_role','MEMBER') then raise exception 'Unsafe client role inheritance'; end if;
end $$;
do $$ declare client_role record; begin
 for client_role in select oid,rolname,rolsuper,rolbypassrls from pg_catalog.pg_roles
 where rolname in ('anon','authenticated')
 or pg_catalog.pg_has_role('anon',oid,'MEMBER')
 or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if client_role.rolsuper or client_role.rolbypassrls
   or pg_catalog.has_schema_privilege(client_role.oid,'private','CREATE')
   or pg_catalog.has_table_privilege(client_role.oid,'public.admin_users','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_any_column_privilege(client_role.oid,'public.admin_users','INSERT,UPDATE,REFERENCES') then
   raise exception 'Unsafe membership privileges for client-reachable role %',client_role.rolname;
  end if;
 end loop;
 if exists(select 1 from pg_catalog.pg_policy p where p.polrelid='public.admin_users'::pg_catalog.regclass
  and p.polcmd in ('a','w','d','*') and (0=any(p.polroles) or exists(
   select 1 from unnest(p.polroles) as grantee(role_id)
   where case when grantee.role_id=0 then true else
    pg_catalog.pg_has_role('anon',grantee.role_id,'MEMBER')
    or pg_catalog.pg_has_role('authenticated',grantee.role_id,'MEMBER') end
  ))) then raise exception 'Unsafe membership write policy for client roles'; end if;
end $$;

do $$ declare owner_id oid; signature text; begin
 select oid into owner_id from pg_catalog.pg_roles where rolname=current_user;
 if not exists(select 1 from pg_catalog.pg_class where oid='public.customer_requests'::regclass and relowner=owner_id and relrowsecurity and not relforcerowsecurity) then raise exception 'Trusted Phase 5 table required'; end if;
 foreach signature in array array['public.submit_customer_request(uuid,text,text,jsonb)','public.inquiry_attempt()','public.set_customer_request_status(uuid,integer,text)'] loop
  if not exists(select 1 from pg_catalog.pg_proc where oid=signature::regprocedure and proowner=owner_id and prosecdef and 'search_path=""'=any(proconfig)) then raise exception 'Trusted Phase 5 function required: %',signature; end if;
 end loop;
 if pg_catalog.has_schema_privilege('anon','public','CREATE') or pg_catalog.has_schema_privilege('authenticated','public','CREATE') then raise exception 'Unsafe public schema CREATE'; end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_catalog.pg_class where oid='public.customer_requests'::pg_catalog.regclass and relrowsecurity and not relforcerowsecurity and relowner=(select oid from pg_catalog.pg_roles where rolname=current_user))
 or (select count(*) from pg_catalog.pg_policy where polrelid='public.customer_requests'::pg_catalog.regclass)<>1
 or not exists(select 1 from pg_catalog.pg_policy
  where polrelid='public.customer_requests'::pg_catalog.regclass
  and polname='active admins read requests' and polcmd='r' and polpermissive
  and polroles=array[(select oid from pg_catalog.pg_roles where rolname='authenticated')]::oid[]
  and polwithcheck is null
  and pg_catalog.pg_get_expr(polqual,polrelid,false)='( SELECT private.has_staff_role(ARRAY[''admin''::text]) AS has_staff_role)') then
  raise exception 'Unsafe Phase 5 customer request policy contract';
 end if;
end $$;
do $$ declare r record; signature text; owner_id oid; begin
 select oid into owner_id from pg_catalog.pg_roles where rolname=current_user;
 for r in select oid,rolname,rolsuper,rolbypassrls from pg_catalog.pg_roles where rolname in ('anon','authenticated') or pg_catalog.pg_has_role('anon',oid,'MEMBER') or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if r.rolsuper or r.rolbypassrls or r.oid=owner_id
  or pg_catalog.has_schema_privilege(r.oid,'public','CREATE') or pg_catalog.has_schema_privilege(r.oid,'private','CREATE')
  or pg_catalog.has_table_privilege(r.oid,'public.services','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  or pg_catalog.has_any_column_privilege(r.oid,'public.services','INSERT,UPDATE,REFERENCES')
  or pg_catalog.has_any_column_privilege(r.oid,'private.service_inquiry_config','SELECT,INSERT,UPDATE,REFERENCES')
  or pg_catalog.has_table_privilege(r.oid,'private.service_inquiry_config','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Unsafe services privileges for %',r.rolname; end if;
  foreach signature in array array['public.submit_customer_request(uuid,text,text,jsonb)','public.submit_customer_request_v2(uuid,text,text,jsonb)','private.service_text_valid(text,integer)','private.service_text_nonempty(text)','public.inquiry_service_catalog_enabled()'] loop
   if pg_catalog.has_function_privilege(r.oid,signature,'EXECUTE') then raise exception 'Unsafe submission execution for %',r.rolname; end if;
  end loop;
  if r.rolname='anon' or pg_catalog.pg_has_role('anon',r.oid,'MEMBER') then
   if exists(select 1 from pg_catalog.pg_attribute a where a.attrelid='public.services'::pg_catalog.regclass and a.attnum>0 and not a.attisdropped
    and a.attname<>all(array['service_key','icon_key','sort_order','status','accepts_inquiries','title_hy','title_en','title_ru','description_hy','description_en','description_ru'])
    and pg_catalog.has_column_privilege(r.oid,'public.services',a.attname,'SELECT')) then raise exception 'Unsafe anonymous service metadata privileges for %',r.rolname; end if;
   if pg_catalog.has_function_privilege(r.oid,'public.save_service(uuid,integer,jsonb)','EXECUTE') or pg_catalog.has_function_privilege(r.oid,'public.set_service_status(uuid,integer,text)','EXECUTE') then raise exception 'Anonymous management execution'; end if;
  end if;
 end loop;
 if not pg_catalog.has_function_privilege('service_role','public.inquiry_service_catalog_enabled()','EXECUTE') or not pg_catalog.has_function_privilege('service_role','public.submit_customer_request_v2(uuid,text,text,jsonb)','EXECUTE') or not pg_catalog.has_function_privilege('authenticated','public.save_service(uuid,integer,jsonb)','EXECUTE') then raise exception 'Required services privileges missing'; end if;
end $$;
do $$ declare client_role record; signature text; begin
 for client_role in select oid,rolname from pg_catalog.pg_roles
 where rolname in ('anon','authenticated')
 or pg_catalog.pg_has_role('anon',oid,'MEMBER')
 or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if pg_catalog.has_table_privilege(client_role.oid,'public.customer_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_any_column_privilege(client_role.oid,'public.customer_requests','INSERT,UPDATE,REFERENCES')
   or pg_catalog.has_table_privilege(client_role.oid,'private.inquiry_limits','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_any_column_privilege(client_role.oid,'private.inquiry_limits','SELECT,INSERT,UPDATE,REFERENCES') then
   raise exception 'Unsafe inquiry table privileges for client-reachable role %',client_role.rolname;
  end if;
  if (client_role.rolname='anon' or pg_catalog.pg_has_role('anon',client_role.oid,'MEMBER'))
   and pg_catalog.has_any_column_privilege(client_role.oid,'public.customer_requests','SELECT') then
   raise exception 'Unsafe anonymous inquiry read privileges for role %',client_role.rolname;
  end if;
  foreach signature in array array[
   'private.inquiry_quota(text,integer,integer)',
   'public.inquiry_attempt()',
   'public.submit_customer_request(uuid,text,text,jsonb)'
  ] loop
   if pg_catalog.has_function_privilege(client_role.oid,signature,'EXECUTE') then
    raise exception 'Unsafe inquiry function privileges for role % on %',client_role.rolname,signature;
   end if;
  end loop;
  if (client_role.rolname='anon' or pg_catalog.pg_has_role('anon',client_role.oid,'MEMBER'))
   and pg_catalog.has_function_privilege(client_role.oid,'public.set_customer_request_status(uuid,integer,text)','EXECUTE') then
   raise exception 'Unsafe anonymous status function privileges for role %',client_role.rolname;
  end if;
 end loop;
 if not pg_catalog.has_table_privilege('authenticated','public.customer_requests','SELECT')
 or not pg_catalog.has_function_privilege('authenticated','public.set_customer_request_status(uuid,integer,text)','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.inquiry_attempt()','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.submit_customer_request(uuid,text,text,jsonb)','EXECUTE') then
  raise exception 'Missing required inquiry privileges';
 end if;
end $$;

do $$ begin
 if not exists(select 1 from pg_catalog.pg_class where oid='public.customer_requests'::pg_catalog.regclass and relrowsecurity and not relforcerowsecurity and relowner=(select oid from pg_catalog.pg_roles where rolname=current_user))
 or (select count(*) from pg_catalog.pg_policy where polrelid='public.customer_requests'::pg_catalog.regclass)<>1
 or not exists(select 1 from pg_catalog.pg_policy
  where polrelid='public.customer_requests'::pg_catalog.regclass
  and polname='active admins read requests' and polcmd='r' and polpermissive
  and polroles=array[(select oid from pg_catalog.pg_roles where rolname='authenticated')]::oid[]
  and polwithcheck is null
  and pg_catalog.pg_get_expr(polqual,polrelid,false)='( SELECT private.has_staff_role(ARRAY[''admin''::text]) AS has_staff_role)') then
  raise exception 'Unsafe Phase 5 customer request policy contract';
 end if;
end $$;

lock table public.services in access exclusive mode;

do $$ begin
 if (select count(*) from pg_catalog.pg_policy where polrelid='public.services'::regclass)<>2
 or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.services'::regclass and polname='published services' and polcmd='r' and polpermissive and polwithcheck is null and polroles=array[(select oid from pg_catalog.pg_roles where rolname='anon')]::oid[] and pg_catalog.pg_get_expr(polqual,polrelid,false)='(status = ''published''::text)')
 or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.services'::regclass and polname='staff services' and polcmd='r' and polpermissive and polwithcheck is null and polroles=array[(select oid from pg_catalog.pg_roles where rolname='authenticated')]::oid[] and pg_catalog.pg_get_expr(polqual,polrelid,false)='( SELECT private.has_staff_role(ARRAY[''admin''::text, ''editor''::text]) AS has_staff_role)') then raise exception 'Unsafe Phase 6 service policy contract'; end if;
end $$;

do $$ declare owner_id oid; signature text; begin
 select oid into owner_id from pg_catalog.pg_roles where rolname=current_user;
 if not exists(select 1 from pg_catalog.pg_class where oid='public.services'::regclass and relowner=owner_id and relrowsecurity and not relforcerowsecurity) then raise exception 'Trusted Phase 6 Services required'; end if;
 foreach signature in array array['public.save_service(uuid,integer,jsonb)','public.set_service_status(uuid,integer,text)','public.inquiry_service_catalog_enabled()','public.submit_customer_request_v2(uuid,text,text,jsonb)'] loop
  if not exists(select 1 from pg_catalog.pg_proc where oid=signature::regprocedure and proowner=owner_id and prosecdef and 'search_path=""'=any(proconfig)) then raise exception 'Trusted Phase 6 function required: %',signature; end if;
 end loop;
 perform 1 from private.service_inquiry_config where singleton for update;
 if not exists(select 1 from pg_catalog.pg_class where oid='private.service_inquiry_config'::regclass and relowner=owner_id and relrowsecurity)
 or (select count(*) from private.service_inquiry_config)<>1
 or not exists(select 1 from private.service_inquiry_config where singleton and not enabled) then raise exception 'Catalog mode must remain disabled'; end if;
 if exists(select 1 from unnest(array['surveying','construction','design','furniture','doorsWindows','realEstate']) k where not exists(select 1 from public.services where service_key=k)) then raise exception 'Six existing core services required'; end if;
 if exists(select 1 from public.services where service_key=any(array['surveying','construction','design','furniture','doorsWindows','realEstate']) and (not private.service_text_nonempty(title_hy) or not private.service_text_nonempty(title_en) or not private.service_text_nonempty(title_ru) or not private.service_text_nonempty(description_hy) or not private.service_text_nonempty(description_en) or not private.service_text_nonempty(description_ru))) then raise exception 'Review complete core translations before publishing'; end if;
end $$;
alter table public.services add column is_core boolean generated always as (service_key=any(array['surveying','construction','design','furniture','doorsWindows','realEstate'])) stored;
alter table public.services drop constraint services_service_key_check;
alter table public.services add constraint services_service_key_check check(service_key=any(array['surveying','construction','design','furniture','doorsWindows','realEstate']) or (length(service_key) between 1 and 80 and service_key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'));
create unique index services_key_casefold on public.services(lower(service_key));
update public.services set status='published',revision=revision+1,updated_at=clock_timestamp() where is_core and status<>'published';
alter table public.services add constraint services_core_published check(not is_core or status='published');
create function private.protect_service_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_RELID<>'public.services'::regclass or TG_NARGS<>0 then raise exception 'Invalid trigger context' using errcode='42501'; end if;
 if TG_OP='TRUNCATE' then raise exception 'Core services cannot be removed' using errcode='23514'; end if;
 if TG_OP='DELETE' then
  if old.is_core then raise exception 'Core services cannot be removed' using errcode='23514'; end if;
  return old;
 end if;
 if old.id is distinct from new.id or old.service_key is distinct from new.service_key then raise exception 'Immutable service identity' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.protect_service_identity() from public,anon,authenticated,service_role;
create trigger protect_service_identity before update or delete on public.services for each row execute function private.protect_service_identity();
create trigger protect_core_truncate before truncate on public.services for each statement execute function private.protect_service_identity();
create or replace function public.save_service(p_id uuid,p_revision integer,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.services; saved public.services; is_admin boolean;
begin
 if not private.has_staff_role(array['admin','editor']) then raise exception 'Staff required' using errcode='42501'; end if;
 is_admin:=private.has_staff_role(array['admin']);
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('service_key','icon_key','sort_order','accepts_inquiries','title_hy','title_en','title_ru','description_hy','description_en','description_ru')) then raise exception 'Invalid service' using errcode='23514'; end if;
 if exists(select 1 from unnest(array['service_key','icon_key','title_hy','title_en','title_ru','description_hy','description_en','description_ru']) field where jsonb_typeof(p_payload->field) is distinct from 'string')
 or jsonb_typeof(p_payload->'sort_order') is distinct from 'number' or jsonb_typeof(p_payload->'accepts_inquiries') is distinct from 'boolean' then raise exception 'Invalid service fields' using errcode='23514'; end if;
 if p_id is not null then
  select * into old from public.services where id=p_id for update;
  if not found or old.revision is distinct from p_revision then raise exception 'Service changed' using errcode='40001'; end if;
  if old.service_key is distinct from p_payload->>'service_key' then raise exception 'Immutable key' using errcode='23514'; end if;
  if not is_admin and (old.status<>'draft' or old.icon_key is distinct from p_payload->>'icon_key' or old.sort_order is distinct from (p_payload->>'sort_order')::integer or old.accepts_inquiries is distinct from (p_payload->>'accepts_inquiries')::boolean) then raise exception 'Admin required' using errcode='42501'; end if;
 else
  if p_revision is not null then raise exception 'Invalid revision' using errcode='23514'; end if;
  if not is_admin then raise exception 'Admin required' using errcode='42501'; end if;
 end if;
 if p_id is null then
  insert into public.services(service_key,icon_key,sort_order,accepts_inquiries,title_hy,title_en,title_ru,description_hy,description_en,description_ru,created_by,updated_by)
  values(p_payload->>'service_key',p_payload->>'icon_key',(p_payload->>'sort_order')::integer,(p_payload->>'accepts_inquiries')::boolean,p_payload->>'title_hy',p_payload->>'title_en',p_payload->>'title_ru',p_payload->>'description_hy',p_payload->>'description_en',p_payload->>'description_ru',auth.uid(),auth.uid()) returning * into saved;
 else
  update public.services set icon_key=p_payload->>'icon_key',sort_order=(p_payload->>'sort_order')::integer,accepts_inquiries=(p_payload->>'accepts_inquiries')::boolean,
  title_hy=p_payload->>'title_hy',title_en=p_payload->>'title_en',title_ru=p_payload->>'title_ru',description_hy=p_payload->>'description_hy',description_en=p_payload->>'description_en',description_ru=p_payload->>'description_ru',
  revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id returning * into saved;
 end if;
 return to_jsonb(saved);
end $$;
create or replace function public.set_service_status(p_id uuid,p_revision integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.services;
begin
 if not private.has_staff_role(array['admin']) then raise exception 'Admin required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('draft','published','archived') then raise exception 'Invalid status' using errcode='23514'; end if;
 update public.services set status=p_status,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id and revision=p_revision returning * into saved;
 if not found then raise exception 'Service changed' using errcode='40001'; end if;
 return to_jsonb(saved);
end $$;
revoke all on function public.save_service(uuid,integer,jsonb),public.set_service_status(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.save_service(uuid,integer,jsonb),public.set_service_status(uuid,integer,text) to authenticated;
do $$ declare r record; signature text; owner_id oid; begin
 select oid into owner_id from pg_catalog.pg_roles where rolname=current_user;
 for r in select oid,rolname,rolsuper,rolbypassrls from pg_catalog.pg_roles where rolname in ('anon','authenticated') or pg_catalog.pg_has_role('anon',oid,'MEMBER') or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if r.rolsuper or r.rolbypassrls or r.oid=owner_id
  or pg_catalog.has_schema_privilege(r.oid,'public','CREATE') or pg_catalog.has_schema_privilege(r.oid,'private','CREATE')
  or pg_catalog.has_table_privilege(r.oid,'public.services','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  or pg_catalog.has_any_column_privilege(r.oid,'public.services','INSERT,UPDATE,REFERENCES')
  or pg_catalog.has_any_column_privilege(r.oid,'private.service_inquiry_config','SELECT,INSERT,UPDATE,REFERENCES')
  or pg_catalog.has_table_privilege(r.oid,'private.service_inquiry_config','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'Unsafe services privileges for %',r.rolname; end if;
  foreach signature in array array['public.submit_customer_request(uuid,text,text,jsonb)','public.submit_customer_request_v2(uuid,text,text,jsonb)','private.service_text_valid(text,integer)','private.service_text_nonempty(text)','public.inquiry_service_catalog_enabled()'] loop
   if pg_catalog.has_function_privilege(r.oid,signature,'EXECUTE') then raise exception 'Unsafe submission execution for %',r.rolname; end if;
  end loop;
  if r.rolname='anon' or pg_catalog.pg_has_role('anon',r.oid,'MEMBER') then
   if exists(select 1 from pg_catalog.pg_attribute a where a.attrelid='public.services'::pg_catalog.regclass and a.attnum>0 and not a.attisdropped
    and a.attname<>all(array['service_key','icon_key','sort_order','status','accepts_inquiries','title_hy','title_en','title_ru','description_hy','description_en','description_ru'])
    and pg_catalog.has_column_privilege(r.oid,'public.services',a.attname,'SELECT')) then raise exception 'Unsafe anonymous service metadata privileges for %',r.rolname; end if;
   if pg_catalog.has_function_privilege(r.oid,'public.save_service(uuid,integer,jsonb)','EXECUTE') or pg_catalog.has_function_privilege(r.oid,'public.set_service_status(uuid,integer,text)','EXECUTE') then raise exception 'Anonymous management execution'; end if;
  end if;
 end loop;
 if not pg_catalog.has_function_privilege('service_role','public.inquiry_service_catalog_enabled()','EXECUTE') or not pg_catalog.has_function_privilege('service_role','public.submit_customer_request_v2(uuid,text,text,jsonb)','EXECUTE') or not pg_catalog.has_function_privilege('authenticated','public.save_service(uuid,integer,jsonb)','EXECUTE') then raise exception 'Required services privileges missing'; end if;
end $$;
do $$ declare client_role record; signature text; begin
 for client_role in select oid,rolname from pg_catalog.pg_roles
 where rolname in ('anon','authenticated')
 or pg_catalog.pg_has_role('anon',oid,'MEMBER')
 or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if pg_catalog.has_table_privilege(client_role.oid,'public.customer_requests','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_any_column_privilege(client_role.oid,'public.customer_requests','INSERT,UPDATE,REFERENCES')
   or pg_catalog.has_table_privilege(client_role.oid,'private.inquiry_limits','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_any_column_privilege(client_role.oid,'private.inquiry_limits','SELECT,INSERT,UPDATE,REFERENCES') then
   raise exception 'Unsafe inquiry table privileges for client-reachable role %',client_role.rolname;
  end if;
  if (client_role.rolname='anon' or pg_catalog.pg_has_role('anon',client_role.oid,'MEMBER'))
   and pg_catalog.has_any_column_privilege(client_role.oid,'public.customer_requests','SELECT') then
   raise exception 'Unsafe anonymous inquiry read privileges for role %',client_role.rolname;
  end if;
  foreach signature in array array[
   'private.inquiry_quota(text,integer,integer)',
   'public.inquiry_attempt()',
   'public.submit_customer_request(uuid,text,text,jsonb)'
  ] loop
   if pg_catalog.has_function_privilege(client_role.oid,signature,'EXECUTE') then
    raise exception 'Unsafe inquiry function privileges for role % on %',client_role.rolname,signature;
   end if;
  end loop;
  if (client_role.rolname='anon' or pg_catalog.pg_has_role('anon',client_role.oid,'MEMBER'))
   and pg_catalog.has_function_privilege(client_role.oid,'public.set_customer_request_status(uuid,integer,text)','EXECUTE') then
   raise exception 'Unsafe anonymous status function privileges for role %',client_role.rolname;
  end if;
 end loop;
 if not pg_catalog.has_table_privilege('authenticated','public.customer_requests','SELECT')
 or not pg_catalog.has_function_privilege('authenticated','public.set_customer_request_status(uuid,integer,text)','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.inquiry_attempt()','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.submit_customer_request(uuid,text,text,jsonb)','EXECUTE') then
  raise exception 'Missing required inquiry privileges';
 end if;
end $$;

do $$ begin
 if not exists(select 1 from pg_catalog.pg_class where oid='public.customer_requests'::pg_catalog.regclass and relrowsecurity and not relforcerowsecurity and relowner=(select oid from pg_catalog.pg_roles where rolname=current_user))
 or (select count(*) from pg_catalog.pg_policy where polrelid='public.customer_requests'::pg_catalog.regclass)<>1
 or not exists(select 1 from pg_catalog.pg_policy
  where polrelid='public.customer_requests'::pg_catalog.regclass
  and polname='active admins read requests' and polcmd='r' and polpermissive
  and polroles=array[(select oid from pg_catalog.pg_roles where rolname='authenticated')]::oid[]
  and polwithcheck is null
  and pg_catalog.pg_get_expr(polqual,polrelid,false)='( SELECT private.has_staff_role(ARRAY[''admin''::text]) AS has_staff_role)') then
  raise exception 'Unsafe Phase 5 customer request policy contract';
 end if;
end $$;

do $$ declare r record; begin
 for r in select oid,rolname from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role') or pg_catalog.pg_has_role('anon',oid,'MEMBER') or pg_catalog.pg_has_role('authenticated',oid,'MEMBER') loop
  if pg_catalog.has_function_privilege(r.oid,'private.protect_service_identity()','EXECUTE') then raise exception 'Unsafe Services trigger EXECUTE for %',r.rolname; end if;
 end loop;
end $$;
do $$ begin
 if (select count(*) from pg_catalog.pg_policy where polrelid='public.services'::regclass)<>2
 or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.services'::regclass and polname='published services' and polcmd='r' and polpermissive and polwithcheck is null and polroles=array[(select oid from pg_catalog.pg_roles where rolname='anon')]::oid[] and pg_catalog.pg_get_expr(polqual,polrelid,false)='(status = ''published''::text)')
 or not exists(select 1 from pg_catalog.pg_policy where polrelid='public.services'::regclass and polname='staff services' and polcmd='r' and polpermissive and polwithcheck is null and polroles=array[(select oid from pg_catalog.pg_roles where rolname='authenticated')]::oid[] and pg_catalog.pg_get_expr(polqual,polrelid,false)='( SELECT private.has_staff_role(ARRAY[''admin''::text, ''editor''::text]) AS has_staff_role)') then raise exception 'Unsafe Phase 6 service policy contract'; end if;
end $$;
commit;
