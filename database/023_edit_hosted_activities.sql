-- Allow hosts to edit their own activities before they start.
-- Ownership and timing are enforced by Row Level Security, not only by the website UI.
begin;

drop policy if exists "host updates own upcoming activities" on public.activities;
create policy "host updates own upcoming activities" on public.activities
  for update to authenticated
  using (
    host_id = public.current_profile_id()
    and starts_at > now()
  )
  with check (
    host_id = public.current_profile_id()
    and starts_at > now()
  );

drop policy if exists "host updates own activity address" on public.activity_addresses;
create policy "host updates own activity address" on public.activity_addresses
  for update to authenticated
  using (
    exists (
      select 1 from public.activities a
      where a.id = activity_addresses.activity_id
        and a.host_id = public.current_profile_id()
        and a.starts_at > now()
    )
  )
  with check (
    exists (
      select 1 from public.activities a
      where a.id = activity_addresses.activity_id
        and a.host_id = public.current_profile_id()
        and a.starts_at > now()
    )
  );

commit;
