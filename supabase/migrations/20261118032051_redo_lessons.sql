-- Preserve first completion dates, progress, and every habit created from a lesson.
alter table public.lesson_completions add column redo_count integer not null default 0;

create function momentum_private.redo_momentum_lesson(
  p_number integer, p_goal text, p_habit_title text, p_redo_count integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid := public.current_profile_id();
  v_completion public.lesson_completions%rowtype;
  v_habit uuid;
  v_goal text := btrim(coalesce(p_goal, ''));
  v_title text := btrim(coalesce(p_habit_title, ''));
begin
  if auth.uid() is null or v_profile is null then
    raise exception 'Sign in to redo a lesson.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_profile::text, 0));
  select c.* into v_completion
  from public.lesson_completions c
  join public.lessons l on l.id = c.lesson_id
  where c.profile_id = v_profile and l.curriculum_version = 2 and l.number = p_number;
  if not found then
    raise exception 'Finish this lesson before redoing it.' using errcode = '22023';
  end if;
  if v_completion.redo_count is distinct from p_redo_count then
    raise exception 'Your lesson has changed. Reload to see the latest attempt.' using errcode = '22023';
  end if;
  if char_length(v_goal) > 1000 or v_goal !~ '[^[:space:]]' then
    raise exception 'Add a brief reflection of up to 1,000 characters.' using errcode = '22023';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'Give your daily habit a name of 1 to 80 characters.' using errcode = '22023';
  end if;

  -- The completion links the new habit. The first habit keeps its unique source_lesson_id.
  insert into public.habits(profile_id, title, goal_text, sort_order)
    values (v_profile, v_title, v_goal,
      (select coalesce(max(sort_order), 0) + 1 from public.habits where profile_id = v_profile))
    returning id into v_habit;
  update public.lesson_completions
    set user_goal_response = v_goal, habit_title = v_title, habit_id = v_habit, redo_count = redo_count + 1
    where profile_id = v_profile and lesson_id = v_completion.lesson_id;
  return jsonb_build_object('ok', true, 'habitId', v_habit);
end;
$$;
revoke all on function momentum_private.redo_momentum_lesson(integer,text,text,integer) from public, anon;
grant execute on function momentum_private.redo_momentum_lesson(integer,text,text,integer) to authenticated;

create function public.redo_momentum_lesson(
  p_number integer, p_goal text, p_habit_title text, p_redo_count integer
)
returns jsonb language sql security invoker set search_path = '' as $$
  select momentum_private.redo_momentum_lesson(p_number, p_goal, p_habit_title, p_redo_count);
$$;
revoke all on function public.redo_momentum_lesson(integer,text,text,integer) from public, anon;
grant execute on function public.redo_momentum_lesson(integer,text,text,integer) to authenticated;

notify pgrst, 'reload schema';
