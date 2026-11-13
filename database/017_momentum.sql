-- =====================================================================
-- Migration 017: Momentum (replaces the old "any habit" streak) + habit limits
--
-- WHAT "GAINING MOMENTUM" MEANS: a day counts if you did at least one of:
--   habits    checked at least half of your active habits, rounded up
--             (1 of 1, 1 of 2, 2 of 3, 2 of 4, 3 of 5)
--   lesson    finished a lesson
--   attended  said "Yes, I went" to an activity (self-reported until RSVPs move
--             to the database in group 2; counts for the day you report it)
--   hosted    reserved for group 2 (an activity you hosted that people attended)
--
-- THE MOMENTUM LOG (new table momentum_log): one row per day per reason you gained
-- Momentum. Only TODAY is ever recalculated. Past days are locked in, so deleting
-- or archiving a habit later never changes your history. The website turns this
-- list of days into the Momentum number (+1 for each day gained, -2 for each day
-- missed, never below 0). Nobody can write to the log directly; only the rules here do.
--
-- HABIT LIMITS: at most 5 active habits and 10 archived ones. Archived habits can now
-- be deleted for good (active ones can't: archive first). People already over a limit
-- keep what they have; they just can't add or archive more until they're under it.
--
-- AT LAUNCH: the log is filled from existing history using the OLD rule (any check-in
-- counts) for days before today, plus every finished lesson, so nobody's current run
-- is wiped out when this ships. The new rule applies from today on.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- ---------- 1. The momentum log ----------
create table if not exists public.momentum_log (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  gained_on   date not null,
  reason      text not null check (reason in ('habits', 'lesson', 'attended', 'hosted')),
  created_at  timestamptz not null default now(),
  primary key (profile_id, gained_on, reason)
);
alter table public.momentum_log enable row level security;
drop policy if exists "read own momentum" on public.momentum_log;
create policy "read own momentum" on public.momentum_log
  for select to authenticated
  using (profile_id = public.current_profile_id());
revoke all on public.momentum_log from anon;
revoke insert, update, delete, truncate on public.momentum_log from authenticated;
grant select on public.momentum_log to authenticated;

-- ---------- 2. Habits: recalculate TODAY only ----------
create or replace function momentum_private.refresh_habit_momentum(p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.momentum_today();
  v_total int;
  v_done  int;
begin
  if p_profile is null then return; end if;
  select count(*) into v_total from public.habits where profile_id = p_profile and is_active;
  select count(*) into v_done
    from public.habit_checkins c join public.habits h on h.id = c.habit_id
   where h.profile_id = p_profile and h.is_active and c.check_date = v_today;
  if v_total > 0 and v_done >= ceil(v_total / 2.0) then
    insert into public.momentum_log (profile_id, gained_on, reason) values (p_profile, v_today, 'habits')
    on conflict do nothing;
  else
    delete from public.momentum_log where profile_id = p_profile and gained_on = v_today and reason = 'habits';
  end if;
end $$;
revoke all on function momentum_private.refresh_habit_momentum(uuid) from public, anon, authenticated;

-- Runs after a check-in is added or removed
create or replace function momentum_private.on_checkin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.refresh_habit_momentum(
    (select profile_id from public.habits where id = coalesce(new.habit_id, old.habit_id)));
  return null;
end $$;
revoke all on function momentum_private.on_checkin_change() from public, anon, authenticated;
drop trigger if exists habit_checkins_momentum on public.habit_checkins;
create trigger habit_checkins_momentum after insert or delete on public.habit_checkins
  for each row execute function momentum_private.on_checkin_change();

-- Runs after a habit is added, archived, restored or deleted (changes how many you need today)
create or replace function momentum_private.on_habit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.refresh_habit_momentum(coalesce(new.profile_id, old.profile_id));
  return null;
end $$;
revoke all on function momentum_private.on_habit_change() from public, anon, authenticated;
drop trigger if exists habits_momentum on public.habits;
create trigger habits_momentum after insert or delete or update of is_active on public.habits
  for each row execute function momentum_private.on_habit_change();

-- ---------- 3. Lessons: finishing one gains today's Momentum ----------
create or replace function momentum_private.on_lesson_completed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.momentum_log (profile_id, gained_on, reason) values (new.profile_id, public.momentum_today(), 'lesson')
  on conflict do nothing;
  return null;
end $$;
revoke all on function momentum_private.on_lesson_completed() from public, anon, authenticated;
drop trigger if exists lesson_completions_momentum on public.lesson_completions;
create trigger lesson_completions_momentum after insert on public.lesson_completions
  for each row execute function momentum_private.on_lesson_completed();

-- ---------- 4. Attended: "Yes, I went" (today only, self-reported until group 2) ----------
create or replace function momentum_private.record_attended_momentum() returns void
language plpgsql security definer set search_path = '' as $$
declare v_profile uuid := public.current_profile_id();
begin
  if v_profile is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.momentum_log (profile_id, gained_on, reason) values (v_profile, public.momentum_today(), 'attended')
  on conflict do nothing;
end $$;
revoke all on function momentum_private.record_attended_momentum() from public, anon;
grant execute on function momentum_private.record_attended_momentum() to authenticated;
create or replace function public.record_attended_momentum() returns void
language sql security invoker set search_path = '' as $$ select momentum_private.record_attended_momentum(); $$;
revoke all on function public.record_attended_momentum() from public, anon;
grant execute on function public.record_attended_momentum() to authenticated;

-- ---------- 5. Habit limits: 5 active, 10 archived ----------
create or replace function momentum_private.check_habit_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  -- one change at a time per person, so two quick clicks can't both slip past a limit
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.profile_id::text, 17));
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    select count(*) into n from public.habits where profile_id = new.profile_id and is_active and id <> new.id;
    if n >= 5 then
      raise exception 'You can have up to 5 active habits. Archive one to add another.'
        using errcode = 'check_violation', hint = 'max_active';
    end if;
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then
    select count(*) into n from public.habits where profile_id = new.profile_id and not is_active and id <> new.id;
    if n >= 10 then
      raise exception 'Your habit archive is full (10). Delete an archived habit to archive this one.'
        using errcode = 'check_violation', hint = 'archive_full';
    end if;
  end if;
  return new;
end $$;
revoke all on function momentum_private.check_habit_limits() from public, anon, authenticated;
drop trigger if exists habits_limits on public.habits;
create trigger habits_limits before insert or update of is_active on public.habits
  for each row execute function momentum_private.check_habit_limits();

-- ---------- 6. Delete archived habits for good ----------
grant delete on public.habits to authenticated;
drop policy if exists "delete own archived habits" on public.habits;
create policy "delete own archived habits" on public.habits
  for delete to authenticated
  using (profile_id = public.current_profile_id() and not is_active);

-- Past check-ins still can't be undone one by one, but they may go with their habit
-- when that habit is deleted (the habit row is already gone at that point).
create or replace function public.momentum_validate_habit_checkin() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.check_date <> public.momentum_today() then
      raise exception 'Habits can only be checked off for today.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.check_date <> public.momentum_today()
     and exists (select 1 from public.habits where id = old.habit_id) then
    raise exception 'Past check-ins can''t be undone.' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
revoke all on function public.momentum_validate_habit_checkin() from public, anon, authenticated;

-- ---------- 7. Fill the log from existing history (old rule for past days) ----------
insert into public.momentum_log (profile_id, gained_on, reason)
select distinct h.profile_id, c.check_date, 'habits'
  from public.habit_checkins c join public.habits h on h.id = c.habit_id
 where c.check_date < public.momentum_today()
on conflict do nothing;
insert into public.momentum_log (profile_id, gained_on, reason)
select profile_id, (completed_at at time zone 'America/Denver')::date, 'lesson'
  from public.lesson_completions
on conflict do nothing;
-- today: the new rule
do $$ declare r record; begin
  for r in select distinct profile_id from public.habits loop perform momentum_private.refresh_habit_momentum(r.profile_id); end loop;
end $$;

-- PREVIEW: what this file set up
select
  (select count(*) from public.momentum_log)                                   as log_rows,
  (select count(distinct profile_id) from public.momentum_log)                 as people_with_momentum,
  (select string_agg(reason || ': ' || n, ', ' order by reason)
     from (select reason, count(*) n from public.momentum_log group by reason) r) as rows_by_reason,
  (select string_agg(tgname, ', ' order by tgname) from pg_trigger
    where tgname in ('habit_checkins_momentum', 'habits_momentum', 'lesson_completions_momentum', 'habits_limits')) as new_rules,
  (select count(*) from (select profile_id from public.habits where is_active group by profile_id having count(*) > 5) x)      as people_over_5_active,
  (select count(*) from (select profile_id from public.habits where not is_active group by profile_id having count(*) > 10) x) as people_over_10_archived;

-- commit;
