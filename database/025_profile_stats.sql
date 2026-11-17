-- =====================================================================
-- Migration 025: the three numbers on every profile (Activities · Friends · Momentum)
--
-- Your own friendships and Momentum log are private (only you can read the rows), so
-- the site couldn't show these for anyone else. This adds ONE function that returns just
-- the three numbers for a profile, and nothing else:
--   activities  activities they went to ("Yes, I went") + activities they hosted that
--               happened (at least one person said "Yes, I went"); cancelled ones don't count
--   friends     accepted friendships
--   momentum    their Momentum today (+1 per day gained, -2 per day missed, never below 0:
--               the same math the site uses for your own)
-- Any signed-in member can see these for any profile (decided 2026-11-16).
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see each member's numbers at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

create or replace function momentum_private.profile_stats(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.momentum_today();
  v_first date;
  v_value int := 0;
  d date;
begin
  -- (only signed-in members can call this: see the grants below)
  -- Momentum: walk every day from their first gained day up to yesterday, then add today
  select min(gained_on) into v_first from public.momentum_log where profile_id = p_profile and gained_on < v_today;
  if v_first is not null then
    d := v_first;
    while d < v_today loop
      if exists (select 1 from public.momentum_log where profile_id = p_profile and gained_on = d) then
        v_value := v_value + 1;
      else
        v_value := greatest(0, v_value - 1);
      end if;
      d := d + 1;
    end loop;
  end if;
  if exists (select 1 from public.momentum_log where profile_id = p_profile and gained_on = v_today) then
    v_value := v_value + 1;
  end if;

  return jsonb_build_object(
    'activities',
      (select count(*) from public.rsvps r join public.activities a on a.id = r.activity_id
        where r.profile_id = p_profile and r.attended and a.cancelled_at is null)
      + (select count(*) from public.activities a
          where a.host_id = p_profile and a.cancelled_at is null
            and exists (select 1 from public.rsvps r where r.activity_id = a.id and r.attended)),
    'friends',
      (select count(*) from public.friendships f
        where f.status = 'accepted' and (f.requester_id = p_profile or f.addressee_id = p_profile)),
    'momentum', v_value);
end $$;
revoke all on function momentum_private.profile_stats(uuid) from public, anon;
grant execute on function momentum_private.profile_stats(uuid) to authenticated;

create or replace function public.profile_stats(p_profile uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select momentum_private.profile_stats(p_profile); $$;
revoke all on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;

-- PREVIEW: everyone's numbers
select p.first_name, momentum_private.profile_stats(p.id) as stats
  from public.profiles p order by p.first_name;

-- commit;
