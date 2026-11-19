-- Keep lesson numbers stable for deep links, habits, and completion history.
alter table public.lessons add column sequence_position integer;
update public.lessons set sequence_position = number where curriculum_version = 2;

create unique index lessons_unique_sequence_position on public.lessons (sequence_position)
where curriculum_version = 2 and sequence_position is not null;

create or replace function momentum_private.admin_move_lesson(p_number integer, p_neighbor integer, p_step integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_position integer;
  neighbor_position integer;
begin
  perform momentum_private.require_admin();
  perform pg_advisory_xact_lock(87421004);
  select sequence_position into current_position from public.lessons
    where curriculum_version = 2 and retired_at is null and number = p_number;
  select sequence_position into neighbor_position from public.lessons
    where curriculum_version = 2 and retired_at is null and number = p_neighbor;
  if current_position is null or neighbor_position is null or p_step is null or p_step not in (-1, 1)
    or sign(neighbor_position - current_position) <> p_step
    or exists (select 1 from public.lessons where curriculum_version = 2 and retired_at is null
      and sequence_position > least(current_position, neighbor_position)
      and sequence_position < greatest(current_position, neighbor_position)) then
    raise exception 'The lesson order has changed. Refresh and try again.' using errcode = '22023';
  end if;

  update public.lessons set sequence_position = null where curriculum_version = 2 and number = p_number;
  update public.lessons set sequence_position = current_position where curriculum_version = 2 and number = p_neighbor;
  update public.lessons set sequence_position = neighbor_position where curriculum_version = 2 and number = p_number;
end;
$$;

create or replace function public.admin_move_lesson(p_number integer, p_neighbor integer, p_step integer)
returns void language sql security invoker set search_path = '' as $$
  select momentum_private.admin_move_lesson(p_number, p_neighbor, p_step);
$$;

revoke all on function momentum_private.admin_move_lesson(integer,integer,integer), public.admin_move_lesson(integer,integer,integer) from public, anon;
grant execute on function momentum_private.admin_move_lesson(integer,integer,integer), public.admin_move_lesson(integer,integer,integer) to authenticated;

create or replace function momentum_private.admin_save_lesson(
  p_number integer, p_title text, p_minutes integer, p_prompt text, p_content jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  lesson_number integer;
begin
  perform momentum_private.require_admin();
  if nullif(btrim(p_title), '') is null or char_length(p_title) > 120
    or p_minutes is null or p_minutes not between 1 and 180
    or nullif(btrim(p_prompt), '') is null
    or jsonb_typeof(p_content) is distinct from 'object'
    or pg_column_size(p_content) > 65536
    or nullif(btrim(p_content->>'html'), '') is null
    or nullif(btrim(p_content->>'summary'), '') is null
    or jsonb_typeof(p_content->'activities') is distinct from 'array'
    or jsonb_typeof(p_content->'sources') is distinct from 'array'
    or jsonb_typeof(p_content->'stats') is distinct from 'array' then
    raise exception 'Check the lesson fields and keep the content under 64 KB.' using errcode = '22023';
  end if;

  if p_number is null then
    -- Serialize new lesson numbers. Retired numbers remain reserved for historical records.
    perform pg_advisory_xact_lock(87421004);
    select coalesce(max(number), 0) + 1 into lesson_number
    from public.lessons where curriculum_version = 2;
    insert into public.lessons (curriculum_version, number, title, duration_minutes, goal_prompt, published_content, sequence_position)
    values (2, lesson_number, btrim(p_title), p_minutes, btrim(p_prompt), p_content,
      (select coalesce(max(sequence_position), 0) + 1 from public.lessons where curriculum_version = 2));
  else
    update public.lessons
    set title = btrim(p_title), duration_minutes = p_minutes, goal_prompt = btrim(p_prompt), published_content = p_content
    where curriculum_version = 2 and number = p_number and retired_at is null
    returning number into lesson_number;
    if not found then raise exception 'This lesson is no longer published.' using errcode = '22023'; end if;
  end if;
  return lesson_number;
end;
$$;

create or replace function momentum_private.admin_delete_lesson(p_number integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  perform pg_advisory_xact_lock(87421004);
  update public.lessons set retired_at = now(), published_content = null
  where curriculum_version = 2 and number = p_number and retired_at is null;
end;
$$;

CREATE OR REPLACE FUNCTION momentum_private.complete_momentum_lesson(p_number integer, p_goal text, p_habit_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_profile uuid;
  v_lesson public.lessons%rowtype;
  v_completion public.lesson_completions%rowtype;
  v_habit uuid;
  v_goal text := btrim(coalesce(p_goal, ''));
  v_title text := btrim(coalesce(p_habit_title, ''));
begin
  if auth.uid() is null then raise exception 'Sign in to finish a lesson.' using errcode = '42501'; end if;
  select id into v_profile from public.profiles where auth_user_id = auth.uid();
  if v_profile is null then raise exception 'Your account profile could not be found.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock_shared(87421004);
  -- Serialize completions for one account, including retries across devices.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_profile::text, 0));
  select * into v_lesson from public.lessons where curriculum_version = 2 and number = p_number and retired_at is null for share;
  if not found then raise exception 'Lesson not found.' using errcode = '22023'; end if;
  select * into v_completion from public.lesson_completions where profile_id = v_profile and lesson_id = v_lesson.id;
  if found then return jsonb_build_object('ok', true, 'alreadyCompleted', true, 'habitId', v_completion.habit_id); end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'Give your daily habit a name of 1 to 80 characters.' using errcode = '22023';
  end if;
  if char_length(v_goal) > 1000 or v_goal !~ '[^[:space:]]' then
    raise exception 'Add a brief reflection of up to 1,000 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.lessons l where l.curriculum_version = 2 and l.sequence_position < v_lesson.sequence_position and l.retired_at is null
     and not exists (select 1 from public.lesson_completions c where c.profile_id = v_profile and c.lesson_id = l.id)) then
    raise exception 'Finish the previous lessons first.' using errcode = '22023';
  end if;
  insert into public.habits(profile_id, title, goal_text, source_lesson_id, sort_order)
    values (v_profile, v_title, v_goal, v_lesson.id,
      (select coalesce(max(sort_order), 0) + 1 from public.habits where profile_id = v_profile))
    on conflict (profile_id, source_lesson_id) where source_lesson_id is not null
    do update set title = excluded.title, goal_text = excluded.goal_text
    returning id into v_habit;
  insert into public.lesson_completions(profile_id, lesson_id, user_goal_response, habit_title, habit_id)
    values (v_profile, v_lesson.id, v_goal, v_title, v_habit);
  return jsonb_build_object('ok', true, 'alreadyCompleted', false, 'habitId', v_habit);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reserve_habit_suggestion(p_user uuid, p_lesson integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_lesson public.lessons%rowtype;
  d date := (now() at time zone 'America/Los_Angeles')::date;
  u momentum_private.habit_suggestion_usage%rowtype;
  g momentum_private.habit_suggestion_usage%rowtype;
begin
  perform pg_advisory_xact_lock_shared(87421004);
  select * into v_lesson from public.lessons where curriculum_version = 2 and number = p_lesson and retired_at is null;
  if p_user is null or not found then
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
  if not exists (
    select 1 from public.lesson_completions c join public.profiles p on p.id = c.profile_id
    where p.auth_user_id = p_user and c.lesson_id = v_lesson.id
  ) and exists (
    select 1 from public.lessons l where l.curriculum_version = 2 and l.sequence_position < v_lesson.sequence_position and l.retired_at is null
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
$function$
;

notify pgrst, 'reload schema';
