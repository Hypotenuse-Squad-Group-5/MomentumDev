-- =====================================================================
-- Migration 037: official Momentum activities are visible to all members
--
-- The official flag changes host branding, not visibility. An admin marking
-- an existing friends-only activity as official should make it discoverable
-- to all signed-in members.
-- =====================================================================

alter policy "signed-in users read activities" on public.activities
using (
  official is true
  or visibility = 'public'
  or host_id = public.current_profile_id()
  or exists (
    select 1 from public.rsvps r
    where r.activity_id = activities.id
      and r.profile_id = public.current_profile_id()
      and (r.status = 'committed' or r.attended is not null)
  )
  or exists (
    select 1
    from public.rsvp_guests g
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
          or
          (f.addressee_id = public.current_profile_id() and f.requester_id = activities.host_id)
        )
    )
  )
);

notify pgrst, 'reload schema';
