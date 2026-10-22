begin;
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
create function private.service_text_valid(value text,maximum integer) returns boolean
language sql immutable set search_path='' as $$
 select value is not null and length(value)<=maximum and value !~ '[<>]' and translate(value,E'\t\n\r','') !~ '[[:cntrl:]]';
$$;
revoke all on function private.service_text_valid(text,integer) from public,anon,authenticated,service_role;
create function private.service_text_nonempty(value text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(value ~ U&'[^\0009-\000d\0020\0085\00a0\00ad\034f\0600-\0605\061c\06dd\070f\0890-\0891\08e2\115f-\1160\1680\17b4-\17b5\180b-\180f\2000-\200f\2028-\202f\205f-\206f\3000\3164\fe00-\fe0f\feff\ffa0\fff0-\fffb\+0110bd\+0110cd\+013430-\+01343f\+01bca0-\+01bca3\+01d173-\+01d17a\+0e0000-\+0e0fff]',false);
$$;
revoke all on function private.service_text_nonempty(text) from public,anon,authenticated,service_role;
create table public.services (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 service_key text not null unique check(service_key in ('surveying','construction','design','furniture','doorsWindows','realEstate')),
 icon_key text not null check(icon_key in ('surveying','construction','design','furniture','doorsWindows','realEstate')),
 title_hy text not null, title_en text not null default '', title_ru text not null default '',
 description_hy text not null default '', description_en text not null default '', description_ru text not null default '',
 sort_order integer not null check(sort_order between 0 and 999),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 accepts_inquiries boolean not null default true,
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 check(private.service_text_nonempty(title_hy)),
 check(length(title_en)<=200 and length(title_ru)<=200),
 check(length(description_hy)<=2000 and length(description_en)<=2000 and length(description_ru)<=2000),
 check(private.service_text_valid(title_hy,200) and private.service_text_valid(title_en,200) and private.service_text_valid(title_ru,200) and private.service_text_valid(description_hy,2000) and private.service_text_valid(description_en,2000) and private.service_text_valid(description_ru,2000)),
 check(status<>'published' or (private.service_text_nonempty(title_hy) and private.service_text_nonempty(title_en) and private.service_text_nonempty(title_ru) and private.service_text_nonempty(description_hy) and private.service_text_nonempty(description_en) and private.service_text_nonempty(description_ru)))
);
create index services_public_order on public.services(status,sort_order,service_key);
alter table public.services enable row level security;
revoke all on public.services from public,anon,authenticated,service_role;
grant select on public.services to authenticated,service_role;
grant select (service_key,icon_key,sort_order,status,accepts_inquiries,title_hy,title_en,title_ru,description_hy,description_en,description_ru) on public.services to anon;
create policy "published services" on public.services for select to anon using(status='published');
create policy "staff services" on public.services for select to authenticated using((select private.has_staff_role(array['admin','editor'])));
create table private.service_inquiry_config (singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into private.service_inquiry_config values(true,false);
alter table private.service_inquiry_config enable row level security;
revoke all on private.service_inquiry_config from public,anon,authenticated,service_role;
create function public.inquiry_service_catalog_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select enabled from private.service_inquiry_config where singleton;
$$;
revoke all on function public.inquiry_service_catalog_enabled() from public,anon,authenticated,service_role;
grant execute on function public.inquiry_service_catalog_enabled() to service_role;
create function public.save_service(p_id uuid,p_revision integer,p_payload jsonb) returns jsonb
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
  if not is_admin and (p_payload->>'icon_key' is distinct from p_payload->>'service_key' or (p_payload->>'sort_order')::integer is distinct from array_position(array['surveying','construction','design','furniture','doorsWindows','realEstate'],p_payload->>'service_key')-1 or (p_payload->>'accepts_inquiries')::boolean is distinct from true) then raise exception 'Admin required' using errcode='42501'; end if;
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
create function public.set_service_status(p_id uuid,p_revision integer,p_status text) returns jsonb
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
alter table public.customer_requests add column service_id uuid references public.services(id) on delete restrict,
 add column service_title_snapshot jsonb;
alter table public.customer_requests drop constraint customer_requests_requested_service_check;
alter table public.customer_requests add constraint customer_requests_requested_service_check check(requested_service in ('construction','surveying','design','furniture','doorsWindows','realEstate'));
create or replace function public.submit_customer_request(p_key uuid,p_hash text,p_contact_hash text,p_payload jsonb)
 returns boolean language plpgsql security definer set search_path='' as $$
declare existing_hash text; catalog_enabled boolean;
begin
 select enabled into catalog_enabled from private.service_inquiry_config where singleton for share;
 if catalog_enabled is distinct from false then raise exception 'Catalog endpoint required' using errcode='55000'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_contact_hash is null or p_contact_hash !~ '^[a-f0-9]{64}$'
 or p_payload->'privacyConsent' is distinct from 'true'::jsonb then raise exception 'Invalid request' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
 select payload_hash into existing_hash from public.customer_requests where submission_key=p_key;
 if found then
  if existing_hash<>p_hash then raise exception 'Submission conflict' using errcode='23505'; end if;
  return true;
 end if;
 if not private.inquiry_quota('contact:'||p_contact_hash,3600,3) then return false; end if;
 insert into public.customer_requests(submission_key,payload_hash,full_name,phone,email,requested_service,location,description,language,privacy_version)
 values(p_key,p_hash,p_payload->>'fullName',p_payload->>'phone',nullif(p_payload->>'email',''),p_payload->>'service',p_payload->>'location',p_payload->>'description',p_payload->>'language','inquiry-v1');
 return true;
end $$;
revoke all on function public.submit_customer_request(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.submit_customer_request(uuid,text,text,jsonb) to service_role;
create function public.submit_customer_request_v2(p_key uuid,p_hash text,p_contact_hash text,p_payload jsonb)
 returns boolean language plpgsql security definer set search_path='' as $$
declare existing_hash text; catalog public.services; catalog_enabled boolean;
begin
 select enabled into catalog_enabled from private.service_inquiry_config where singleton for share;
 if catalog_enabled is distinct from true then raise exception 'Catalog disabled' using errcode='55000'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_contact_hash is null or p_contact_hash !~ '^[a-f0-9]{64}$'
 or p_payload->'privacyConsent' is distinct from 'true'::jsonb then raise exception 'Invalid request' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key::text,0));
 select payload_hash into existing_hash from public.customer_requests where submission_key=p_key;
 if found then
  if existing_hash<>p_hash then raise exception 'Submission conflict' using errcode='23505'; end if;
  return true;
 end if;
 select * into catalog from public.services where service_key=p_payload->>'service' for share;
 if not found or catalog.status<>'published' or not catalog.accepts_inquiries then raise exception 'Service unavailable' using errcode='23514'; end if;
 if not private.inquiry_quota('contact:'||p_contact_hash,3600,3) then return false; end if;
 insert into public.customer_requests(submission_key,payload_hash,full_name,phone,email,requested_service,location,description,language,privacy_version,service_id,service_title_snapshot)
 values(p_key,p_hash,p_payload->>'fullName',p_payload->>'phone',nullif(p_payload->>'email',''),p_payload->>'service',p_payload->>'location',p_payload->>'description',p_payload->>'language','inquiry-v1',catalog.id,jsonb_build_object('hy',catalog.title_hy,'en',catalog.title_en,'ru',catalog.title_ru));
 return true;
end $$;
revoke all on function public.submit_customer_request_v2(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.submit_customer_request_v2(uuid,text,text,jsonb) to service_role;

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
commit;
