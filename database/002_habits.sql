-- =====================================================================
-- Migration 002: habits, check-ins, and points live in the database
-- Sprint story: sync habits/goals to the database.
--
-- HOW TO RUN: Supabase → SQL Editor → paste this whole file → Run. Once.
--
--   PART A (done): point_values table, today-only rule, points awarded by the database
--   PART B (done): "own rows only" security policies for habits and habit_checkins
--
-- RLS is already ON for these tables (schema.sql). RLS with no policies = locked;
-- Part B opens exactly "your own habits" and nothing else.
-- =====================================================================

begin;

-- ---------- PART A1. Point values: one row per action, editable by admins ----------
-- Change a number in Supabase Table Editor and it applies to points earned from then on.
-- Points already earned keep the value they were earned at.
create table point_values (
  kind        text primary key
    check (kind in ('habit','lesson','rsvp','attended','post','rsvp_cancelled')),
  points      smallint not null,
  label       text not null,                 -- what the website shows
  updated_at  timestamptz not null default now()
);
insert into point_values (kind, points, label) values
  ('habit',           10, 'Habit checked'),
  ('lesson',          25, 'Lesson finished'),
  ('rsvp',            15, 'Committed to an activity'),
  ('attended',        25, 'Went to an activity'),
  ('post',             5, 'First post of the day'),
  ('rsvp_cancelled', -15, 'Cancelled a commitment');

alter table point_values enable row level security;
create policy "signed-in users read point values" on point_values
  for select to authenticated using (true);
-- No insert/update/delete policies: only admins (dashboard) can change values.

create function public.momentum_touch_point_values() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger point_values_touch before update on point_values
  for each row execute function public.momentum_touch_point_values();

-- ---------- PART A2. "Today" means today in Utah ----------
create function public.momentum_today() returns date
language sql stable as $$ select (now() at time zone 'America/Denver')::date $$;

-- ---------- PART A3. Check-ins: today only, points awarded by the database ----------
-- Checking a habit: must be for today. Awards habit points (value read from point_values).
-- Unchecking: only today's check-in can be removed, and its points go with it.
create function public.momentum_habit_checkin_points() returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    if new.check_date <> public.momentum_today() then
      raise exception 'Habits can only be checked off for today.' using errcode = 'check_violation';
    end if;
    select profile_id into owner from public.habits where id = new.habit_id;
    insert into public.point_events (profile_id, kind, points, habit_id, occurred_on)
    select owner, 'habit', pv.points, new.habit_id, new.check_date
    from public.point_values pv where pv.kind = 'habit';
    return new;
  else -- DELETE
    if old.check_date <> public.momentum_today() then
      raise exception 'Past check-ins can''t be undone.' using errcode = 'check_violation';
    end if;
    delete from public.point_events
     where kind = 'habit' and habit_id = old.habit_id and occurred_on = old.check_date;
    return old;
  end if;
end $$;

-- The website doesn't send a date; the database fills in today (Utah time).
alter table habit_checkins alter column check_date set default public.momentum_today();

create trigger habit_checkins_points_ins before insert on habit_checkins
  for each row execute function public.momentum_habit_checkin_points();
create trigger habit_checkins_points_del before delete on habit_checkins
  for each row execute function public.momentum_habit_checkin_points();

-- ---------- PART A4. Points: read your own, never write directly ----------
-- The website can't insert points (that would let anyone award themselves 10,000).
-- Only the trigger above (and future ones) create point_events rows.
create policy "read own points" on point_events
  for select to authenticated using (profile_id = public.current_profile_id());

-- ---------- PART A5. Habits can be archived, not deleted (keeps streak history) ----------
revoke delete on habits from authenticated;

-- =====================================================================
-- PART B. Security policies: everyone reaches only their own habits.
--
-- How to read a policy:
--   on <table>            which table the rule protects
--   for <command>         select (read), insert (add), update (change), delete (remove)
--   to authenticated      applies to signed-in users
--   using (...)           which EXISTING rows they're allowed to see/touch
--   with check (...)      what a NEW or CHANGED row must look like to be allowed
--   current_profile_id()  "the profile of whoever is signed in" (migration 001)
-- =====================================================================

-- B1. habits: read, add, and change only your own. No delete (habits get archived).
create policy "read own habits" on habits
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy "add own habits" on habits
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

create policy "change own habits" on habits
  for update to authenticated
  using      (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- B2. habit_checkins has no owner column, only habit_id, so each rule asks
-- "does this check-in's habit belong to me?" (same idea as activity_addresses in 001).
create policy "read own check-ins" on habit_checkins
  for select to authenticated
  using (exists (select 1 from habits h where h.id = habit_id and h.profile_id = public.current_profile_id()));

create policy "add check-ins to own active habits" on habit_checkins
  for insert to authenticated
  with check (exists (select 1 from habits h where h.id = habit_id and h.profile_id = public.current_profile_id() and h.is_active));

create policy "remove own check-ins" on habit_checkins
  for delete to authenticated
  using (exists (select 1 from habits h where h.id = habit_id and h.profile_id = public.current_profile_id()));

commit;
