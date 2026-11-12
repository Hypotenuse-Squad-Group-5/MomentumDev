-- Integration regression against live schema, with ALL test writes rolled back.
-- Run as an authorized SQL Editor operator; uses two existing profiles internally.
-- No account IDs, goals, or private profile fields are returned.
begin;
do $$
declare a uuid; b uuid;
begin
  select auth_user_id into a from public.profiles p where not exists(select 1 from public.lesson_completions c join public.lessons l on l.id=c.lesson_id where c.profile_id=p.id and l.curriculum_version=2) order by id limit 1;
  select auth_user_id into b from public.profiles p where auth_user_id <> a and not exists(select 1 from public.lesson_completions c join public.lessons l on l.id=c.lesson_id where c.profile_id=p.id and l.curriculum_version=2) order by id limit 1;
  if a is null or b is null then raise exception 'Two existing accounts are required for this check.'; end if;
  perform set_config('momentum.qa_a', a::text, true);
  perform set_config('momentum.qa_b', b::text, true);
end $$;
set local role authenticated;
do $$
declare r jsonb; first_habit uuid; n integer; old_count bigint; new_count bigint; rejected boolean;
begin
  perform set_config('request.jwt.claim.sub', current_setting('momentum.qa_a'), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('momentum.qa_a'),'role','authenticated')::text, true);
  -- Existing accounts' real completions are preserved by the surrounding rollback.
  if exists(select 1 from public.lesson_completions c join public.lessons l on l.id=c.lesson_id where l.curriculum_version=2) then
    raise exception 'Use accounts without curriculum-v2 completions for this regression.';
  end if;
  rejected := false;
  begin perform public.complete_momentum_lesson(6,repeat('word ',35),'QA habit'); exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'FAIL: locked lesson accepted'; end if;
  rejected := false;
  begin perform public.complete_momentum_lesson(1,'   ','QA habit'); exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'FAIL: blank reflection accepted'; end if;
  rejected := false;
  begin perform public.complete_momentum_lesson(1,repeat('x',1001),'QA habit'); exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'FAIL: over-limit reflection accepted'; end if;
  select count(*) into old_count from public.habits;
  for n in 1..6 loop
    if n < 6 then
      rejected := false;
      begin perform public.complete_momentum_lesson(n+1,'A valid short reflection.','QA locked habit'); exception when invalid_parameter_value then rejected := true; end;
      if not rejected then raise exception 'FAIL: lesson % accepted before lesson %',n+1,n; end if;
    end if;
    r := public.complete_momentum_lesson(n,case when n=1 then 'A short reflection.' when n=2 then repeat('x',1000) else repeat('A specific reflection about my phone habits and my next action. ',4) end,'QA lesson '||n);
    if not (r->>'ok')::boolean then raise exception 'FAIL: lesson completion'; end if;
    if n=1 then first_habit := (r->>'habitId')::uuid; end if;
  end loop;
  select count(*) into new_count from public.habits;
  if new_count <> old_count+6 then raise exception 'FAIL: habits not created'; end if;
  r := public.complete_momentum_lesson(1,repeat('word ',35),'Retry must not replace the habit');
  if not (r->>'alreadyCompleted')::boolean then raise exception 'FAIL: retry not idempotent'; end if;
  if (select count(*) from public.habits) <> new_count then raise exception 'FAIL: duplicate habit'; end if;
  if (select count(*) from public.lesson_completions c join public.lessons l on l.id=c.lesson_id where l.curriculum_version=2) <> 6 then raise exception 'FAIL: saved progress'; end if;
  if not exists(select 1 from public.lesson_completions c join public.habits h on h.id=c.habit_id where h.id=first_habit and h.source_lesson_id=c.lesson_id and h.profile_id=c.profile_id and h.goal_text=c.user_goal_response) then raise exception 'FAIL: habit linkage'; end if;
  -- The completed lesson reads the SAME habit after Home changes its name/archive state.
  update public.habits set title='QA renamed on Home',is_active=false where id=first_habit;
  if not exists(select 1 from public.lesson_completions c join public.habits h on h.id=c.habit_id where h.id=first_habit and h.title='QA renamed on Home' and not h.is_active) then raise exception 'FAIL: shared record'; end if;
  perform set_config('request.jwt.claim.sub', current_setting('momentum.qa_b'), true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('momentum.qa_b'),'role','authenticated')::text, true);
  if exists(select 1 from public.habits where id=first_habit) or exists(select 1 from public.lesson_completions where habit_id=first_habit) then raise exception 'FAIL: cross-account read'; end if;
  update public.habits set title='Forbidden' where id=first_habit;
  get diagnostics new_count = row_count;
  if new_count <> 0 then raise exception 'FAIL: cross-account update'; end if;
end $$;
reset role;
-- Force a late failure after the habit/completion inserts; the function must undo both.
create function momentum_private.qa_reject_completion() returns trigger language plpgsql as $$
begin raise exception 'Forced completion failure'; end $$;
create trigger qa_reject_completion before insert on public.lesson_completions
for each row execute function momentum_private.qa_reject_completion();
set local role authenticated;
do $$
declare before_habits bigint; after_habits bigint; rejected boolean := false;
begin
  select count(*) into before_habits from public.habits;
  begin
    perform public.complete_momentum_lesson(1,repeat('A specific reflection about a realistic action I will take tomorrow. ',4),'QA atomic failure');
  exception when raise_exception then rejected := true;
  end;
  select count(*) into after_habits from public.habits;
  if not rejected or after_habits <> before_habits or exists(select 1 from public.lesson_completions c join public.lessons l on l.id=c.lesson_id where l.curriculum_version=2) then
    raise exception 'FAIL: partial save survived a transaction error';
  end if;
end $$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege('anon','public.complete_momentum_lesson(integer,text,text)','execute') then raise exception 'FAIL: anonymous execution'; end if;
end $$;
reset role;
rollback;
select true as passed, 'All integration checks passed; test writes rolled back.' as detail;
