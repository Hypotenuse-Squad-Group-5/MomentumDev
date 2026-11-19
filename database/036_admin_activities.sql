-- =====================================================================
-- Migration 036: admin activity management and official Momentum events
-- Run as-is to preview. If the preview is correct, uncomment COMMIT and run again.
-- =====================================================================

begin;

alter table public.activities
  add column if not exists official boolean not null default false;

-- READ: admins can see every activity, regardless of normal visibility rules.
create or replace function momentum_private.admin_list_activities()
returns table (
  id uuid, host_id uuid, host_name text, type_id smallint, type_name text,
  title text, activity_name text, description text, what_to_bring text,
  starts_at timestamptz, ends_at timestamptz, general_location text, city text,
  latitude numeric, longitude numeric, exact_address text,
  min_participants smallint, max_participants smallint, visibility text,
  cancelled_at timestamptz, edited_at timestamptz, changed_at timestamptz,
  official boolean, going_count integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  return query
    select a.id, a.host_id, coalesce(p.first_name, 'Unknown'), a.type_id, t.name,
      a.title, a.activity_name, a.description, a.what_to_bring,
      a.starts_at, a.ends_at, a.general_location, a.city, a.latitude, a.longitude,
      aa.exact_address, a.min_participants, a.max_participants, a.visibility,
      a.cancelled_at, a.edited_at, a.changed_at, a.official,
      momentum_private.taken(a.id)
    from public.activities a
    left join public.profiles p on p.id = a.host_id
    left join public.activity_types t on t.id = a.type_id
    left join public.activity_addresses aa on aa.activity_id = a.id
    order by a.starts_at desc;
end $$;
revoke all on function momentum_private.admin_list_activities() from public, anon;
grant execute on function momentum_private.admin_list_activities() to authenticated;

create or replace function public.admin_list_activities()
returns table (
  id uuid, host_id uuid, host_name text, type_id smallint, type_name text,
  title text, activity_name text, description text, what_to_bring text,
  starts_at timestamptz, ends_at timestamptz, general_location text, city text,
  latitude double precision, longitude double precision, exact_address text,
  min_participants integer, max_participants integer, visibility text,
  cancelled_at timestamptz, edited_at timestamptz, changed_at timestamptz,
  official boolean, going_count integer
)
language sql stable security invoker set search_path = '' as $$
  select * from momentum_private.admin_list_activities();
$$;
revoke all on function public.admin_list_activities() from public, anon;
grant execute on function public.admin_list_activities() to authenticated;

-- CREATE / UPDATE: p_data contains the editable activity fields and exact address.
-- Admin-created activities are hosted by the signed-in admin but branded as Momentum.
create or replace function momentum_private.admin_save_activity(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_profile_id();
  a public.activities%rowtype;
  v_type smallint;
  v_title text := nullif(btrim(p_data->>'title'), '');
  v_starts timestamptz := nullif(p_data->>'starts_at', '')::timestamptz;
  v_ends timestamptz := nullif(p_data->>'ends_at', '')::timestamptz;
  v_location text := nullif(btrim(p_data->>'general_location'), '');
  v_city text := nullif(btrim(p_data->>'city'), '');
  v_address text := nullif(btrim(p_data->>'exact_address'), '');
  v_min integer := coalesce(nullif(p_data->>'min_participants', '')::integer, 3);
  v_max integer := coalesce(nullif(p_data->>'max_participants', '')::integer, 100);
  v_people integer;
  v_plan_changed boolean;
begin
  perform momentum_private.require_admin();
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  v_type := nullif(p_data->>'type_id', '')::smallint;
  if v_title is null or char_length(v_title) > 50 then raise exception 'Title is required and must be 50 characters or fewer.' using errcode = '22023'; end if;
  if v_type is null or not exists (select 1 from public.activity_types t where t.id = v_type) then raise exception 'Choose a valid activity category.' using errcode = '22023'; end if;
  if v_starts is null or v_ends is null or v_starts <= now() or v_ends <= v_starts then raise exception 'Choose a future start time and an end time after it.' using errcode = '22023'; end if;
  if v_location is null or v_city is null or v_address is null then raise exception 'Enter the general location, city, and exact address.' using errcode = '22023'; end if;
  if v_min not between 3 and 100 or v_max not between 3 and 100 or v_min > v_max then raise exception 'Minimum and maximum group sizes must be between 3 and 100, with minimum no greater than maximum.' using errcode = '22023'; end if;
  if coalesce(p_data->>'visibility', 'public') not in ('public', 'friends') then raise exception 'Choose a valid visibility.' using errcode = '22023'; end if;

  if p_id is null then
    insert into public.activities (
      host_id, type_id, title, activity_name, description, what_to_bring,
      starts_at, ends_at, general_location, city, min_participants, max_participants,
      visibility, official
    ) values (
      me, v_type, v_title, v_title, coalesce(p_data->>'description', ''),
      nullif(btrim(p_data->>'what_to_bring'), ''), v_starts, v_ends, v_location, v_city,
      v_min, v_max, coalesce(p_data->>'visibility', 'public'), true
    ) returning * into a;
    insert into public.activity_addresses(activity_id, exact_address) values (a.id, v_address);
    return a.id;
  end if;

  select * into a from public.activities where id = p_id for update;
  if not found then raise exception 'That activity no longer exists.' using errcode = '22023'; end if;
  if a.cancelled_at is not null then raise exception 'Cancelled activities can''t be edited.' using errcode = '22023'; end if;
  if a.starts_at <= now() then raise exception 'This activity already started and can no longer be edited.' using errcode = '22023'; end if;
  if v_max < momentum_private.taken(p_id) then
    raise exception 'Max can''t be lower than the number of people already going (%).', momentum_private.taken(p_id) using errcode = '22023';
  end if;
  v_plan_changed := a.starts_at is distinct from v_starts or a.ends_at is distinct from v_ends
    or a.general_location is distinct from v_location or a.city is distinct from v_city
    or exists (select 1 from public.activity_addresses aa where aa.activity_id = p_id and aa.exact_address is distinct from v_address);
  select count(*) into v_people from momentum_private.people_on(p_id);
  if v_plan_changed and v_people > 0 and (a.starts_at - now() < interval '3 hours' or v_starts - now() < interval '3 hours') then
    raise exception 'People are going, so the date, time and place are locked within 3 hours of the start. Message them instead.' using errcode = '22023';
  end if;

  update public.activities set
    type_id = v_type, title = v_title, activity_name = v_title,
    description = coalesce(p_data->>'description', ''),
    what_to_bring = nullif(btrim(p_data->>'what_to_bring'), ''),
    starts_at = v_starts, ends_at = v_ends, general_location = v_location, city = v_city,
    min_participants = v_min, max_participants = v_max,
    visibility = coalesce(p_data->>'visibility', 'public'),
    official = coalesce((p_data->>'official')::boolean, official),
    edited_at = clock_timestamp(),
    changed_at = case when v_plan_changed and v_people > 0 then clock_timestamp() else changed_at end
  where id = p_id;

  insert into public.activity_addresses(activity_id, exact_address)
  values (p_id, v_address)
  on conflict (activity_id) do update set exact_address = excluded.exact_address;
  return p_id;
end $$;
revoke all on function momentum_private.admin_save_activity(uuid, jsonb) from public, anon;
grant execute on function momentum_private.admin_save_activity(uuid, jsonb) to authenticated;

create or replace function public.admin_save_activity(p_id uuid, p_data jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select momentum_private.admin_save_activity(p_id, p_data);
$$;
revoke all on function public.admin_save_activity(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_activity(uuid, jsonb) to authenticated;

-- CANCEL: keeps the activity in history and notifies all committed people/+1s.
-- Admin cancellations do not consume the host's personal monthly cancellation allowance.
create or replace function momentum_private.admin_cancel_activity(p_activity uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activities%rowtype;
  v_host text;
begin
  perform momentum_private.require_admin();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_activity::text, 18));
  select * into a from public.activities where id = p_activity for update;
  if not found then raise exception 'That activity no longer exists.' using errcode = '22023'; end if;
  if a.cancelled_at is not null then raise exception 'This activity is already cancelled.' using errcode = '22023'; end if;
  if a.starts_at <= now() then raise exception 'This activity already started.' using errcode = '22023'; end if;
  if a.starts_at - now() < interval '3 hours' and exists (select 1 from momentum_private.people_on(p_activity)) then
    raise exception 'People are going and this activity starts within 3 hours. Message them instead.' using errcode = '22023';
  end if;
  update public.activities set cancelled_at = now() where id = p_activity;
  select first_name into v_host from public.profiles where id = a.host_id;
  insert into public.notifications (profile_id, kind, title, body, link)
  select pid, 'activity_cancelled', coalesce(v_host, 'The host') || ' cancelled ' || a.title,
    to_char(a.starts_at at time zone 'America/Denver', 'Dy, Mon FMDD · FMHH12:MI AM'),
    'activity.html?id=' || a.id
  from momentum_private.people_on(p_activity) pid;
  return jsonb_build_object('ok', true, 'action', 'cancelled');
end $$;
revoke all on function momentum_private.admin_cancel_activity(uuid) from public, anon;
grant execute on function momentum_private.admin_cancel_activity(uuid) to authenticated;

create or replace function public.admin_cancel_activity(p_activity uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select momentum_private.admin_cancel_activity(p_activity);
$$;
revoke all on function public.admin_cancel_activity(uuid) from public, anon;
grant execute on function public.admin_cancel_activity(uuid) to authenticated;

-- DELETE: explicit confirmation is handled in the admin interface.
create or replace function momentum_private.admin_delete_activity(p_activity uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  delete from public.activities where id = p_activity;
  if not found then raise exception 'That activity no longer exists.' using errcode = '22023'; end if;
end $$;
revoke all on function momentum_private.admin_delete_activity(uuid) from public, anon;
grant execute on function momentum_private.admin_delete_activity(uuid) to authenticated;

create or replace function public.admin_delete_activity(p_activity uuid)
returns void language sql security invoker set search_path = '' as $$
  select momentum_private.admin_delete_activity(p_activity);
$$;
revoke all on function public.admin_delete_activity(uuid) from public, anon;
grant execute on function public.admin_delete_activity(uuid) to authenticated;

-- PREVIEW
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'activities' and column_name = 'official') as official_column,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_list_activities','admin_save_activity','admin_cancel_activity','admin_delete_activity')) as public_admin_functions;

-- commit;
