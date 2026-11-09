-- Remove the word minimum for all six v2 lessons. Existing responses are preserved.
update public.lessons set min_goal_words=0 where curriculum_version=2;
alter table public.lesson_completions drop constraint if exists lesson_completions_goal_length;
alter table public.lesson_completions add constraint lesson_completions_goal_length
  check (char_length(user_goal_response) <= 1000) not valid;
create or replace function momentum_private.complete_momentum_lesson(p_number integer, p_goal text, p_habit_title text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_lesson public.lessons%rowtype;
  v_completion public.lesson_completions%rowtype;
  v_habit uuid;
  v_points smallint;
  v_goal text := btrim(coalesce(p_goal, ''));
  v_title text := btrim(coalesce(p_habit_title, ''));
begin
  if auth.uid() is null then raise exception 'Sign in to finish a lesson.' using errcode = '42501'; end if;
  select id into v_profile from public.profiles where auth_user_id = auth.uid();
  if v_profile is null then raise exception 'Your account profile could not be found.' using errcode = '42501'; end if;
  -- Serialize completions for one account, including retries across devices.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_profile::text, 0));
  select * into v_lesson from public.lessons where curriculum_version = 2 and number = p_number;
  if not found then raise exception 'Lesson not found.' using errcode = '22023'; end if;
  select * into v_completion from public.lesson_completions where profile_id = v_profile and lesson_id = v_lesson.id;
  if found then return jsonb_build_object('ok', true, 'points', 0, 'alreadyCompleted', true, 'habitId', v_completion.habit_id); end if;
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'Give your daily habit a name of 1 to 80 characters.' using errcode = '22023';
  end if;
  if char_length(v_goal) > 1000 or v_goal !~ '[^[:space:]]' then
    raise exception 'Add a brief reflection of up to 1,000 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.lessons l where l.curriculum_version = 2 and l.number < v_lesson.number
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
  select points into v_points from public.point_values where kind = 'lesson';
  if v_points is null then raise exception 'Lesson point configuration is missing.'; end if;
  insert into public.point_events(profile_id,kind,points,habit_id,lesson_id,occurred_on)
    values (v_profile,'lesson',v_points,v_habit,v_lesson.id,public.momentum_today())
    on conflict (profile_id,lesson_id) where kind = 'lesson' do nothing;
  return jsonb_build_object('ok', true, 'points', v_points, 'alreadyCompleted', false, 'habitId', v_habit);
end;
$$;
