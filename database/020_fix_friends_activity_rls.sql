-- =====================================================================
-- Migration 020: Fix friends-only activity RLS policy on cancelled commitments
--
-- WHAT THIS CHANGES:
--   Updates Row Level Security (RLS) on public.activities so that:
--     - Signed-in users can read public activities.
--     - Hosts can always read their own activities.
--     - Accepted friends can read 'friends' visibility activities.
--     - Users who are actively committed (status = 'committed') or who attended
--       (attended is not null) can read the activity even if no longer friends,
--       preserving their active calendar and past activity history.
--     - Cancelled RSVPs (status = 'cancelled') no longer grant visibility
--       to friends-only activities if the users are no longer friends.
--     - +1 guests can read the activity only if the parent RSVP is committed
--       and the guest invite is accepted or pending.
--
-- HOW TO RUN:
--   Run in the Supabase SQL editor. Re-running is safe.
-- =====================================================================

begin;

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
        and (r.status = 'committed' or r.attended is not null)
    )
    or exists (
      select 1 from public.rsvp_guests g
      join public.rsvps r on r.id = g.rsvp_id
      where r.activity_id = activities.id
        and g.guest_profile_id = public.current_profile_id()
        and r.status = 'committed'
        and g.status in ('accepted', 'pending')
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

commit;
