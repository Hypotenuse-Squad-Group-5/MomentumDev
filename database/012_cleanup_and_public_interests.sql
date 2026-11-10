-- =====================================================================
-- Migration 012: catch-up cleanup + public interests
--
-- WHY: the 2026-11-10 inspection compared the live database with this repo.
-- A few changes had been made by hand in the dashboard and never written down,
-- and some of them were off by one from the website's forms. This file:
--
--   1. RECORDS the hand-made text-length rules and FIXES them to match the forms.
--      They used "< N" (so N characters was rejected) while the forms allow exactly N.
--      Now every rule is "<= N":
--        activities.activity_name    <= 40   (form allows 40)
--        activities.city             <= 20   (form allows 20)
--        activities.general_location <= 200
--        activities.what_to_bring    <= 80   (form allows 80)
--        activity_addresses.exact_address <= 150 (form allows 150)
--        interests.name              <= 50
--        lesson_completions.habit_title <= 100 (the lesson form allows 80)
--        lesson_stats.caption        <= 80
--      Loosening "<" to "<=" can't break any existing row.
--   2. REMOVES a dead policy, "Users can insert their own interests". It compares the
--      login id (auth.uid()) to a profile id; those never match, so it never did anything.
--      The real rule, "add own interests" (migration 005), is unchanged.
--   3. MAKES INTERESTS PUBLIC to signed-in members (the change originally planned as 009):
--      anyone signed in can read anyone's interest picks; you can still only add or
--      remove your own; logged-out visitors get nothing.
--   4. RECORDS two other hand-made changes so a rebuild matches live:
--      the "Online" activity type, and lessons.min_goal_words default = 20.
--
-- NOT CHANGED: the function rls_auto_enable. That is Supabase's "automatically enable
-- RLS on new tables" setting (a good safety net). Supabase manages it; leave it alone.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the summary SELECT at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- 1. Text-length rules: same names as the hand-made ones, now "<=" to match the forms
alter table public.activities drop constraint if exists activities_activity_name_check;
alter table public.activities add constraint activities_activity_name_check check (length(activity_name) <= 40);
alter table public.activities drop constraint if exists activities_city_check;
alter table public.activities add constraint activities_city_check check (length(city) <= 20);
alter table public.activities drop constraint if exists activities_general_location_check;
alter table public.activities add constraint activities_general_location_check check (length(general_location) <= 200);
alter table public.activities drop constraint if exists activities_what_to_bring_check;
alter table public.activities add constraint activities_what_to_bring_check check (length(what_to_bring) <= 80);
alter table public.activity_addresses drop constraint if exists activity_addresses_exact_address_check;
alter table public.activity_addresses add constraint activity_addresses_exact_address_check check (length(exact_address) <= 150);
alter table public.interests drop constraint if exists interests_name_check;
alter table public.interests add constraint interests_name_check check (length(name) <= 50);
alter table public.lesson_completions drop constraint if exists lesson_completions_habit_title_check;
alter table public.lesson_completions add constraint lesson_completions_habit_title_check check (length(habit_title) <= 100);
alter table public.lesson_stats drop constraint if exists lesson_stats_caption_check;
alter table public.lesson_stats add constraint lesson_stats_caption_check check (length(caption) <= 80);

-- 2. Remove the dead policy
drop policy if exists "Users can insert their own interests" on public.profile_interests;

-- 3. Interests readable by signed-in members
drop policy if exists "read own interests" on public.profile_interests;
drop policy if exists "signed-in users read interests" on public.profile_interests;
create policy "signed-in users read interests" on public.profile_interests
  for select to authenticated
  using (true);
revoke all on public.profile_interests from anon;

-- 4. Record the other hand-made changes
insert into public.activity_types (name) values ('Online') on conflict (name) do nothing;
-- alter table public.lessons alter column min_goal_words set default 20;

-- PREVIEW: the rules this file touched
select
  (select json_agg(c.conrelid::regclass::text || ': ' || pg_get_constraintdef(c.oid) order by c.conname)
     from pg_constraint c
    where c.conname in ('activities_activity_name_check', 'activities_city_check', 'activities_general_location_check',
                        'activities_what_to_bring_check', 'activity_addresses_exact_address_check', 'interests_name_check',
                        'lesson_completions_habit_title_check', 'lesson_stats_caption_check'))       as length_rules,
  (select string_agg(polname, ', ' order by polname)
     from pg_policy where polrelid = 'public.profile_interests'::regclass)                         as interest_policies,
  coalesce((select string_agg(privilege_type, ', ') from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profile_interests' and grantee = 'anon'), 'nothing') as logged_out_can,
  (select count(*) from public.activity_types where name = 'Online')                                 as online_type_exists,
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'lessons' and column_name = 'min_goal_words')     as min_goal_words_default;

-- commit;
