-- =====================================================================
-- Migration 006: lock down posts (fixes the open policies from 004)
--
-- WHAT WAS WRONG (plain English):
--   004's policies were all `true`, so the database let ANYONE, even someone
--   who isn't logged in, using the public key from config.js:
--     - post under someone else's name   (insert: with check (true))
--     - delete anyone's post              (delete: using (true))
--     - read every post, including future "friends"/"private" ones (select: using (true))
--   The website hid the Delete button on other people's posts, but that check
--   runs in the browser and anyone can skip it. The database is the real lock.
--
-- WHAT THIS CHANGES:
--   Read:    signed-in users see public posts, plus all of their own.
--   Create:  signed-in users only, and only as themselves.
--   Delete:  only your own posts.
--   Edit:    still not allowed for anyone (same as 004).
--   Logged-out visitors get no access to posts at all.
--   (Friends-only visibility comes later, once friendships are in the database.)
--
-- WEBSITE: no code changes needed. The site already posts as you and only
--          offers Delete on your own posts; now the database enforces it too.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the summary SELECT at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again.
--   Re-running is safe.
-- =====================================================================

begin;

-- 1. Remove 004's open policies (and this file's, so re-running is safe)
drop policy if exists "anyone reads public posts"    on public.posts;
drop policy if exists "anyone inserts public posts"  on public.posts;
drop policy if exists "authors delete posts"         on public.posts;
drop policy if exists "read public or own posts"     on public.posts;
drop policy if exists "create own posts"             on public.posts;
drop policy if exists "delete own posts"             on public.posts;

alter table public.posts enable row level security;

-- 2. New policies: signed-in users, own rows for anything that changes data
create policy "read public or own posts" on public.posts
  for select to authenticated
  using (visibility = 'public' or author_id = public.current_profile_id());

create policy "create own posts" on public.posts
  for insert to authenticated
  with check (author_id = public.current_profile_id());

create policy "delete own posts" on public.posts
  for delete to authenticated
  using (author_id = public.current_profile_id());

-- 3. Table permissions: logged-out visitors get nothing; signed-in users can't edit
revoke all on public.posts from anon;
revoke all on public.posts from authenticated;
grant select, insert, delete on public.posts to authenticated;

-- PREVIEW: what the posts table's security looks like now
select
  (select json_agg(json_build_object(
            'policy', polname,
            'action', case polcmd when 'r' then 'read' when 'a' then 'create' when 'd' then 'delete' when 'w' then 'edit' else 'all' end,
            'rule',   coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)))
          order by polname)
     from pg_policy where polrelid = 'public.posts'::regclass)                          as posts_policies,
  (select string_agg(privilege_type, ', ' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'posts' and grantee = 'authenticated') as signed_in_can,
  coalesce((select string_agg(privilege_type, ', ')
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'posts' and grantee = 'anon'), 'nothing') as logged_out_can,
  (select count(*) from public.posts)                                                   as posts_kept;

-- commit;
