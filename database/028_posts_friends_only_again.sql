-- =====================================================================
-- Migration 028: posts are friends-only again (decided 2026-11-16)
--
-- 022_friends_only_posts made every post friends-only. Two later files (written on another
-- branch at the same time) loosened that in the live database:
--   025 (was 023) added a read rule that also lets anyone read 'public' posts, and let
--       authors change a post's visibility
--   026 (was 024) let the Posts setting be 'public' again
-- This puts 022's design back. The Settings page no longer has a Posts setting, and new
-- posts are always saved as friends-only.
-- Nothing else from 025 changes (cancelling activities, notifications, delete account stay).
--
-- HOW TO RUN (preview first):
--   Run as-is: the summary at the bottom shows the post rules and any non-friends values.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- Posts: only 022's read rule ("read friends or own posts") stays
drop policy if exists "read posts you're allowed to see" on public.posts;
drop policy if exists "change own post visibility" on public.posts;
revoke update on public.posts from authenticated;

-- Any post that slipped through as something else becomes friends-only
update public.posts set visibility = 'friends' where visibility <> 'friends';

-- The Posts setting goes back to 022's rule (the page no longer shows it)
update public.user_settings set post_visibility = 'friends' where post_visibility is distinct from 'friends';
alter table public.user_settings alter column post_visibility set default 'friends';
alter table public.user_settings drop constraint if exists user_settings_post_visibility_check;
alter table public.user_settings add constraint user_settings_post_visibility_check check (post_visibility = 'friends');

-- PREVIEW
select
  (select string_agg(polname || ' (' || case polcmd when 'r' then 'read' when 'a' then 'add' when 'w' then 'update' when 'd' then 'delete' else polcmd::text end || ')', ', ' order by polname)
     from pg_policy where polrelid = 'public.posts'::regclass)                                   as post_rules,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.posts'::regclass and conname = 'posts_visibility_check') as posts_rule,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.user_settings'::regclass and conname = 'user_settings_post_visibility_check') as setting_rule,
  (select count(*) from public.posts where visibility <> 'friends')                              as non_friends_posts_left;

-- commit;
