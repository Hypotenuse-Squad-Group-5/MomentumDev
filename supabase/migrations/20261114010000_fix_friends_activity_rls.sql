-- Migration: 20261114010000_fix_friends_activity_rls.sql
-- (Matches database/020_fix_friends_activity_rls.sql)

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
