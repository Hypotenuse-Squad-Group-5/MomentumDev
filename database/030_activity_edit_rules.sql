-- =====================================================================
-- Migration 030: rules for editing an activity (decided 2026-11-16)
--
-- 029 lets a host edit their own activity before it starts. This adds the rules, enforced
-- here so the website can't skip them:
--   - Title, description, what to bring, category, visibility, min: change freely before it starts.
--   - Max spots can't go below the number already going (host + committed + accepted +1s).
--   - DATE, TIME or PLACE (general location, city, exact address) with people going:
--       * not within 3 hours of the start, and the new start must also be 3+ hours away
--       * everyone going (and their +1s) gets an "activity changed" notification
--       * they can cancel for free: it doesn't use one of their 2 monthly cancellations,
--         and the 3-hour cancel window doesn't apply to them
--   - Nothing can be edited once it starts or after it's cancelled. Hosts can't set or clear
--     "cancelled" by editing (cancel_or_delete_activity does that, with its own rules).
--   - edited_at shows an "Edited" label; changed_at marks the last date/time/place change.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
--   Then upload the site files.
-- =====================================================================

begin;

alter table public.activities add column if not exists edited_at timestamptz;   -- any edit by the host
alter table public.activities add column if not exists changed_at timestamptz;  -- last date/time/place change

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('activity_reminder', 'plus_one_invite', 'friend_request', 'message', 'streak', 'activity_cancelled', 'activity_changed'));

-- ---------- 1. Check every edit a host makes (direct edits from the website) ----------
-- Changes made by the database's own functions (cancel_or_delete_activity, the address rule
-- below) run as the owner, not as the signed-in user, so they skip these checks.
-- (runs as the caller, so current_user tells a direct edit apart from the database's own functions)
create or replace function momentum_private.check_activity_edit() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_people int;
  v_plan_changed boolean;
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.id <> old.id or new.host_id <> old.host_id or new.created_at is distinct from old.created_at then
    raise exception 'That can''t be changed.' using errcode = '42501';
  end if;
  if new.cancelled_at is distinct from old.cancelled_at then
    raise exception 'Use "Cancel activity" to cancel it.' using errcode = '42501';
  end if;
  if old.cancelled_at is not null then
    raise exception 'Cancelled activities can''t be edited.' using errcode = '22023', hint = 'activity_cancelled';
  end if;
  if old.starts_at <= now() then
    raise exception 'This activity already started, so it can''t be edited.' using errcode = '22023', hint = 'started';
  end if;
  if new.max_participants < momentum_private.taken(old.id) then
    raise exception 'Max can''t be lower than the number of people already going (%).', momentum_private.taken(old.id)
      using errcode = '22023', hint = 'max_below_going';
  end if;

  v_plan_changed := new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
                 or new.general_location is distinct from old.general_location or new.city is distinct from old.city;
  if v_plan_changed then
    select count(*) into v_people from momentum_private.people_on(old.id);
    if v_people > 0 then
      if old.starts_at - now() < interval '3 hours' or new.starts_at - now() < interval '3 hours' then
        raise exception 'People are going, so the date, time and place are locked within 3 hours of the start. Message them instead.'
          using errcode = '22023', hint = 'change_window';
      end if;
      new.changed_at := clock_timestamp();
    end if;
  end if;

  if row(new.type_id, new.title, new.activity_name, new.description, new.what_to_bring, new.starts_at, new.ends_at,
         new.general_location, new.city, new.min_participants, new.max_participants, new.visibility)
     is distinct from
     row(old.type_id, old.title, old.activity_name, old.description, old.what_to_bring, old.starts_at, old.ends_at,
         old.general_location, old.city, old.min_participants, old.max_participants, old.visibility) then
    new.edited_at := clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function momentum_private.check_activity_edit() from public, anon, authenticated;
grant execute on function momentum_private.people_on(uuid), momentum_private.taken(uuid) to authenticated;
drop trigger if exists activities_edit_rules on public.activities;
create trigger activities_edit_rules before update on public.activities
  for each row execute function momentum_private.check_activity_edit();

-- ---------- 2. Tell everyone going when the date, time or place changes ----------
create or replace function momentum_private.notify_activity_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_host text;
begin
  if new.changed_at is not distinct from old.changed_at or new.cancelled_at is not null then return null; end if;
  select first_name into v_host from public.profiles where id = new.host_id;
  -- one up-to-date notice per person per activity
  delete from public.notifications
   where kind = 'activity_changed' and read_at is null and link = 'activity.html?id=' || new.id;
  insert into public.notifications (profile_id, kind, title, body, link)
  select pid, 'activity_changed', v_host || ' changed ' || new.title,
         'Now ' || to_char(new.starts_at at time zone 'America/Denver', 'Dy, Mon FMDD · FMHH12:MI AM') || ' · ' || new.general_location
           || '. You can cancel for free.',
         'activity.html?id=' || new.id
    from momentum_private.people_on(new.id) pid;
  return null;
end $$;
revoke all on function momentum_private.notify_activity_changed() from public, anon, authenticated;
drop trigger if exists activities_notify_changed on public.activities;
-- (fires on every update; the function only acts when changed_at moved, which rule 1 may set itself)
create trigger activities_notify_changed after update on public.activities
  for each row execute function momentum_private.notify_activity_changed();

-- ---------- 3. A new exact address counts as a change of place ----------
create or replace function momentum_private.check_address_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.activities%rowtype;
begin
  if new.exact_address is not distinct from old.exact_address then return new; end if;
  select * into a from public.activities where id = new.activity_id;
  if a.cancelled_at is not null then raise exception 'Cancelled activities can''t be edited.' using errcode = '22023'; end if;
  if exists (select 1 from momentum_private.people_on(new.activity_id)) then
    if a.starts_at - now() < interval '3 hours' then
      raise exception 'People are going, so the address is locked within 3 hours of the start. Message them instead.'
        using errcode = '22023', hint = 'change_window';
    end if;
    update public.activities set changed_at = clock_timestamp(), edited_at = clock_timestamp() where id = new.activity_id; -- notifies (rule 2)
  else
    update public.activities set edited_at = clock_timestamp() where id = new.activity_id;
  end if;
  return new;
end $$;
revoke all on function momentum_private.check_address_edit() from public, anon, authenticated;
drop trigger if exists activity_addresses_edit_rules on public.activity_addresses;
create trigger activity_addresses_edit_rules before update on public.activity_addresses
  for each row execute function momentum_private.check_address_edit();

-- ---------- 4. Free cancel after the plan changed (otherwise same as 018) ----------
create or replace function momentum_private.cancel_commitment(p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  r public.rsvps%rowtype;
  a public.activities%rowtype;
  v_free boolean;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text, 18));
  select * into r from public.rsvps where activity_id = p_activity and profile_id = me and status = 'committed';
  if not found then raise exception 'You''re not committed to this activity.' using errcode = '22023'; end if;
  select * into a from public.activities where id = p_activity;
  if a.starts_at <= now() then raise exception 'This activity already started.' using errcode = '22023', hint = 'started'; end if;
  -- The host changed the date, time or place after you committed: cancelling is free
  v_free := a.changed_at is not null and a.changed_at > r.created_at;
  if not v_free then
    if a.starts_at - now() < interval '3 hours' then
      raise exception 'Commitments can''t be cancelled within 3 hours of the start.' using errcode = '22023', hint = 'cancel_window';
    end if;
    if momentum_private.cancels_this_month(me) >= 2 then
      raise exception 'You''ve used both cancellations for this month.' using errcode = '22023', hint = 'no_cancels';
    end if;
  end if;
  update public.rsvps set status = 'cancelled', cancelled_at = now() where id = r.id;
  delete from public.rsvp_guests where rsvp_id = r.id; -- their +1 goes too
  if not v_free then
    insert into public.rsvp_cancellations (profile_id, activity_id) values (me, p_activity);
  end if;
  return jsonb_build_object('ok', true, 'free', v_free, 'left', greatest(0, 2 - momentum_private.cancels_this_month(me)));
end $$;

-- PREVIEW: what this file set up
select
  (select string_agg(tgname, ', ' order by tgname) from pg_trigger
    where tgname in ('activities_edit_rules', 'activities_notify_changed', 'activity_addresses_edit_rules')) as new_rules,
  (select count(*) from information_schema.columns where table_name = 'activities' and column_name in ('edited_at', 'changed_at')) as new_columns,
  (select string_agg(polname, ', ' order by polname) from pg_policy where polrelid = 'public.activities'::regclass and polcmd = 'w') as edit_policies;

-- commit;
