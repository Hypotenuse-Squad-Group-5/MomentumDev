-- Versioned lesson sync. Additive data migration: legacy lesson rows/links stay intact.
-- Apply once using Supabase migration tooling. Never re-run schema.sql on live data.
alter table public.lessons add column curriculum_version integer not null default 1;
alter table public.lessons drop constraint lessons_number_key;
alter table public.lessons add constraint lessons_curriculum_number_key unique (curriculum_version, number);
insert into public.lessons (curriculum_version, number, title, duration_minutes, goal_prompt, min_goal_words) values
  (2, 1, 'Habits & Goals', 8, 'Describe one phone habit you want to change. What is the cue, what small action will replace it, and what will you do on a difficult day?', 30),
  (2, 2, 'Your Phone’s Pull', 8, 'Which feature draws you in, what useful connection do you want to preserve, and what boundary will you test this week?', 30),
  (2, 3, 'Scroll Less, Sleep Better', 8, 'What will signal the end of scrolling, when will your wind-down start, where will your phone be, and what is your fallback?', 30),
  (2, 4, 'Find Your Offline', 10, 'Describe a common attention cue, the need you think is underneath it, an offline alternative, and an easier fallback. How will you check whether it helps?', 30),
  (2, 5, 'Build Real Connection', 10, 'What comparison or social worry do you notice, what is a fairer interpretation, and what small offline step will you try? Include a fallback if the first plan does not work.', 30),
  (2, 6, 'Make Plans That Stick', 10, 'Describe your next phone-free hangout, your agreed phone boundary, a backup plan, and when you will review what worked. What small daily habit will support it?', 30);

alter table public.lesson_completions add column if not exists user_goal_response text;
alter table public.lesson_completions add column if not exists habit_title text;
alter table public.lesson_completions drop constraint if exists lesson_completions_user_goal_response_check;
alter table public.lesson_completions add constraint lesson_completions_goal_length check (char_length(user_goal_response) <= 10000) not valid;
alter table public.lesson_completions add column habit_id uuid references public.habits(id) on delete set null;
create unique index lesson_completions_one_habit on public.lesson_completions(habit_id) where habit_id is not null;
create unique index habits_one_per_source_lesson on public.habits(profile_id, source_lesson_id) where source_lesson_id is not null;
create unique index point_events_one_per_lesson on public.point_events(profile_id, lesson_id) where kind = 'lesson';

alter table public.lesson_completions enable row level security;
create policy "read own lesson completions" on public.lesson_completions for select to authenticated
  using (profile_id = (select public.current_profile_id()));
grant select on public.lessons, public.lesson_completions to authenticated;
-- Completion writes and points are handled by the checked function, not client-provided owners.
revoke insert, update, delete, truncate on public.lesson_completions from anon, authenticated;

create schema if not exists momentum_private;
revoke all on schema momentum_private from public, anon;
grant usage on schema momentum_private to authenticated;
create function momentum_private.complete_momentum_lesson(p_number integer, p_goal text, p_habit_title text)
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
  if char_length(v_goal) > 10000 or v_goal = '' or cardinality(regexp_split_to_array(v_goal, '[[:space:]]+')) < v_lesson.min_goal_words then
    raise exception 'Write at least 30 words, up to 10,000 characters, to finish this lesson.' using errcode = '22023';
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
revoke all on function momentum_private.complete_momentum_lesson(integer,text,text) from public, anon;
grant execute on function momentum_private.complete_momentum_lesson(integer,text,text) to authenticated;
create function public.complete_momentum_lesson(p_number integer, p_goal text, p_habit_title text)
returns jsonb language sql security invoker set search_path = '' as $$
  select momentum_private.complete_momentum_lesson(p_number,p_goal,p_habit_title);
$$;
revoke all on function public.complete_momentum_lesson(integer,text,text) from public, anon;
grant execute on function public.complete_momentum_lesson(integer,text,text) to authenticated;
