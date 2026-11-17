-- Additional host-only update policies for upcoming activities and their private addresses.
create policy "hosts update upcoming activities"
on public.activities
for update
to authenticated
using (
  host_id = public.current_profile_id()
  and starts_at > now()
)
with check (
  host_id = public.current_profile_id()
  and starts_at > now()
);

create policy "hosts update upcoming activity addresses"
on public.activity_addresses
for update
to authenticated
using (
  exists (
    select 1
    from public.activities a
    where a.id = activity_addresses.activity_id
      and a.host_id = public.current_profile_id()
      and a.starts_at > now()
  )
)
with check (
  exists (
    select 1
    from public.activities a
    where a.id = activity_addresses.activity_id
      and a.host_id = public.current_profile_id()
      and a.starts_at > now()
  )
);