-- =====================================================================
-- Migration 023: post visibility, cancelling/deleting activities, notifications,
--                deleting your account
-- (022 is left for the activity-capacity-100 change, which so far is only in
--  supabase/migrations/.)
--
-- 1. POSTS: "Friends Only" posts are really friends-only now. Before this, every post
--    was saved as Public and only public posts could be read. Authors can change a
--    post's visibility later (that column only).
-- 2. ACTIVITIES (hosts):
--      nobody else going ......... DELETE: gone for good, any time.
--      people going .............. CANCEL: the activity stays visible to them, marked
--                                  cancelled (cancelled_at). Uses 1 of the host's 2
--                                  cancellations this month. Not within 3 hours of the
--                                  start, and not once it has started. Everyone going
--                                  (and their +1s) gets a notification.
--    A cancelled activity can't be committed to, cancelled again by attendees, checked
--    into, or un-cancelled, and it doesn't block your time slot.
--    The cancellation log now keeps its rows if an activity is deleted (before, deleting
--    an activity quietly handed people their used cancellations back).
-- 3. NOTIFICATIONS: you can read your own and mark them read. Only the database creates
--    them (right now: "activity cancelled").
-- 4. DELETE MY ACCOUNT: removes your login and everything of yours. Refused while you
--    host an upcoming activity that people are going to (cancel those first).
--
-- Settings need no change here: user_settings already has a column for every setting
-- the page keeps, and each person can read and edit only their own row (001).
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
--   Then upload the site files.
-- =====================================================================

begin;

-- ---------- Helper: are these two people friends? ----------
create or replace function momentum_private.are_friends(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a)));
$$;
revoke all on function momentum_private.are_friends(uuid, uuid) from public, anon;
grant execute on function momentum_private.are_friends(uuid, uuid) to authenticated;

-- ---------- 1. Posts ----------
drop policy if exists "read public or own posts" on public.posts;
drop policy if exists "read posts you're allowed to see" on public.posts;
create policy "read posts you're allowed to see" on public.posts
  for select to authenticated
  using (visibility = 'public'
         or author_id = public.current_profile_id()
         or (visibility = 'friends' and momentum_private.are_friends(author_id, public.current_profile_id())));
grant update (visibility) on public.posts to authenticated;
drop policy if exists "change own post visibility" on public.posts;
create policy "change own post visibility" on public.posts
  for update to authenticated
  using (author_id = public.current_profile_id())
  with check (author_id = public.current_profile_id());

-- ---------- 2. Activities: cancel or delete ----------
alter table public.activities add column if not exists cancelled_at timestamptz;

-- Keep cancellation log rows when an activity is deleted
alter table public.rsvp_cancellations alter column activity_id drop not null;
alter table public.rsvp_cancellations drop constraint if exists rsvp_cancellations_activity_id_fkey;
alter table public.rsvp_cancellations add constraint rsvp_cancellations_activity_id_fkey
  foreign key (activity_id) references public.activities (id) on delete set null;

-- Notifications can say "activity cancelled"
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('activity_reminder', 'plus_one_invite', 'friend_request', 'message', 'streak', 'activity_cancelled'));

-- Who else is on this activity (committed people + their accepted or pending +1s)
create or replace function momentum_private.people_on(p_activity uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select r.profile_id from public.rsvps r where r.activity_id = p_activity and r.status = 'committed'
  union
  select g.guest_profile_id from public.rsvp_guests g join public.rsvps r on r.id = g.rsvp_id
   where r.activity_id = p_activity and r.status = 'committed' and g.guest_profile_id is not null and g.status in ('accepted', 'pending');
$$;
revoke all on function momentum_private.people_on(uuid) from public, anon, authenticated;

create or replace function momentum_private.cancel_or_delete_activity(p_activity uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  a public.activities%rowtype;
  v_host text;
  v_going int;
  v_named int;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text, 18));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_activity::text, 18));
  select * into a from public.activities where id = p_activity;
  if not found or a.host_id <> me then raise exception 'Only the host can cancel this activity.' using errcode = '42501'; end if;
  if a.cancelled_at is not null then raise exception 'This activity is already cancelled.' using errcode = '22023', hint = 'already'; end if;
  select count(*) into v_going from momentum_private.people_on(p_activity);
  select count(*) into v_named from public.rsvp_guests g join public.rsvps r on r.id = g.rsvp_id
   where r.activity_id = p_activity and r.status = 'committed' and g.guest_profile_id is null and g.status = 'accepted';

  if v_going = 0 and v_named = 0 then
    delete from public.activities where id = p_activity; -- nobody to tell: gone for good
    return jsonb_build_object('ok', true, 'action', 'deleted');
  end if;

  if a.starts_at <= now() then
    raise exception 'This activity already started, so it stays in everyone''s history.' using errcode = '22023', hint = 'started';
  end if;
  if a.starts_at - now() < interval '3 hours' then
    raise exception 'It starts within 3 hours, so it can''t be cancelled now. Message the people going instead.' using errcode = '22023', hint = 'cancel_window';
  end if;
  if momentum_private.cancels_this_month(me) >= 2 then
    raise exception 'You''ve used both cancellations for this month.' using errcode = '22023', hint = 'no_cancels';
  end if;

  update public.activities set cancelled_at = now() where id = p_activity;
  insert into public.rsvp_cancellations (profile_id, activity_id) values (me, p_activity);
  select first_name into v_host from public.profiles where id = me;
  insert into public.notifications (profile_id, kind, title, body, link)
  select pid, 'activity_cancelled', v_host || ' cancelled ' || a.title,
         to_char(a.starts_at at time zone 'America/Denver', 'Dy, Mon FMDD · FMHH12:MI AM'),
         'activity.html?id=' || a.id
    from momentum_private.people_on(p_activity) pid;
  return jsonb_build_object('ok', true, 'action', 'cancelled', 'left', greatest(0, 2 - momentum_private.cancels_this_month(me)));
end $$;
revoke all on function momentum_private.cancel_or_delete_activity(uuid) from public, anon;
grant execute on function momentum_private.cancel_or_delete_activity(uuid) to authenticated;
create or replace function public.cancel_or_delete_activity(p_activity uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.cancel_or_delete_activity(p_activity); $$;
revoke all on function public.cancel_or_delete_activity(uuid) from public, anon;
grant execute on function public.cancel_or_delete_activity(uuid) to authenticated;

-- A cancelled activity: no committing, no +1 accepting, no attendee cancelling, no check-in
create or replace function momentum_private.block_cancelled_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_activity uuid;
begin
  if tg_table_name = 'rsvp_guests' then
    select activity_id into v_activity from public.rsvps where id = new.rsvp_id;
  else
    v_activity := new.activity_id;
  end if;
  if exists (select 1 from public.activities where id = v_activity and cancelled_at is not null) then
    raise exception 'The host cancelled this activity.' using errcode = '22023', hint = 'activity_cancelled';
  end if;
  return new;
end $$;
revoke all on function momentum_private.block_cancelled_activity() from public, anon, authenticated;
drop trigger if exists rsvps_not_on_cancelled on public.rsvps;
create trigger rsvps_not_on_cancelled before insert or update on public.rsvps
  for each row execute function momentum_private.block_cancelled_activity();
drop trigger if exists rsvp_guests_not_on_cancelled on public.rsvp_guests;
create trigger rsvp_guests_not_on_cancelled before insert or update on public.rsvp_guests
  for each row execute function momentum_private.block_cancelled_activity();

-- Cancelled activities don't hold your time slot (30-minute rule from 018)
create or replace function momentum_private.conflict_with(p_activity uuid, p_profile uuid) returns text
language sql stable security definer set search_path = '' as $$
  select o.title from public.activities a, public.activities o
   where a.id = p_activity and o.id <> a.id and o.cancelled_at is null and momentum_private.is_going(o.id, p_profile)
     and a.starts_at < o.ends_at + interval '30 minutes' and a.ends_at > o.starts_at - interval '30 minutes'
   order by o.starts_at limit 1;
$$;

-- ---------- 3. Notifications: read your own, mark them read ----------
alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (profile_id = public.current_profile_id());
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- 4. Delete my account ----------
create or replace function momentum_private.delete_my_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  v_login uuid;
  v_titles text;
  v_n int;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select count(*), string_agg(a.title, ', ' order by a.starts_at) into v_n, v_titles
    from public.activities a
   where a.host_id = me and a.cancelled_at is null and a.starts_at > now()
     and exists (select 1 from momentum_private.people_on(a.id));
  if v_n > 0 then
    raise exception '%', case when v_n = 1
        then 'You''re hosting an upcoming activity people are going to (' || v_titles || '). Cancel it first.'
        else 'You''re hosting ' || v_n || ' upcoming activities people are going to (' || v_titles || '). Cancel them first.' end
      using errcode = '22023', hint = 'hosting';
  end if;
  select auth_user_id into v_login from public.profiles where id = me;
  delete from auth.users where id = v_login; -- the profile and everything of yours go with it
  return jsonb_build_object('ok', true);
end $$;
revoke all on function momentum_private.delete_my_account() from public, anon;
grant execute on function momentum_private.delete_my_account() to authenticated;
create or replace function public.delete_my_account() returns jsonb
language sql security invoker set search_path = '' as $$ select momentum_private.delete_my_account(); $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- PREVIEW: what this file set up
select
  (select string_agg(polname, ', ' order by polname) from pg_policy where polrelid = 'public.posts'::regclass) as post_rules,
  (select count(*) from public.posts where visibility = 'friends')                  as friends_only_posts,
  (select count(*) from information_schema.columns where table_name = 'activities' and column_name = 'cancelled_at') as cancelled_column,
  (select string_agg(polname, ', ' order by polname) from pg_policy where polrelid = 'public.notifications'::regclass) as notification_rules,
  (select string_agg(proname, ', ' order by proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname in ('cancel_or_delete_activity', 'delete_my_account'))   as new_functions;

-- commit;
