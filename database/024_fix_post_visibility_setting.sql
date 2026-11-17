-- =====================================================================
-- Migration 024: fix the "Posts" default in Settings
--
-- Saving the Posts default failed with:
--   new row for relation "user_settings" violates check constraint "user_settings_post_visibility_check"
-- The site sends 'public' or 'friends' (the same two choices as posts and activities,
-- see 019), so the live rule must have been changed to something else by hand.
-- This puts it back to exactly those two choices. Anyone with an old value is moved:
-- friends_of_friends -> public, anything else -> friends.
--
-- HOW TO RUN (preview first):
--   Run as-is: the summary shows the rule BEFORE and AFTER. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

create temp table rule_before on commit drop as
select coalesce((select pg_get_constraintdef(oid) from pg_constraint
                  where conrelid = 'public.user_settings'::regclass and conname = 'user_settings_post_visibility_check'),
                '(no rule)') as rule,
       (select string_agg(post_visibility || ': ' || n, ', ' order by post_visibility)
          from (select post_visibility, count(*) n from public.user_settings group by 1) x) as values_in_use;

update public.user_settings
   set post_visibility = case when post_visibility = 'friends_of_friends' then 'public' else 'friends' end
 where post_visibility is null or post_visibility not in ('public', 'friends');

alter table public.user_settings drop constraint if exists user_settings_post_visibility_check;
alter table public.user_settings add constraint user_settings_post_visibility_check
  check (post_visibility in ('public', 'friends'));

-- PREVIEW
select
  (select rule from rule_before)          as rule_before,
  (select values_in_use from rule_before) as values_before,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.user_settings'::regclass and conname = 'user_settings_post_visibility_check') as rule_after,
  (select string_agg(post_visibility || ': ' || n, ', ' order by post_visibility)
     from (select post_visibility, count(*) n from public.user_settings group by 1) x) as values_after;

-- commit;
