-- Service-only allowance reservation. No reflections or suggestions are stored.
create table momentum_private.habit_suggestion_usage (
  bucket text primary key,
  usage_day date not null,
  requests integer not null default 0 check (requests >= 0),
  last_request timestamptz not null default now()
);
alter table momentum_private.habit_suggestion_usage enable row level security;
revoke all on momentum_private.habit_suggestion_usage from public, anon, authenticated;
grant select, insert, update on momentum_private.habit_suggestion_usage to service_role;

create function public.reserve_habit_suggestion(p_user uuid, p_lesson integer)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  d date := (now() at time zone 'America/Los_Angeles')::date;
  u momentum_private.habit_suggestion_usage%rowtype;
  g momentum_private.habit_suggestion_usage%rowtype;
begin
  if p_user is null or p_lesson not between 1 and 6 then
    return jsonb_build_object('ok', false, 'message', 'Invalid request.');
  end if;
  -- Serialize reservations across workers, including concurrent first requests.
  perform pg_advisory_xact_lock(87421003);
  if not exists (
    select 1 from public.profiles p join public.profile_private pp on pp.profile_id = p.id
    where p.auth_user_id = p_user and pp.age_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'message', 'Complete your account setup first.');
  end if;
  if exists (
    select 1 from public.lessons l where l.curriculum_version = 2 and l.number < p_lesson
    and not exists (select 1 from public.lesson_completions c join public.profiles p on p.id = c.profile_id
      where p.auth_user_id = p_user and c.lesson_id = l.id)
  ) then
    return jsonb_build_object('ok', false, 'message', 'Finish the previous lesson first.');
  end if;
  select * into u from momentum_private.habit_suggestion_usage where bucket = p_user::text;
  select * into g from momentum_private.habit_suggestion_usage where bucket = 'global';
  if u.last_request > now() - interval '15 seconds' then
    return jsonb_build_object('ok', false, 'message', 'Please wait 15 seconds between requests.', 'retryAfter', 15);
  end if;
  if (u.usage_day = d and u.requests >= 10) or (g.usage_day = d and g.requests >= 100) then
    return jsonb_build_object('ok', false, 'message', 'Today’s suggestion allowance is used up. You can still write your own habit.', 'retryAfter', 3600);
  end if;
  insert into momentum_private.habit_suggestion_usage(bucket, usage_day, requests, last_request)
    values (p_user::text, d, 1, now()), ('global', d, 1, now())
    on conflict (bucket) do update set usage_day = d,
      requests = case when momentum_private.habit_suggestion_usage.usage_day = d
        then momentum_private.habit_suggestion_usage.requests + 1 else 1 end,
      last_request = now();
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.reserve_habit_suggestion(uuid, integer) from public, anon, authenticated;
grant usage on schema momentum_private to service_role;
grant execute on function public.reserve_habit_suggestion(uuid, integer) to service_role;
