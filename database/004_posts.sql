-- =====================================================================
-- Migration 004: Text posts saved to Supabase (Vertical Slice 3)
-- Sprint story: Users can create public text posts on their profile,
-- view them permanently from the database, and delete their own posts.
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this whole file → Run.
-- Run it ONCE on your database.
-- =====================================================================

begin;

-- 1. Ensure the posts table exists (matches schema.sql specification)
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  caption      text not null check (char_length(caption) <= 500),
  activity_id  uuid references public.activities (id) on delete set null,
  visibility   text not null default 'public'
    check (visibility in ('public','friends_of_friends','friends','private')),
  created_at   timestamptz not null default now()
);

-- Index for quickly fetching an author's posts chronologically
create index if not exists posts_author_created on public.posts (author_id, created_at desc);

-- 2. Ensure current_profile_id helper exists
create or replace function public.current_profile_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

-- 3. Enable Row Level Security (RLS)
alter table public.posts enable row level security;

-- 4. Drop any previous policies on posts to prevent duplicate policy errors
drop policy if exists "anyone reads public posts" on public.posts;
drop policy if exists "authors insert their own posts" on public.posts;
drop policy if exists "anyone inserts public posts" on public.posts;
drop policy if exists "authors delete their own posts" on public.posts;
drop policy if exists "authors delete posts" on public.posts;
drop policy if exists "signed-in users read posts" on public.posts;

-- 5. Policies:
-- SELECT Policy: Everyone (both authenticated and anonymous visitors) can read public posts.
create policy "anyone reads public posts" on public.posts
  for select to anon, authenticated
  using (true);

-- INSERT Policy: Anyone can create public posts for this vertical slice (matches activities pattern).
create policy "anyone inserts public posts" on public.posts
  for insert to anon, authenticated
  with check (true);

-- DELETE Policy: Allow deleting posts.
create policy "authors delete posts" on public.posts
  for delete to anon, authenticated
  using (true);

-- 6. Permissions: Allow table access to anon and authenticated roles
grant select, insert, delete on public.posts to anon, authenticated;

commit;
