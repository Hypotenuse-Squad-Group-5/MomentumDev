-- =====================================================================
-- Migration 011: 1-on-1 Private Messaging & Message Requests
--
-- WHAT THIS CHANGES (plain English):
--   1. Ensures conversations, conversation_members, and messages exist.
--   2. Enables Row Level Security (RLS) so users can only read direct
--      conversations, members, and messages they belong to.
--   3. Installs checked RPC functions:
--        - public.send_direct_message(p_recipient_id, p_body, p_activity_id)
--            * Friends: starts/continues an active conversation immediately.
--            * Non-friends: creates a message request (recipient = 'requested').
--            * Pending requests: allows 1 initial message, then 1 follow-up
--              after 7 days if unanswered (max 2 messages until accepted).
--            * Declined requests: blocks further requests unless you become friends.
--        - public.respond_message_request(p_conversation_id, p_accept)
--            * Recipient accepts -> status becomes 'active'.
--            * Recipient declines -> status becomes 'declined'.
--   4. Installs a trigger on friendships so accepting a friend request
--      automatically promotes any pending or declined 1-on-1 chat to 'active'.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run.
--   Re-running is safe (idempotent).
-- =====================================================================

begin;

-- ---------- 1. Ensure tables & indexes exist ----------
create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('direct','activity_group')),
  activity_id  uuid references public.activities (id) on delete set null,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,
  check (kind = 'direct' or activity_id is not null)
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'active' check (status in ('active','requested','declined')),
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz,
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_created
  on public.messages (conversation_id, created_at);

create index if not exists conversation_members_profile
  on public.conversation_members (profile_id, conversation_id);

-- ---------- 2. Private schema & RLS membership helper ----------
create schema if not exists momentum_private;
revoke all on schema momentum_private from public, anon;
grant usage on schema momentum_private to authenticated;

create or replace function momentum_private.is_conversation_member(p_conversation_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and c.kind = 'direct'
      and cm.profile_id = p_profile_id
  );
$$;

revoke all on function momentum_private.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function momentum_private.is_conversation_member(uuid, uuid) to authenticated;

-- ---------- 3. Row Level Security & Grants ----------
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "read own direct conversations" on public.conversations;
drop policy if exists "read own conversation members" on public.conversation_members;
drop policy if exists "update own last_read_at" on public.conversation_members;
drop policy if exists "read own conversation messages" on public.messages;

create policy "read own direct conversations" on public.conversations
  for select to authenticated
  using (
    kind = 'direct'
    and momentum_private.is_conversation_member(id, (select public.current_profile_id()))
  );

create policy "read own conversation members" on public.conversation_members
  for select to authenticated
  using (
    momentum_private.is_conversation_member(conversation_id, (select public.current_profile_id()))
  );

create policy "update own last_read_at" on public.conversation_members
  for update to authenticated
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));

create policy "read own conversation messages" on public.messages
  for select to authenticated
  using (
    momentum_private.is_conversation_member(conversation_id, (select public.current_profile_id()))
  );

revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- ---------- 4. Checked RPC: Send a direct message ----------
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

create or replace function public.send_direct_message(
  p_recipient_id uuid,
  p_body text,
  p_activity_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select momentum_private.send_direct_message(p_recipient_id, p_body, p_activity_id);
$$;

revoke all on function public.send_direct_message(uuid, text, uuid) from public, anon;
grant execute on function public.send_direct_message(uuid, text, uuid) to authenticated;

-- ---------- 5. Checked RPC: Accept or decline a message request ----------
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

create or replace function public.respond_message_request(
  p_conversation_id uuid,
  p_accept boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select momentum_private.respond_message_request(p_conversation_id, p_accept);
$$;

revoke all on function public.respond_message_request(uuid, boolean) from public, anon;
grant execute on function public.respond_message_request(uuid, boolean) to authenticated;

-- ---------- 6. Trigger: Auto-promote chats when users become friends ----------
create or replace function momentum_private.promote_chat_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    update public.conversation_members cm
       set status = 'active'
     where cm.status in ('requested', 'declined')
       and cm.conversation_id in (
         select c.id
           from public.conversations c
           join public.conversation_members m1 on m1.conversation_id = c.id and m1.profile_id = new.requester_id
           join public.conversation_members m2 on m2.conversation_id = c.id and m2.profile_id = new.addressee_id
          where c.kind = 'direct'
       );
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_promote_chat on public.friendships;
create trigger friendships_promote_chat
  after insert or update of status on public.friendships
  for each row execute function momentum_private.promote_chat_on_friendship();

commit;
