-- =====================================================================
-- Migration 001: real user accounts
-- Sprint story: individual accounts with login; each user reaches only their own data.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this whole file → Run.
-- Run it ONCE, on a database already built with schema.sql.
-- Do NOT re-run schema.sql afterwards (it would undo this).
--
-- What it does:
--   1. Removes the demo people (Chase, Mia, Jake...) and everything tied to them.
--   2. Splits profiles into PUBLIC (profiles) and PRIVATE (profile_private) tables.
--   3. Requires every signup field, enforced by the database (not just the form).
--   4. Creates the profile automatically when someone signs up (Supabase Auth).
--   5. Makes "member since" (profiles.created_at) public and permanent.
--   6. Replaces the "demo:" security policies with per-user ones.
-- =====================================================================

begin;

-- ---------- 1. Remove demo people ----------
-- Cascades to their activities, RSVPs, posts, habits, friendships, messages.
-- (Activities your team posted through the site were hosted by "Chase", so they go too.)
delete from profiles where id::text like 'aaaaaaaa-%';

-- ---------- 2. Public vs private profile data ----------
-- profiles         = what other signed-in users may see
-- profile_private  = only the account owner (1-to-1 with profiles)
create table profile_private (
  profile_id    uuid primary key references profiles (id) on delete cascade,
  last_name     text not null check (char_length(trim(last_name)) between 1 and 60),
  email         text not null,                        -- copied from the login email
  phone         text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15),
  home_address  text not null check (char_length(trim(home_address)) between 5 and 200),
  zip_code      text not null check (zip_code ~ '^[0-9]{5}$'),
  sex           text not null check (sex in ('male', 'female', 'prefer_not_to_say')),
  birthdate     date not null,                        -- 18+ is checked by trigger below
  latitude      numeric(8,5),                         -- private: could locate someone's home
  longitude     numeric(8,5),
  avatar_url    text                                  -- private for now; "friends only" comes with photo uploads
);

alter table profiles
  drop column last_name,
  drop column email,
  drop column phone,
  drop column home_address,
  drop column birthday,
  drop column gender,
  drop column latitude,
  drop column longitude,
  drop column avatar_url,
  add column state text;

-- Every profile must now belong to a real login, and the public fields are required.
alter table profiles
  alter column auth_user_id set not null,
  alter column city set not null,
  alter column state set not null,
  add constraint profiles_first_name_required check (char_length(trim(first_name)) between 1 and 40),
  add constraint profiles_city_required check (char_length(trim(city)) between 1 and 60),
  add constraint profiles_state_format check (state ~ '^[A-Z]{2}$');

-- Lets the signup trigger create the profile in the same moment the login is created.
alter table profiles
  alter constraint profiles_auth_user_id_fkey deferrable initially deferred;

-- ---------- 3. Rules the database enforces ----------

-- 18 or older (birthdate is required and checked on every insert/update).
create function public.momentum_check_adult() returns trigger
language plpgsql as $$
begin
  if new.birthdate > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to use Momentum.' using errcode = 'check_violation';
  end if;
  if new.birthdate < date '1900-01-01' then
    raise exception 'Enter a real birthdate.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profile_private_adult before insert or update of birthdate on profile_private
  for each row execute function public.momentum_check_adult();

-- "Member since" and identity columns can never change, not even by the owner.
create function public.momentum_lock_profile_identity() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Account ID and member-since date can''t be changed.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profiles_lock_identity before update on profiles
  for each row execute function public.momentum_lock_profile_identity();

-- ---------- 4. Create the profile automatically at signup ----------
-- The website passes the signup form fields as "user metadata". This runs as the
-- login row is created: it validates everything, writes profiles + profile_private +
-- user_settings, then strips the private fields back out of the login record so the
-- sensitive data lives in exactly one place.
-- If any field is missing or invalid, the whole signup fails (no half-made accounts).
create function public.momentum_handle_new_user() returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pid uuid;
begin
  insert into public.profiles (auth_user_id, username, first_name, city, state)
  values (
    new.id,
    'user_' || left(replace(new.id::text, '-', ''), 12),
    trim(m->>'first_name'),
    trim(m->>'city'),
    upper(trim(m->>'state'))
  )
  returning id into pid;

  insert into public.profile_private (profile_id, last_name, email, phone, home_address, zip_code, sex, birthdate)
  values (
    pid,
    trim(m->>'last_name'),
    new.email,
    trim(m->>'phone'),
    trim(m->>'home_address'),
    trim(m->>'zip_code'),
    m->>'sex',
    (m->>'birthdate')::date
  );

  insert into public.user_settings (profile_id) values (pid);

  -- Keep only the first name in the login record.
  new.raw_user_meta_data := jsonb_build_object('first_name', trim(m->>'first_name'));
  return new;
end $$;

create trigger on_auth_user_created before insert on auth.users
  for each row execute function public.momentum_handle_new_user();

-- Helper used by the security policies: "the profile of whoever is signed in".
create function public.current_profile_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.profiles where auth_user_id = auth.uid() $$;

-- ---------- 5 & 6. Security policies ----------
-- Remove the demo policies from schema.sql.
drop policy if exists "demo: read profiles" on profiles;
drop policy if exists "demo: anyone posts activities" on activities;
drop policy if exists "demo: anyone saves an address" on activity_addresses;
drop policy if exists "read public activities" on activities;

alter table profile_private enable row level security;

-- Visitors who aren't signed in get nothing from the people/activity tables.
revoke all on profiles, profile_private, user_settings, activities, activity_addresses from anon;

-- profiles: every signed-in user can read the public card (incl. member since).
-- You can edit only your own, and only these columns.
revoke update on profiles from authenticated;
grant update (first_name, city, state, bio) on profiles to authenticated;
create policy "signed-in users read public profiles" on profiles
  for select to authenticated using (true);
create policy "edit own profile" on profiles
  for update to authenticated using (id = public.current_profile_id()) with check (id = public.current_profile_id());

-- profile_private: owner only. Email changes go through Supabase Auth, not here.
revoke all on profile_private from authenticated;
grant select on profile_private to authenticated;
grant update (last_name, phone, home_address, zip_code, sex, birthdate, latitude, longitude) on profile_private to authenticated;
create policy "read own private profile" on profile_private
  for select to authenticated using (profile_id = public.current_profile_id());
create policy "edit own private profile" on profile_private
  for update to authenticated using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- user_settings: owner only.
create policy "read own settings" on user_settings
  for select to authenticated using (profile_id = public.current_profile_id());
create policy "edit own settings" on user_settings
  for update to authenticated using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- activities: signed-in users read public ones (and their own); you can only host as yourself.
create policy "signed-in users read activities" on activities
  for select to authenticated using (visibility = 'public' or host_id = public.current_profile_id());
create policy "post activities as yourself" on activities
  for insert to authenticated with check (host_id = public.current_profile_id());

-- activity_addresses: only the host can write or read (committed attendees come with the RSVP story).
create policy "host saves address" on activity_addresses
  for insert to authenticated
  with check (exists (select 1 from activities a where a.id = activity_id and a.host_id = public.current_profile_id()));
create policy "host reads address" on activity_addresses
  for select to authenticated
  using (exists (select 1 from activities a where a.id = activity_id and a.host_id = public.current_profile_id()));

commit;
