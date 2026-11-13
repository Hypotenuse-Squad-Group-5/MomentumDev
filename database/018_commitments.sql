-- =====================================================================
-- Migration 018: Commitments (RSVPs) live in the database  (group 2, sprint task 4)
--
-- Until now "Commit to this activity" was saved only in the browser that clicked it:
-- the host never saw who was coming, and spot counts were wrong for everyone else.
-- After this file, every commitment, +1 guest, cancellation and "I went" is saved here,
-- and the rules are enforced HERE (the website can't skip them):
--
--   COMMIT     only to a public activity that hasn't started, that you don't host, and
--              that has room. Not if you or the host blocked the other. Not within
--              30 minutes of something else you're committed to (same rule as the site).
--   +1 GUEST   a friend on Momentum (must accept; holds a spot only after accepting) or a
--              first name (counts right away).
--   FULL       the host + committed people + accepted +1s can't go over max_participants.
--   CANCEL     until 3 hours before the start, and at most 2 cancellations per calendar
--              month (Utah time). Each cancellation is logged in rsvp_cancellations, so
--              re-committing and cancelling again still counts.
--   WHO'S GOING  the host and everyone going can see the list. Everyone else sees only
--              the number (the `spots_taken` column added to activities below).
--   ADDRESS    the exact address unlocks for people who are going, not just the host.
--   I WENT     only after the activity ends, once per commitment. "Yes" gains today's
--              "attended" Momentum. The FIRST person who says yes also gains the host
--              today's "hosted" Momentum.
--
-- Also removes record_attended_momentum() from migration 017 (it let anyone claim
-- "attended" Momentum without a commitment; check-in replaces it) and the two original
-- RSVP triggers from schema.sql (they still had the 24-hour cancel rule).
--
-- Commitments saved only in browsers before this are not moved (agreed: test data).
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
--   Then upload the site files right away (the old site's "I went" button stops working).
-- =====================================================================

begin;

-- ---------- 1. Cancellation log (counts toward the 2 per month) ----------
create table if not exists public.rsvp_cancellations (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  activity_id   uuid not null references public.activities (id) on delete cascade,
  cancelled_at  timestamptz not null default now()
);
create index if not exists rsvp_cancellations_profile_idx on public.rsvp_cancellations (profile_id, cancelled_at);
alter table public.rsvp_cancellations enable row level security;
drop policy if exists "read own cancellations" on public.rsvp_cancellations;
create policy "read own cancellations" on public.rsvp_cancellations
  for select to authenticated using (profile_id = public.current_profile_id());
revoke all on public.rsvp_cancellations from anon;
revoke insert, update, delete, truncate on public.rsvp_cancellations from authenticated;
grant select on public.rsvp_cancellations to authenticated;

-- ---------- 2. Helpers (run with full access, return only yes/no or a count) ----------
-- Is this person going? (their own commitment, or an accepted +1 on someone's commitment)
create or replace function momentum_private.is_going(p_activity uuid, p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_profile is not null and (
    exists (select 1 from public.rsvps r where r.activity_id = p_activity and r.profile_id = p_profile and r.status = 'committed')
    or exists (select 1 from public.rsvp_guests g join public.rsvps r on r.id = g.rsvp_id
               where r.activity_id = p_activity and r.status = 'committed' and g.guest_profile_id = p_profile and g.status = 'accepted'));
$$;
create or replace function momentum_private.is_host(p_activity uuid, p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.activities a where a.id = p_activity and a.host_id = p_profile);
$$;
-- Host + committed people + accepted +1s
create or replace function momentum_private.taken(p_activity uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select 1
    + (select count(*) from public.rsvps r where r.activity_id = p_activity and r.status = 'committed')::int
    + (select count(*) from public.rsvp_guests g join public.rsvps r on r.id = g.rsvp_id
        where r.activity_id = p_activity and r.status = 'committed' and g.status = 'accepted')::int;
$$;
-- Can this person see this commitment row? (own, host, going, or invited as its +1)
create or replace function momentum_private.can_see_rsvp(p_rsvp uuid, p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rsvps r where r.id = p_rsvp and (
      r.profile_id = p_profile
      or momentum_private.is_host(r.activity_id, p_profile)
      or (r.status = 'committed' and momentum_private.is_going(r.activity_id, p_profile))
      or exists (select 1 from public.rsvp_guests g where g.rsvp_id = r.id and g.guest_profile_id = p_profile)));
$$;
-- Can this person see this +1 row? (the inviter, the invited friend, the host; people going see accepted +1s)
create or replace function momentum_private.can_see_guest(p_rsvp uuid, p_guest_profile uuid, p_status text, p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_guest_profile = p_profile or exists (
    select 1 from public.rsvps r where r.id = p_rsvp and (
      r.profile_id = p_profile
      or momentum_private.is_host(r.activity_id, p_profile)
      or (p_status = 'accepted' and r.status = 'committed' and momentum_private.is_going(r.activity_id, p_profile))));
$$;
create or replace function momentum_private.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks b
                  where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;
-- Another commitment of this person that overlaps, or is within 30 minutes of, this activity
create or replace function momentum_private.conflict_with(p_activity uuid, p_profile uuid) returns text
language sql stable security definer set search_path = '' as $$
  select o.title from public.activities a, public.activities o
   where a.id = p_activity and o.id <> a.id and momentum_private.is_going(o.id, p_profile)
     and a.starts_at < o.ends_at + interval '30 minutes' and a.ends_at > o.starts_at - interval '30 minutes'
   order by o.starts_at limit 1;
$$;
create or replace function momentum_private.cancels_this_month(p_profile uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.rsvp_cancellations c
   where c.profile_id = p_profile
     and (c.cancelled_at at time zone 'America/Denver') >= date_trunc('month', now() at time zone 'America/Denver');
$$;
revoke all on function momentum_private.is_going(uuid, uuid), momentum_private.is_host(uuid, uuid), momentum_private.taken(uuid),
  momentum_private.can_see_rsvp(uuid, uuid), momentum_private.can_see_guest(uuid, uuid, text, uuid),
  momentum_private.blocked_between(uuid, uuid), momentum_private.conflict_with(uuid, uuid), momentum_private.cancels_this_month(uuid)
  from public, anon;
-- read policies call these as the signed-in user
grant execute on function momentum_private.is_going(uuid, uuid), momentum_private.is_host(uuid, uuid),
  momentum_private.can_see_rsvp(uuid, uuid), momentum_private.can_see_guest(uuid, uuid, text, uuid), momentum_private.taken(uuid)
  to authenticated;

-- "N going" for every activity you can see (PostgREST: select=*,spots_taken)
create or replace function public.spots_taken(a public.activities) returns integer
language sql stable security invoker set search_path = '' as $$ select momentum_private.taken(a.id); $$;
revoke all on function public.spots_taken(public.activities) from public, anon;
grant execute on function public.spots_taken(public.activities) to authenticated;

-- ---------- 3. Who can read what ----------
alter table public.rsvps enable row level security;
alter table public.rsvp_guests enable row level security;
drop policy if exists "see commitments you're part of" on public.rsvps;
create policy "see commitments you're part of" on public.rsvps
  for select to authenticated
  using (momentum_private.can_see_rsvp(id, public.current_profile_id()));
drop policy if exists "see +1s you're part of" on public.rsvp_guests;
create policy "see +1s you're part of" on public.rsvp_guests
  for select to authenticated
  using (momentum_private.can_see_guest(rsvp_id, guest_profile_id, status, public.current_profile_id()));
-- No direct writes: the functions below are the only way in
revoke all on public.rsvps, public.rsvp_guests from anon;
revoke insert, update, delete, truncate on public.rsvps, public.rsvp_guests from authenticated;
grant select on public.rsvps, public.rsvp_guests to authenticated;

-- The exact address unlocks for people going (the host could already read it)
drop policy if exists "people going read address" on public.activity_addresses;
create policy "people going read address" on public.activity_addresses
  for select to authenticated
  using (momentum_private.is_going(activity_id, public.current_profile_id()));

-- ---------- 4. Commit (with an optional +1) ----------
create or replace function momentum_private.commit_to_activity(p_activity uuid, p_friend uuid, p_guest_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  a public.activities%rowtype;
  v_name text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_need int;
  v_conflict text;
  v_rsvp uuid;
begin
  if me is null then raise exception 'Sign in to commit to an activity.' using errcode = '42501', hint = 'login'; end if;
  if p_friend is not null and v_name is not null then raise exception 'Pick one +1, not two.' using errcode = '22023'; end if;
  -- one change at a time per person, then per activity (so two people can't take the last spot)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text, 18));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_activity::text, 18));
  select * into a from public.activities where id = p_activity;
  if not found or a.visibility <> 'public' then raise exception 'That activity couldn''t be found.' using errcode = '22023', hint = 'not_found'; end if;
  if a.host_id = me then raise exception 'You''re hosting this one.' using errcode = '22023'; end if;
  if a.starts_at <= now() then raise exception 'This activity has already started.' using errcode = '22023', hint = 'started'; end if;
  if momentum_private.blocked_between(me, a.host_id) then raise exception 'You can''t join this activity.' using errcode = '42501'; end if;
  if momentum_private.is_going(p_activity, me) then raise exception 'You''re already committed.' using errcode = '22023', hint = 'already'; end if;
  v_conflict := momentum_private.conflict_with(p_activity, me);
  if v_conflict is not null then
    raise exception 'This overlaps or starts within 30 minutes of %.', v_conflict using errcode = '22023', hint = 'conflict';
  end if;
  if p_friend is not null then
    if p_friend = me or p_friend = a.host_id then raise exception 'Pick a different friend as your +1.' using errcode = '22023'; end if;
    if not exists (select 1 from public.friendships f where f.status = 'accepted'
                   and ((f.requester_id = me and f.addressee_id = p_friend) or (f.requester_id = p_friend and f.addressee_id = me))) then
      raise exception 'Your +1 has to be a friend on Momentum.' using errcode = '22023';
    end if;
    if momentum_private.blocked_between(p_friend, a.host_id) then raise exception 'That friend can''t join this activity.' using errcode = '22023'; end if;
    if momentum_private.is_going(p_activity, p_friend) then raise exception 'That friend is already going.' using errcode = '22023'; end if;
  end if;
  if v_name is not null and char_length(v_name) > 40 then raise exception 'Keep your guest''s name to 40 characters.' using errcode = '22023'; end if;
  v_need := 1 + (case when v_name is not null then 1 else 0 end);
  if momentum_private.taken(p_activity) + v_need > a.max_participants then
    raise exception '%', case when v_need > 1 and momentum_private.taken(p_activity) + 1 <= a.max_participants
                              then 'There''s only room for one more person, so you can''t bring a guest.'
                              else 'This activity is full.' end
      using errcode = '22023', hint = 'full';
  end if;

  insert into public.rsvps (activity_id, profile_id, status, created_at, cancelled_at, attended, checked_in_at)
  values (p_activity, me, 'committed', now(), null, null, null)
  on conflict (activity_id, profile_id) do update
    set status = 'committed', created_at = now(), cancelled_at = null, attended = null, checked_in_at = null
  returning id into v_rsvp;
  delete from public.rsvp_guests where rsvp_id = v_rsvp;
  if p_friend is not null then
    insert into public.rsvp_guests (rsvp_id, guest_profile_id, status) values (v_rsvp, p_friend, 'pending');
  elsif v_name is not null then
    insert into public.rsvp_guests (rsvp_id, guest_first_name, status, responded_at) values (v_rsvp, v_name, 'accepted', now());
  end if;
  return jsonb_build_object('ok', true, 'rsvpId', v_rsvp, 'taken', momentum_private.taken(p_activity));
end $$;

-- ---------- 5. Cancel (3 hours before, 2 per month) ----------
create or replace function momentum_private.cancel_commitment(p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  r public.rsvps%rowtype;
  v_starts timestamptz;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text, 18));
  select * into r from public.rsvps where activity_id = p_activity and profile_id = me and status = 'committed';
  if not found then raise exception 'You''re not committed to this activity.' using errcode = '22023'; end if;
  select starts_at into v_starts from public.activities where id = p_activity;
  if v_starts - now() < interval '3 hours' then
    raise exception 'Commitments can''t be cancelled within 3 hours of the start.' using errcode = '22023', hint = 'cancel_window';
  end if;
  if momentum_private.cancels_this_month(me) >= 2 then
    raise exception 'You''ve used both cancellations for this month.' using errcode = '22023', hint = 'no_cancels';
  end if;
  update public.rsvps set status = 'cancelled', cancelled_at = now() where id = r.id;
  delete from public.rsvp_guests where rsvp_id = r.id; -- their +1 goes too
  insert into public.rsvp_cancellations (profile_id, activity_id) values (me, p_activity);
  return jsonb_build_object('ok', true, 'left', greatest(0, 2 - momentum_private.cancels_this_month(me)));
end $$;

-- ---------- 6. Answer a +1 invite ----------
create or replace function momentum_private.respond_plus_one(p_guest uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  g public.rsvp_guests%rowtype;
  a public.activities%rowtype;
  v_conflict text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text, 18));
  select * into g from public.rsvp_guests where id = p_guest and guest_profile_id = me and status = 'pending';
  if not found then raise exception 'That invite is no longer open.' using errcode = '22023'; end if;
  select x.* into a from public.activities x join public.rsvps r on r.activity_id = x.id where r.id = g.rsvp_id and r.status = 'committed';
  if not found then raise exception 'That invite is no longer open.' using errcode = '22023'; end if;
  if not p_accept then
    update public.rsvp_guests set status = 'declined', responded_at = now() where id = g.id;
    return jsonb_build_object('ok', true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.id::text, 18));
  if a.starts_at <= now() then raise exception 'This activity has already started.' using errcode = '22023', hint = 'started'; end if;
  if momentum_private.blocked_between(me, a.host_id) then raise exception 'You can''t join this activity.' using errcode = '42501'; end if;
  if momentum_private.is_going(a.id, me) then raise exception 'You''re already going.' using errcode = '22023', hint = 'already'; end if;
  v_conflict := momentum_private.conflict_with(a.id, me);
  if v_conflict is not null then
    raise exception 'This overlaps or starts within 30 minutes of %.', v_conflict using errcode = '22023', hint = 'conflict';
  end if;
  if momentum_private.taken(a.id) + 1 > a.max_participants then
    update public.rsvp_guests set status = 'expired', responded_at = now() where id = g.id; -- saved: no exception
    return jsonb_build_object('ok', false, 'code', 'full', 'message', 'The activity filled up before you accepted. Committed people get priority.');
  end if;
  update public.rsvp_guests set status = 'accepted', responded_at = now() where id = g.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 7. "Did you go?" (after it ends; gains Momentum) ----------
create or replace function momentum_private.check_in_activity(p_activity uuid, p_attended boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  r public.rsvps%rowtype;
  a public.activities%rowtype;
  v_first boolean := false;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_attended is null then raise exception 'Answer yes or no.' using errcode = '22023'; end if;
  select * into a from public.activities where id = p_activity;
  if not found then raise exception 'That activity couldn''t be found.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_activity::text, 18));
  select * into r from public.rsvps where activity_id = p_activity and profile_id = me and status = 'committed';
  if not found then raise exception 'You weren''t committed to this activity.' using errcode = '22023'; end if;
  if a.ends_at > now() then raise exception 'You can check in after the activity ends.' using errcode = '22023'; end if;
  if r.attended is not null then raise exception 'You already checked in.' using errcode = '22023', hint = 'already'; end if;
  if p_attended then
    v_first := not exists (select 1 from public.rsvps x where x.activity_id = p_activity and x.attended);
  end if;
  update public.rsvps set attended = p_attended, checked_in_at = now() where id = r.id;
  if p_attended then
    insert into public.momentum_log (profile_id, gained_on, reason) values (me, public.momentum_today(), 'attended') on conflict do nothing;
    if v_first then -- the first "yes" means the activity happened: the host gains Momentum today
      insert into public.momentum_log (profile_id, gained_on, reason) values (a.host_id, public.momentum_today(), 'hosted') on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'hostCredited', v_first);
end $$;

-- ---------- 8. Website entry points (thin wrappers, signed-in users only) ----------
revoke all on function momentum_private.commit_to_activity(uuid, uuid, text), momentum_private.cancel_commitment(uuid),
  momentum_private.respond_plus_one(uuid, boolean), momentum_private.check_in_activity(uuid, boolean) from public, anon;
grant execute on function momentum_private.commit_to_activity(uuid, uuid, text), momentum_private.cancel_commitment(uuid),
  momentum_private.respond_plus_one(uuid, boolean), momentum_private.check_in_activity(uuid, boolean) to authenticated;

create or replace function public.commit_to_activity(p_activity uuid, p_friend uuid default null, p_guest_name text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.commit_to_activity(p_activity, p_friend, p_guest_name); $$;
create or replace function public.cancel_commitment(p_activity uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.cancel_commitment(p_activity); $$;
create or replace function public.respond_plus_one(p_guest uuid, p_accept boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.respond_plus_one(p_guest, p_accept); $$;
create or replace function public.check_in_activity(p_activity uuid, p_attended boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.check_in_activity(p_activity, p_attended); $$;
revoke all on function public.commit_to_activity(uuid, uuid, text), public.cancel_commitment(uuid),
  public.respond_plus_one(uuid, boolean), public.check_in_activity(uuid, boolean) from public, anon;
grant execute on function public.commit_to_activity(uuid, uuid, text), public.cancel_commitment(uuid),
  public.respond_plus_one(uuid, boolean), public.check_in_activity(uuid, boolean) to authenticated;

-- ---------- 9. Retire old rules ----------
-- The self-reported "attended" Momentum from 017
drop function if exists public.record_attended_momentum();
drop function if exists momentum_private.record_attended_momentum();
-- schema.sql's original RSVP triggers: 24-hour cancel window, a capacity count without the
-- host or +1s, and unqualified table names. The functions above replace them.
drop trigger if exists rsvps_rules on public.rsvps;
drop trigger if exists rsvps_cancellation_rules on public.rsvps;
drop function if exists public.momentum_check_rsvp_rules();
drop function if exists public.momentum_check_cancellation_rules();

-- PREVIEW: what this file set up
select
  (select count(*) from public.rsvps)                                              as commitments_saved,
  (select string_agg(polname, ', ' order by polname) from pg_policy
    where polrelid in ('public.rsvps'::regclass, 'public.rsvp_guests'::regclass, 'public.rsvp_cancellations'::regclass, 'public.activity_addresses'::regclass)) as read_rules,
  (select string_agg(proname, ', ' order by proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname in ('commit_to_activity', 'cancel_commitment', 'respond_plus_one', 'check_in_activity', 'spots_taken')) as new_functions,
  (select count(*) from pg_proc where proname in ('record_attended_momentum', 'momentum_check_rsvp_rules', 'momentum_check_cancellation_rules')) as old_rules_left;

-- commit;
