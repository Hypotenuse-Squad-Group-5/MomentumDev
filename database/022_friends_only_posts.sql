-- =====================================================================
-- Migration 022: Friends-only posts
--
-- WHAT THIS CHANGES:
--   1. Migrates all existing posts in public.posts to visibility = 'friends'.
--   2. Updates default for public.posts.visibility to 'friends'.
--   3. Updates check constraint on public.posts to strictly enforce visibility = 'friends'.
--   4. Updates user_settings.post_visibility default and constraint to 'friends'.
--   5. Updates Row Level Security (RLS) on public.posts:
--        - Signed-in authors can read their own posts.
--        - Accepted friends can read the author's posts.
--        - Non-friends and anonymous users cannot read posts.
--
-- HOW TO RUN:
--   Run in the Supabase SQL editor. Re-running is safe.
-- =====================================================================

begin;

-- ---------- 1. Data Migration ----------
update public.posts set visibility = 'friends';
update public.user_settings set post_visibility = 'friends';

-- ---------- 2. Column Defaults & Constraints ----------
alter table public.posts alter column visibility set default 'friends';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility = 'friends');

alter table public.user_settings alter column post_visibility set default 'friends';
alter table public.user_settings drop constraint if exists user_settings_post_visibility_check;
alter table public.user_settings add constraint user_settings_post_visibility_check check (post_visibility = 'friends');

-- ---------- 3. Update Row Level Security (RLS) ----------
drop policy if exists "read public or own posts" on public.posts;
drop policy if exists "signed-in users read posts" on public.posts;
drop policy if exists "anyone reads public posts" on public.posts;
drop policy if exists "read friends or own posts" on public.posts;

create policy "read friends or own posts" on public.posts
  for select to authenticated
  using (
    author_id = public.current_profile_id()
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = public.current_profile_id() and f.addressee_id = posts.author_id)
          or (f.addressee_id = public.current_profile_id() and f.requester_id = posts.author_id)
        )
    )
  );

commit;
