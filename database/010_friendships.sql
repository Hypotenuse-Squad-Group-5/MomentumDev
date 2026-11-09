-- =====================================================================
-- Migration 010: Friendships and friend requests in Supabase
-- (Originally drafted as 008_friendships.sql on friend_request; already
--  applied to Momentum DB. Retained here with sequential prefix 010 so it
--  does not collide with 008_slim_signup.sql / 008_reflection_character_limit.sql.)
--
-- WHAT THIS CHANGES (plain English):
--   1. Ensures the `friendships` table exists and links to `public.profiles`.
--   2. Enables Row Level Security (RLS) on `friendships`.
--   3. Configures 4 security policies:
--        - Read:    Users see only friendships where they are the requester OR addressee.
--        - Create:  Users can send friend requests as themselves with status 'pending'.
--        - Update:  Only the recipient can accept a friend request (setting status to 'accepted').
--        - Delete:  Either party can cancel a request, decline a request, or remove a friend.
--   4. Grants permissions to authenticated users and revokes from anon visitors.
--
-- HOW TO RUN (preview first):
--   1. Run as-is: executes inside a transaction (BEGIN) and displays
--      the PREVIEW summary table at the bottom showing policies and grants.
--      Nothing is permanently saved yet.
--   2. Review the preview output.
--   3. If everything looks good, uncomment `commit;` on the last line and click Run.
--   Re-running is completely safe (idempotent).
-- =====================================================================

begin;

-- ---------- 1. Ensure friendships table exists with required structure ----------
create table if not exists public.friendships (
  id                  uuid primary key default gen_random_uuid(),
  requester_id        uuid not null references public.profiles (id) on delete cascade,
  addressee_id        uuid not null references public.profiles (id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending','accepted')),
  met_at_activity_id  uuid,
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  check (requester_id <> addressee_id)
);

-- Unique index: only one friendship record per pair (in either direction)
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ---------- 2. Row Level Security on friendships ----------
alter table public.friendships enable row level security;

-- Drop existing policies if re-running
drop policy if exists "users read own friendships" on public.friendships;
drop policy if exists "users send friend requests" on public.friendships;
drop policy if exists "recipients accept friend requests" on public.friendships;
drop policy if exists "parties delete friendships" on public.friendships;

-- 1. Read: you can only see friendships/requests involving yourself
create policy "users read own friendships" on public.friendships
  for select to authenticated
  using (
    requester_id = public.current_profile_id()
    or addressee_id = public.current_profile_id()
  );

-- 2. Insert: you can only send requests from yourself as 'pending'
create policy "users send friend requests" on public.friendships
  for insert to authenticated
  with check (
    requester_id = public.current_profile_id()
    and requester_id <> addressee_id
    and status = 'pending'
  );

-- 3. Update: only the recipient can accept a friend request
create policy "recipients accept friend requests" on public.friendships
  for update to authenticated
  using (
    addressee_id = public.current_profile_id()
  )
  with check (
    addressee_id = public.current_profile_id()
    and status = 'accepted'
  );

-- 4. Delete: either person can cancel a pending request, decline, or unfriend
create policy "parties delete friendships" on public.friendships
  for delete to authenticated
  using (
    requester_id = public.current_profile_id()
    or addressee_id = public.current_profile_id()
  );

-- ---------- 3. Grants and permissions ----------
revoke all on public.friendships from anon;
revoke all on public.friendships from authenticated;
grant select, insert, update, delete on public.friendships to authenticated;

-- ---------- 4. PREVIEW: inspect security before committing ----------
select
  (select json_agg(json_build_object(
            'policy', polname,
            'action', case polcmd when 'r' then 'read' when 'a' then 'create' when 'd' then 'delete' when 'w' then 'edit/accept' else 'all' end,
            'rule',   coalesce(pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)))
          order by polname)
     from pg_policy where polrelid = 'public.friendships'::regclass) as friendships_policies,
  (select string_agg(privilege_type, ', ' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'friendships' and grantee = 'authenticated') as signed_in_can,
  coalesce((select string_agg(privilege_type, ', ')
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'friendships' and grantee = 'anon'), 'nothing') as logged_out_can,
  (select count(*) from public.friendships) as friendships_count;

-- When you are ready to permanently save these changes, uncomment the line below and run again:
-- commit;

