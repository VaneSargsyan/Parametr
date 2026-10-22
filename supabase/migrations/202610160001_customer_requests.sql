-- UNAPPLIED: staging uewihgsxrcjieghtkhjs only. No email/Storage operations.
begin;
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
-- Inspect effective privileges, including column ACLs and roles reachable through
-- SET ROLE (MEMBER), not only currently inherited table ACLs. Never repair an
-- unknown Phase 3 role/policy configuration by silently revoking its grants.
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
create table public.customer_requests (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 submission_key uuid not null unique,
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 full_name text not null check(length(trim(full_name)) between 2 and 120),
 phone text not null check(phone ~ '^\+?[0-9]{7,15}$'),
 email text check(email is null or (length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 requested_service text not null check(requested_service in ('construction','surveying','design','furniture','doorsWindows')),
 location text not null check(length(trim(location)) between 2 and 300),
 description text not null check(length(trim(description)) between 10 and 5000),
 language text not null check(language in ('hy','en','ru')),
 privacy_consent_at timestamptz not null default now(),
 privacy_version text not null check(privacy_version='inquiry-v1'),
 status text not null default 'new' check(status in ('new','in_progress','completed','rejected')),
 revision integer not null default 0 check(revision>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
create index customer_requests_order on public.customer_requests(created_at desc,id);
create index customer_requests_status on public.customer_requests(status,created_at desc);
alter table public.customer_requests enable row level security;
revoke all on public.customer_requests from public,anon,authenticated,service_role;
grant select on public.customer_requests to authenticated,service_role;
create policy "active admins read requests" on public.customer_requests for select to authenticated
 using ((select private.has_staff_role(array['admin'])));
-- No direct client inserts, updates, deletes or TRUNCATE. Only constrained RPCs write.
create table private.inquiry_limits (
 bucket text not null, window_start timestamptz not null, hits integer not null check(hits>0),
 primary key(bucket,window_start)
);
alter table private.inquiry_limits enable row level security;
revoke all on private.inquiry_limits from public,anon,authenticated,service_role;
-- Atomic counter shared across isolates; no untrusted forwarded IP is used.
create function private.inquiry_quota(bucket_key text, seconds integer, maximum integer) returns boolean
 language plpgsql security definer set search_path='' as $$
declare n integer; start_at timestamptz;
begin
 start_at:=pg_catalog.to_timestamp(floor(extract(epoch from now())/seconds)*seconds);
 insert into private.inquiry_limits(bucket,window_start,hits) values(bucket_key,start_at,1)
 on conflict(bucket,window_start) do update set hits=private.inquiry_limits.hits+1
 where private.inquiry_limits.hits<maximum returning hits into n;
 return n is not null;
end $$;
revoke all on function private.inquiry_quota(text,integer,integer) from public,anon,authenticated,service_role;
-- Counts attempts BEFORE CAPTCHA verification; global caps bound provider and DB work.
create function public.inquiry_attempt() returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from private.inquiry_limits where window_start<now()-interval '2 days';
 if not private.inquiry_quota('global-10m',600,120) then return false; end if;
 return private.inquiry_quota('global-day',86400,1000);
end $$;
revoke all on function public.inquiry_attempt() from public,anon,authenticated,service_role;
grant execute on function public.inquiry_attempt() to service_role;
create function public.submit_customer_request(p_key uuid,p_hash text,p_contact_hash text,p_payload jsonb)
 returns boolean language plpgsql security definer set search_path='' as $$
declare existing_hash text;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_contact_hash is null or p_contact_hash !~ '^[a-f0-9]{64}$'
 or p_payload->'privacyConsent' is distinct from 'true'::jsonb then raise exception 'Invalid request' using errcode='23514'; end if;
 -- Serialize equal keys; concurrent retries cannot double-insert or double-count contact quota.
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
create function public.set_customer_request_status(p_id uuid,p_revision integer,p_status text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.customer_requests;
begin
 if not private.has_staff_role(array['admin']) then raise exception 'Admin required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('new','in_progress','completed','rejected') then raise exception 'Invalid status' using errcode='23514'; end if;
 update public.customer_requests set status=p_status,revision=revision+1,
 updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond'),updated_by=auth.uid()
 where id=p_id and revision=p_revision returning * into result;
 if not found then raise exception 'Request changed or unavailable' using errcode='40001'; end if;
 return to_jsonb(result);
end $$;
revoke all on function public.set_customer_request_status(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.set_customer_request_status(uuid,integer,text) to authenticated;
-- Final effective-privilege assertions are part of the SAME transaction as DDL.
-- Named REVOKEs do not override grants inherited from custom default-ACL roles.
-- Fail before COMMIT rather than changing unrelated memberships/default ACLs.
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
 -- Positive checks prevent hardening from accidentally disabling intended callers.
 if not pg_catalog.has_table_privilege('authenticated','public.customer_requests','SELECT')
 or not pg_catalog.has_function_privilege('authenticated','public.set_customer_request_status(uuid,integer,text)','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.inquiry_attempt()','EXECUTE')
 or not pg_catalog.has_function_privilege('service_role','public.submit_customer_request(uuid,text,text,jsonb)','EXECUTE') then
  raise exception 'Missing required inquiry privileges';
 end if;
end $$;
commit;
