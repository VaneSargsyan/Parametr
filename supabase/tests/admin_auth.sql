-- Run the ENTIRE file in one SQL Editor execution as postgres on disposable staging,
-- AFTER Phase 3. Do not run selected statements or use application credentials.
-- Minimal auth.users rows are SQL policy fixtures, NOT usable Auth accounts.
-- Review custom auth.users triggers first: rollback cannot undo external effects.
-- Success reaches ROLLBACK; on ANY error, execute ROLLBACK before continuing.
begin;
-- Fail closed on fixture collisions; never overwrite/delete an existing identity.
do $$ begin
 if current_user <> 'postgres' then raise exception 'Run this suite as postgres'; end if;
 if exists(select 1 from auth.users where id in (
  '10000000-0000-4000-8000-000000000001'::uuid,
  '10000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000003'::uuid,
  '10000000-0000-4000-8000-000000000004'::uuid
 ) or email in ('admin-test@example.invalid','editor-test@example.invalid','outsider-test@example.invalid','inactive-test@example.invalid')) then
  raise exception 'Auth test fixture collision; use a fresh disposable staging database';
 end if;
end $$;
-- These two columns suffice for upstream Supabase SQL/RLS fixtures. Do not seed
-- passwords, identities, sessions or provider tokens; no Auth API is exercised.
insert into auth.users (id, email) values
 ('10000000-0000-4000-8000-000000000001', 'admin-test@example.invalid'),
 ('10000000-0000-4000-8000-000000000002', 'editor-test@example.invalid'),
 ('10000000-0000-4000-8000-000000000003', 'outsider-test@example.invalid'),
 ('10000000-0000-4000-8000-000000000004', 'inactive-test@example.invalid');
insert into public.admin_users(user_id, role, active) values
 ('10000000-0000-4000-8000-000000000001', 'admin', true),
 ('10000000-0000-4000-8000-000000000002', 'editor', true),
 ('10000000-0000-4000-8000-000000000004', 'admin', false);

-- Clear any SQL Editor impersonation/previous request claims within this transaction.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$ begin
 begin perform * from public.admin_users; raise exception 'Anonymous membership read unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.get_admin_context(); raise exception 'Anonymous RPC unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"}}', true);
do $$ begin
 if current_user <> 'authenticated' or auth.uid() is distinct from '10000000-0000-4000-8000-000000000003'::uuid or (current_setting('request.jwt.claims',true)::jsonb->>'sub') is distinct from '10000000-0000-4000-8000-000000000003' then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ begin
 if exists (select 1 from public.admin_users) then raise exception 'Outsider can read membership'; end if;
 if private.has_staff_role(array['admin','editor']) then raise exception 'Metadata grants staff role'; end if;
 begin perform public.get_admin_context(); raise exception 'Outsider RPC unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.admin_users(user_id, role) values(auth.uid(), 'admin');
   raise exception 'Self enrollment unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
 if current_user <> 'authenticated' or auth.uid() is distinct from '10000000-0000-4000-8000-000000000002'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ begin
 if (select count(*) from public.admin_users) <> 1 then raise exception 'Editor can read other memberships'; end if;
 if (public.get_admin_context()->>'role') is distinct from 'editor' then raise exception 'Incorrect editor role'; end if;
 if private.has_staff_role(array['admin']) then raise exception 'Editor has admin permissions'; end if;
 if not private.has_staff_role(array['admin','editor']) then raise exception 'Editor staff permission missing'; end if;
 begin update public.admin_users set role = 'admin' where user_id = auth.uid(); raise exception 'Editor role escalation allowed';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
 if current_user <> 'authenticated' or auth.uid() is distinct from '10000000-0000-4000-8000-000000000001'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ begin
 if (public.get_admin_context()->>'role') is distinct from 'admin' then raise exception 'Incorrect admin role'; end if;
 if not private.has_staff_role(array['admin']) then raise exception 'Admin permission missing'; end if;
 if (select count(*) from public.admin_users) <> 1 then raise exception 'Admin can list memberships'; end if;
 begin update public.admin_users set active = false; raise exception 'Client admin can change memberships';
 exception when insufficient_privilege then null; end;
 begin delete from public.admin_users; raise exception 'Client admin can delete memberships';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$ begin
 if current_user <> 'authenticated' or auth.uid() is distinct from '10000000-0000-4000-8000-000000000004'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ begin
 if exists (select 1 from public.admin_users) then raise exception 'Inactive staff can read membership'; end if;
 if private.has_staff_role(array['admin','editor']) then raise exception 'Inactive staff authorized'; end if;
 begin perform public.get_admin_context(); raise exception 'Inactive staff RPC unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
-- A formerly active admin must lose permission without changing the JWT subject.
reset role;
update public.admin_users set active = false
where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
 if current_user <> 'authenticated' or auth.uid() is distinct from '10000000-0000-4000-8000-000000000001'::uuid then raise exception 'JWT/role simulation mismatch'; end if;
end $$;
do $$ begin
 if private.has_staff_role(array['admin']) then raise exception 'Revocation did not take effect'; end if;
 begin perform public.get_admin_context(); raise exception 'Revoked admin RPC unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
-- Exercise the current PostgREST JSON-claims path without a legacy subject GUC.
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
 if auth.uid() is distinct from '10000000-0000-4000-8000-000000000001'::uuid then raise exception 'JSON-only auth.uid simulation failed'; end if;
 if private.has_staff_role(array['admin']) then raise exception 'JSON-only claims bypass revocation'; end if;
end $$;
reset role;
rollback;
