-- =====================================================================
-- Migration 019: Friends activity visibility and simplified 2-option model
--
-- WHAT THIS CHANGES:
--   1. Simplifies visibility from 4 choices to 2: 'public' and 'friends'.
--   2. Migrates existing records:
--        - 'friends_of_friends' -> 'public'
--        - 'private'            -> 'friends'
--   3. Updates check constraints on activities, user_settings, and posts.
--   4. Updates Row Level Security (RLS) on public.activities so that:
--        - Signed-in users can read public activities.
--        - Hosts can always read their own activities.
--        - Accepted friends can read 'friends' visibility activities.
--        - Users who are committed (or invited as +1) can still read
--          the activity even if the friendship ends, preserving their calendar
--          and past activity history.
--   5. Updates momentum_private.commit_to_activity so that friends can commit
--      to 'friends' visibility activities.
--
-- HOW TO RUN:
--   Run in the Supabase SQL editor. Re-running is safe.
-- =====================================================================

begin;

-- ---------- 1. Data Migration ----------
update public.activities set visibility = 'public' where visibility = 'friends_of_friends';
update public.activities set visibility = 'friends' where visibility = 'private';

update public.user_settings set activity_visibility = 'public' where activity_visibility = 'friends_of_friends';
update public.user_settings set activity_visibility = 'friends' where activity_visibility = 'private';

update public.user_settings set post_visibility = 'public' where post_visibility = 'friends_of_friends';
update public.user_settings set post_visibility = 'friends' where post_visibility = 'private';

update public.user_settings set friends_list_visibility = 'public' where friends_list_visibility = 'friends_of_friends';
update public.user_settings set friends_list_visibility = 'friends' where friends_list_visibility = 'private';

update public.posts set visibility = 'public' where visibility = 'friends_of_friends';
update public.posts set visibility = 'friends' where visibility = 'private';

-- ---------- 2. Update Constraints ----------
alter table public.activities drop constraint if exists activities_visibility_check;
alter table public.activities add constraint activities_visibility_check check (visibility in ('public', 'friends'));

alter table public.user_settings drop constraint if exists user_settings_activity_visibility_check;
alter table public.user_settings add constraint user_settings_activity_visibility_check check (activity_visibility in ('public', 'friends'));

alter table public.user_settings drop constraint if exists user_settings_post_visibility_check;
alter table public.user_settings add constraint user_settings_post_visibility_check check (post_visibility in ('public', 'friends'));

alter table public.user_settings drop constraint if exists user_settings_friends_list_visibility_check;
alter table public.user_settings add constraint user_settings_friends_list_visibility_check check (friends_list_visibility in ('public', 'friends'));

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'friends'));

-- ---------- 3. Update Activities RLS Policy ----------
drop policy if exists "signed-in users read activities" on public.activities;
create policy "signed-in users read activities" on public.activities
  for select to authenticated
  using (
    visibility = 'public'
    or host_id = public.current_profile_id()
    or exists (
      select 1 from public.rsvps r
      where r.activity_id = activities.id
        and r.profile_id = public.current_profile_id()
    )
    or exists (
      select 1 from public.rsvp_guests g
      join public.rsvps r on r.id = g.rsvp_id
      where r.activity_id = activities.id
        and g.guest_profile_id = public.current_profile_id()
    )
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = public.current_profile_id() and f.addressee_id = activities.host_id)
            or (f.addressee_id = public.current_profile_id() and f.requester_id = activities.host_id)
          )
      )
    )
  );

-- ---------- 4. Update commit_to_activity function ----------
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
  if not found or (
    a.visibility <> 'public'
    and not (
      a.visibility = 'friends'
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = me and f.addressee_id = a.host_id)
            or (f.addressee_id = me and f.requester_id = a.host_id)
          )
      )
    )
  ) then
    raise exception 'That activity couldn''t be found.' using errcode = '22023', hint = 'not_found';
  end if;
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

-- ---------- 5. PREVIEW ----------
select
  (select count(*) from public.activities where visibility = 'friends') as friends_activities,
  (select count(*) from public.activities where visibility = 'public') as public_activities,
  (select string_agg(polname, ', ' order by polname) from pg_policy where polrelid = 'public.activities'::regclass) as activity_policies;

commit;

