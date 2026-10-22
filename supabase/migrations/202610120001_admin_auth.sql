begin;

create table public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('admin', 'editor')),
    active boolean not null default true,
    created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- No client, including an admin, may provision staff or modify roles.
revoke all on table public.admin_users from public, anon, authenticated;
grant select on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;
create policy "active staff may read their own membership"
    on public.admin_users for select to authenticated
    using (user_id = (select auth.uid()) and active);

-- Reusable helper for future RLS policies; always queries current membership.
-- This schema must NOT be included in the Data API exposed schemas.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.has_staff_role(allowed_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
    select exists (
        select 1 from public.admin_users
        where user_id = (select auth.uid()) and active and role = any(allowed_roles)
    );
$$;
revoke all on function private.has_staff_role(text[]) from public, anon;
grant execute on function private.has_staff_role(text[]) to authenticated;

-- Actual authenticated database operation for the dashboard foundation.
-- SECURITY INVOKER preserves the caller's RLS restrictions; no JWT role metadata is trusted.
create function public.get_admin_context()
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare membership public.admin_users%rowtype;
begin
    select * into membership from public.admin_users
    where user_id = (select auth.uid()) and active;
    if not found then
        raise exception 'Staff access required' using errcode = '42501';
    end if;
    return jsonb_build_object('user_id', membership.user_id, 'role', membership.role);
end;
$$;
revoke all on function public.get_admin_context() from public, anon;
grant execute on function public.get_admin_context() to authenticated;

comment on table public.admin_users is 'Explicit employee allowlist; provision only through privileged server/SQL operations.';
commit;
