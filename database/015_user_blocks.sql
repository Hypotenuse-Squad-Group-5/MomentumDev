-- =====================================================================
-- Migration 015: Private Messaging User Blocks
--
-- WHAT THIS CHANGES (plain English):
--   1. Creates public.user_blocks (blocker_id, blocked_id, created_at)
--      so users can block someone from private messaging without
--      overwriting friendships or conversation_members status.
--   2. Enables Row Level Security (RLS) so:
--        - Users can only create/remove blocks where they are the blocker.
--        - Users can only read block rows involving themselves
--          (so neither side nor third parties can inspect anyone else's blocks).
--   3. Updates momentum_private.send_direct_message and
--      momentum_private.respond_message_request to reject messages or
--      acceptances whenever either user has blocked the other.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
--   Re-running is safe (idempotent).
-- =====================================================================

begin;

-- ---------- 1. Ensure user_blocks table & index exist ----------
create table if not exists public.user_blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

-- ---------- 2. Row Level Security & Grants ----------
alter table public.user_blocks enable row level security;

drop policy if exists "read own blocks" on public.user_blocks;
drop policy if exists "create own blocks" on public.user_blocks;
drop policy if exists "delete own blocks" on public.user_blocks;

create policy "read own blocks" on public.user_blocks
  for select to authenticated
  using (
    blocker_id = (select public.current_profile_id())
    or blocked_id = (select public.current_profile_id())
  );

create policy "create own blocks" on public.user_blocks
  for insert to authenticated
  with check (
    blocker_id = (select public.current_profile_id())
    and blocker_id <> blocked_id
  );

create policy "delete own blocks" on public.user_blocks
  for delete to authenticated
  using (
    blocker_id = (select public.current_profile_id())
  );

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

-- ---------- 3. Enforce blocks in send_direct_message ----------
create or replace function momentum_private.send_direct_message(
  p_recipient_id uuid,
  p_body text,
  p_activity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_activity_id uuid := p_activity_id;
  v_are_friends boolean := false;
  v_convo_id uuid;
  v_convo_created_at timestamptz;
  v_convo_activity_id uuid;
  v_my_status text;
  v_other_status text;
  v_recip_status text;
  v_msg_count integer;
  v_first_at timestamptz;
  v_msg_id uuid;
  v_msg_at timestamptz;
  v_now timestamptz := now();
  v_members jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send messages.' using errcode = '42501';
  end if;

  select id into v_me from public.profiles where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Your account profile could not be found.' using errcode = '42501';
  end if;

  if p_recipient_id is null or p_recipient_id = v_me then
    raise exception 'Choose someone else to message.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'That user could not be found.' using errcode = '22023';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Messages must be between 1 and 2,000 characters.' using errcode = '22023';
  end if;

  -- Serialize direct conversation creation/messages for this pair.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(v_me::text, p_recipient_id::text) || ':' || greatest(v_me::text, p_recipient_id::text),
      11
    )
  );

  -- Messaging block check (either direction prevents sending).
  if exists (
    select 1
      from public.user_blocks ub
     where (ub.blocker_id = v_me and ub.blocked_id = p_recipient_id)
        or (ub.blocker_id = p_recipient_id and ub.blocked_id = v_me)
  ) then
    raise exception 'Messaging this person is currently unavailable.' using errcode = '42501';
  end if;

  if v_activity_id is not null and not exists (select 1 from public.activities where id = v_activity_id) then
    v_activity_id := null;
  end if;

  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_me and f.addressee_id = p_recipient_id)
        or (f.requester_id = p_recipient_id and f.addressee_id = v_me)
      )
  ) into v_are_friends;

  select c.id, c.created_at, c.activity_id
    into v_convo_id, v_convo_created_at, v_convo_activity_id
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.profile_id = v_me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.profile_id = p_recipient_id
  where c.kind = 'direct'
    and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) = 2
  order by c.created_at asc
  limit 1;

  if v_convo_id is null then
    insert into public.conversations (kind, activity_id, created_at)
    values ('direct', v_activity_id, v_now)
    returning id, created_at, activity_id into v_convo_id, v_convo_created_at, v_convo_activity_id;

    v_recip_status := case when v_are_friends then 'active' else 'requested' end;

    insert into public.conversation_members (conversation_id, profile_id, status, joined_at, last_read_at)
    values
      (v_convo_id, v_me, 'active', v_now, v_now),
      (v_convo_id, p_recipient_id, v_recip_status, v_now, null);
  else
    select status into v_my_status
      from public.conversation_members
     where conversation_id = v_convo_id and profile_id = v_me;

    select status into v_other_status
      from public.conversation_members
     where conversation_id = v_convo_id and profile_id = p_recipient_id;

    if v_are_friends then
      if v_my_status <> 'active' or v_other_status <> 'active' then
        update public.conversation_members
           set status = 'active'
         where conversation_id = v_convo_id;
      end if;
    else
      if v_my_status = 'active' and v_other_status = 'active' then
        null;
      elsif v_my_status = 'declined' then
        -- Recipient previously declined, and is now initiating a chat back.
        update public.conversation_members
           set status = 'active'
         where conversation_id = v_convo_id;
      elsif v_my_status = 'requested' then
        raise exception 'Accept this message request before replying.' using errcode = 'check_violation';
      elsif v_other_status = 'declined' then
        raise exception 'Follow-up messages are not available for this request.' using errcode = 'check_violation';
      elsif v_other_status = 'requested' then
        select count(*), min(created_at)
          into v_msg_count, v_first_at
          from public.messages
         where conversation_id = v_convo_id;

        if v_msg_count = 1 and (v_now - v_first_at) < interval '7 days' then
          raise exception 'You can send 1 follow-up message after 7 days if they have not responded.' using errcode = 'check_violation';
        elsif v_msg_count >= 2 then
          raise exception 'You have already sent your follow-up message.' using errcode = 'check_violation';
        end if;
      end if;
    end if;

    update public.conversation_members
       set last_read_at = v_now
     where conversation_id = v_convo_id and profile_id = v_me;
  end if;

  insert into public.messages (conversation_id, sender_id, body, created_at)
  values (v_convo_id, v_me, v_body, v_now)
  returning id, created_at into v_msg_id, v_msg_at;

  select jsonb_agg(
    jsonb_build_object(
      'id', cm.profile_id,
      'status', cm.status,
      'lastReadAt', cm.last_read_at
    )
    order by cm.joined_at, cm.profile_id
  )
  into v_members
  from public.conversation_members cm
  where cm.conversation_id = v_convo_id;

  return jsonb_build_object(
    'ok', true,
    'conversationId', v_convo_id,
    'activityId', v_convo_activity_id,
    'createdAt', v_convo_created_at,
    'members', v_members,
    'message', jsonb_build_object(
      'id', v_msg_id,
      'senderId', v_me,
      'body', v_body,
      'at', v_msg_at
    )
  );
end;
$$;

revoke all on function momentum_private.send_direct_message(uuid, text, uuid) from public, anon;
grant execute on function momentum_private.send_direct_message(uuid, text, uuid) to authenticated;

-- ---------- 4. Enforce blocks in respond_message_request ----------
create or replace function momentum_private.respond_message_request(
  p_conversation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid;
  v_other uuid;
  v_kind text;
  v_status text;
  v_next text := case when coalesce(p_accept, false) then 'active' else 'declined' end;
begin
  if auth.uid() is null then
    raise exception 'Sign in to respond to message requests.' using errcode = '42501';
  end if;

  select id into v_me from public.profiles where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Your account profile could not be found.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_conversation_id::text, 12)
  );

  select c.kind, cm.status
    into v_kind, v_status
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id
   and cm.profile_id = v_me
  where c.id = p_conversation_id;

  if not found or v_kind <> 'direct' then
    raise exception 'Message request not found.' using errcode = '22023';
  end if;

  select cm.profile_id
    into v_other
    from public.conversation_members cm
   where cm.conversation_id = p_conversation_id
     and cm.profile_id <> v_me
   limit 1;

  if v_other is not null and exists (
    select 1
      from public.user_blocks ub
     where (ub.blocker_id = v_me and ub.blocked_id = v_other)
        or (ub.blocker_id = v_other and ub.blocked_id = v_me)
  ) then
    raise exception 'Messaging this person is currently unavailable.' using errcode = '42501';
  end if;

  if v_status = 'requested' or (p_accept and v_status = 'declined') then
    update public.conversation_members
       set status = v_next,
           last_read_at = now()
     where conversation_id = p_conversation_id
       and profile_id = v_me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'conversationId', p_conversation_id,
    'status', v_next
  );
end;
$$;

revoke all on function momentum_private.respond_message_request(uuid, boolean) from public, anon;
grant execute on function momentum_private.respond_message_request(uuid, boolean) to authenticated;

commit;

-- ---------- 5. Verify all database changes ----------
select change_type, object, details
from (
  select
    1 as sort_key,
    'table' as change_type,
    'public.user_blocks' as object,
    (
      select string_agg(
        c.column_name || ' ' || c.data_type || case when c.is_nullable = 'NO' then ' NOT NULL' else '' end,
        ', ' order by c.ordinal_position
      )
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'user_blocks'
    ) as details

  union all

  select
    2 as sort_key,
    'constraint' as change_type,
    'public.user_blocks.' || con.conname as object,
    pg_catalog.pg_get_constraintdef(con.oid) as details
  from pg_catalog.pg_constraint con
  where con.conrelid = 'public.user_blocks'::regclass

  union all

  select
    3 as sort_key,
    'index' as change_type,
    'public.' || idx.indexname as object,
    idx.indexdef as details
  from pg_catalog.pg_indexes idx
  where idx.schemaname = 'public' and idx.tablename = 'user_blocks'

  union all

  select
    4 as sort_key,
    'rls' as change_type,
    'public.user_blocks' as object,
    case when cls.relrowsecurity then 'RLS enabled' else 'RLS disabled' end as details
  from pg_catalog.pg_class cls
  where cls.oid = 'public.user_blocks'::regclass

  union all

  select
    5 as sort_key,
    'policy' as change_type,
    'public.user_blocks -> "' || pol.policyname || '"' as object,
    pol.cmd || ' to ' || array_to_string(pol.roles, ', ')
      || coalesce(' | USING (' || pol.qual || ')', '')
      || coalesce(' | WITH CHECK (' || pol.with_check || ')', '') as details
  from pg_catalog.pg_policies pol
  where pol.schemaname = 'public' and pol.tablename = 'user_blocks'

  union all

  select
    6 as sort_key,
    'table_grants' as change_type,
    'public.user_blocks' as object,
    'authenticated: ' || coalesce((
      select string_agg(g.privilege_type, ', ' order by g.privilege_type)
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = 'user_blocks' and g.grantee = 'authenticated'
    ), 'none')
    || ' | anon: ' || coalesce((
      select string_agg(g.privilege_type, ', ' order by g.privilege_type)
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = 'user_blocks' and g.grantee = 'anon'
    ), 'none') as details

  union all

  select
    7 as sort_key,
    'function' as change_type,
    n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as object,
    'security_definer=' || p.prosecdef::text
      || ' | enforces_user_blocks=' || (position('public.user_blocks' in p.prosrc) > 0)::text
      || ' | authenticated_exec=' || pg_catalog.has_function_privilege('authenticated', p.oid, 'execute')::text
      || ' | anon_exec=' || pg_catalog.has_function_privilege('anon', p.oid, 'execute')::text as details
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'momentum_private'
    and p.proname in ('send_direct_message', 'respond_message_request')
) as changes
order by sort_key, object;

