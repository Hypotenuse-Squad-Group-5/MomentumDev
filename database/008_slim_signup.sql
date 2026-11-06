-- =====================================================================
-- Migration 008: slimmer sign-up, and permanently delete the extra personal data
--
-- WHAT THIS CHANGES (plain English):
--   Sign-up now asks for only: first name, last name, birthday, sex, email, password.
--   1. The sign-up function stops reading phone, home address, zip, city, and state.
--   2. These columns are DROPPED, so the data is gone for every existing account:
--        profiles:         city, state
--        profile_private:  phone, home_address, zip_code, latitude, longitude
--      (Activities keep their own city and address. Those are about events, not people.)
--   3. Edit permissions are re-stated for what's left:
--        profiles:         first_name, bio, avatar_url
--        profile_private:  last_name, sex, birthdate
--   Birthday stays private and is still used for the 18+ check.
--
-- ORDER MATTERS: publish the updated website files FIRST, then run this right after.
--   (The old website asks the database for city/state and would break after this runs.)
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the summary SELECT at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again.
--   This can't be undone once committed (that's the point: the data is deleted).
--   Re-running after it's committed is safe.
-- =====================================================================

begin;

-- 1. Sign-up function: only the fields we still collect
create or replace function public.momentum_handle_new_user() returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pid uuid;
begin
  insert into public.profiles (auth_user_id, username, first_name)
  values (
    new.id,
    'user_' || left(replace(new.id::text, '-', ''), 12),
    trim(m->>'first_name')
  )
  returning id into pid;

  insert into public.profile_private (profile_id, last_name, email, sex, birthdate)
  values (
    pid,
    trim(m->>'last_name'),
    new.email,
    m->>'sex',
    (m->>'birthdate')::date
  );

  insert into public.user_settings (profile_id) values (pid);

  -- Keep only the first name in the login record.
  new.raw_user_meta_data := jsonb_build_object('first_name', trim(m->>'first_name'));
  return new;
end $$;

-- 2. Permanently remove the columns (and their rules) along with all stored values
alter table public.profiles
  drop column if exists city,
  drop column if exists state;

alter table public.profile_private
  drop column if exists phone,
  drop column if exists home_address,
  drop column if exists zip_code,
  drop column if exists latitude,
  drop column if exists longitude;

-- 3. What signed-in users may edit on their own rows
revoke update on public.profiles from authenticated;
grant update (first_name, bio, avatar_url) on public.profiles to authenticated;
revoke update on public.profile_private from authenticated;
grant update (last_name, sex, birthdate) on public.profile_private to authenticated;

-- PREVIEW: what's left, and proof the removed data is gone
select
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns where table_schema = 'public' and table_name = 'profiles')         as profiles_columns,
  (select string_agg(column_name, ', ' order by ordinal_position)
     from information_schema.columns where table_schema = 'public' and table_name = 'profile_private')  as profile_private_columns,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name in ('profiles', 'profile_private')
      and column_name in ('city', 'state', 'phone', 'home_address', 'zip_code', 'latitude', 'longitude')) as removed_columns_left,
  (select string_agg(column_name || ' (' || table_name || ')', ', ' order by table_name, column_name)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name in ('profiles', 'profile_private')
      and grantee = 'authenticated' and privilege_type = 'UPDATE')                                      as users_can_edit,
  (pg_get_functiondef('public.momentum_handle_new_user'::regproc) !~ 'phone|home_address|zip_code|city|state') as signup_uses_only_new_fields,
  (select count(*) from public.profiles)                                                                 as accounts_kept;

-- commit;
