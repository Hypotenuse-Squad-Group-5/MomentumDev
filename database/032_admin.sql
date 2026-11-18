-- =====================================================================
-- Migration 032: admins (the foundation for the Admin page)
--
-- WHO IS AN ADMIN: anyone listed in momentum_private.admins. That table lives in a schema the
-- website can't reach, so nobody can make themselves an admin from the app. Only someone signed
-- in to the Supabase project (SQL editor / Table Editor) can add or remove admins.
--
-- WHAT THIS ADDS
--   momentum_private.admins           who's an admin
--   is_admin()                        true/false for the signed-in user (the website uses it to show
--                                     the Admin mode switch in Settings)
--   momentum_private.require_admin()  every admin function starts with this; it stops non-admins
--   admin_list_admins()               the worked example: lists the admins (Admin page › Admins tab)
--
-- FOR TEAMMATES: copy the admin_list_admins pattern for your own functions (see docs/admin-guide.md):
--   1. momentum_private.<name>(…) security definer, first line: perform momentum_private.require_admin();
--   2. a thin public.<name>(…) wrapper (security invoker) the website calls with Store.admin.call("<name>")
--   3. revoke from public/anon, grant execute to authenticated (require_admin does the real check)
--
-- TO MAKE SOMEONE AN ADMIN (run in the SQL editor, with their sign-in email):
--   insert into momentum_private.admins (profile_id, note)
--   select p.id, 'team member' from public.profiles p join auth.users u on u.id = p.auth_user_id
--    where lower(u.email) = lower('someone@byu.edu')
--   on conflict (profile_id) do nothing;
-- TO REMOVE: delete from momentum_private.admins where profile_id = '<their profile id>';
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

grant usage on schema momentum_private to authenticated;

-- ---------- 1. Who's an admin ----------
create table if not exists momentum_private.admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  note       text
);
alter table momentum_private.admins enable row level security;  -- no policies: no one reads or writes it through the API
revoke all on momentum_private.admins from public, anon, authenticated;

-- ---------- 2. Am I an admin? ----------
create or replace function momentum_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from momentum_private.admins a where a.profile_id = public.current_profile_id());
$$;
revoke all on function momentum_private.is_admin() from public, anon;
grant execute on function momentum_private.is_admin() to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select momentum_private.is_admin(); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- 3. The guard every admin function starts with ----------
create or replace function momentum_private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not momentum_private.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
end $$;
revoke all on function momentum_private.require_admin() from public, anon;
grant execute on function momentum_private.require_admin() to authenticated;

-- ---------- 4. Worked example: list the admins (read-only) ----------
create or replace function momentum_private.admin_list_admins()
returns table (profile_id uuid, first_name text, username text, added_at timestamptz, note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  return query
    select a.profile_id, p.first_name, p.username::text, a.added_at, a.note
      from momentum_private.admins a
      join public.profiles p on p.id = a.profile_id
     order by a.added_at;
end $$;
revoke all on function momentum_private.admin_list_admins() from public, anon;
grant execute on function momentum_private.admin_list_admins() to authenticated;

create or replace function public.admin_list_admins()
returns table (profile_id uuid, first_name text, username text, added_at timestamptz, note text)
language sql stable security invoker set search_path = '' as $$ select * from momentum_private.admin_list_admins(); $$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- PREVIEW: the new pieces, and who's an admin right now (add yourself with the insert above)
select
  to_regclass('momentum_private.admins') is not null as admins_table,
  (select count(*) from pg_proc where proname in ('is_admin', 'require_admin', 'admin_list_admins')) as functions_made,  -- expect 5
  (select string_agg(p.first_name, ', ') from momentum_private.admins a join public.profiles p on p.id = a.profile_id) as admins_now;

-- commit;
