-- =====================================================================
-- Migration 035: Admin › Posts & announcements (teammate 3)
--
-- Adds announcement and moderation support to public.posts, plus admin RPC
-- functions for full CRUD over posts.
--
-- Every function starts with momentum_private.require_admin() (migration 032),
-- so only admins can execute them.
--   READ    admin_list_posts()             every post site-wide, newest first, with author
--   CREATE  admin_create_announcement(caption) creates a pinned announcement branded as Momentum
--   UPDATE  admin_update_post(id, caption) edits a post's caption; tags non-announcement edits as "Edited by admin"
--           admin_set_post_hidden(id, hidden) hides or unhides a post from public feeds
--   DELETE  admin_delete_post(id, reason)  permanently deletes a post and notifies the author if it was someone else's post
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- ---------- 1. Column additions to public.posts ----------
alter table public.posts
  add column if not exists is_announcement boolean not null default false,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists edited_by_admin boolean not null default false,
  add column if not exists admin_edited_at timestamptz;

-- ---------- 2. Update notifications check constraint for post_deleted ----------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('activity_reminder', 'plus_one_invite', 'friend_request', 'message', 'streak', 'activity_cancelled', 'activity_changed', 'post_deleted'));

-- ---------- 3. Update RLS policy on public.posts ----------
-- Announcements are readable by all authenticated members when not hidden.
-- Normal posts remain friends-only. Hidden posts are readable only by their author.
drop policy if exists "read friends or own posts" on public.posts;
create policy "read friends or own posts" on public.posts
  for select to authenticated
  using (
    (
      (is_announcement = true and is_hidden = false)
      or (
        (is_hidden = false or author_id = public.current_profile_id())
        and (
          author_id = public.current_profile_id()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.requester_id = public.current_profile_id() and f.addressee_id = posts.author_id)
                or (f.addressee_id = public.current_profile_id() and f.requester_id = posts.author_id)
              )
          )
        )
      )
    )
  );

-- ---------- 4. READ: list all posts site-wide ----------
create or replace function momentum_private.admin_list_posts()
returns table (
  id uuid, author_id uuid, author_name text, author_username text,
  caption text, activity_id uuid, activity_title text, visibility text,
  is_announcement boolean, is_hidden boolean, edited_by_admin boolean,
  admin_edited_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  return query
    select
      p.id, p.author_id, coalesce(pr.first_name, 'Unknown')::text, pr.username::text,
      p.caption, p.activity_id, a.title::text, p.visibility,
      p.is_announcement, p.is_hidden, p.edited_by_admin,
      p.admin_edited_at, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    left join public.activities a on a.id = p.activity_id
    order by p.created_at desc;
end $$;
revoke all on function momentum_private.admin_list_posts() from public, anon;
grant execute on function momentum_private.admin_list_posts() to authenticated;

create or replace function public.admin_list_posts()
returns table (
  id uuid, author_id uuid, author_name text, author_username text,
  caption text, activity_id uuid, activity_title text, visibility text,
  is_announcement boolean, is_hidden boolean, edited_by_admin boolean,
  admin_edited_at timestamptz, created_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select * from momentum_private.admin_list_posts();
$$;
revoke all on function public.admin_list_posts() from public, anon;
grant execute on function public.admin_list_posts() to authenticated;

-- ---------- 5. CREATE: post an official announcement ----------
create or replace function momentum_private.admin_create_announcement(p_caption text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.current_profile_id();
  v_post public.posts%rowtype;
  v_text text := nullif(btrim(coalesce(p_caption, '')), '');
begin
  perform momentum_private.require_admin();
  if v_me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if v_text is null or char_length(v_text) > 500 then
    raise exception 'Announcement text is 1 to 500 characters.' using errcode = '22023';
  end if;

  insert into public.posts (author_id, caption, visibility, is_announcement, is_hidden)
  values (v_me, v_text, 'friends', true, false)
  returning * into v_post;

  return v_post.id;
end $$;
revoke all on function momentum_private.admin_create_announcement(text) from public, anon;
grant execute on function momentum_private.admin_create_announcement(text) to authenticated;

create or replace function public.admin_create_announcement(p_caption text)
returns uuid language sql security invoker set search_path = '' as $$
  select momentum_private.admin_create_announcement(p_caption);
$$;
revoke all on function public.admin_create_announcement(text) from public, anon;
grant execute on function public.admin_create_announcement(text) to authenticated;

-- ---------- 6. UPDATE: edit caption (with admin tag if not own post) ----------
create or replace function momentum_private.admin_update_post(p_id uuid, p_caption text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.current_profile_id();
  v_post public.posts%rowtype;
  v_text text := nullif(btrim(coalesce(p_caption, '')), '');
  v_tag_admin boolean;
begin
  perform momentum_private.require_admin();
  if v_text is null or char_length(v_text) > 500 then
    raise exception 'Post caption must be between 1 and 500 characters.' using errcode = '22023';
  end if;

  select * into v_post from public.posts where id = p_id for update;
  if not found then raise exception 'That post no longer exists.' using errcode = '22023'; end if;

  -- Tag with "Edited by admin" if editing another user's post (not own post and not an announcement)
  v_tag_admin := (v_post.author_id <> v_me and not v_post.is_announcement);

  update public.posts set
    caption = v_text,
    edited_by_admin = case when v_tag_admin then true else edited_by_admin end,
    admin_edited_at = case when v_tag_admin then clock_timestamp() else admin_edited_at end
  where id = p_id;
end $$;
revoke all on function momentum_private.admin_update_post(uuid, text) from public, anon;
grant execute on function momentum_private.admin_update_post(uuid, text) to authenticated;

create or replace function public.admin_update_post(p_id uuid, p_caption text)
returns void language sql security invoker set search_path = '' as $$
  select momentum_private.admin_update_post(p_id, p_caption);
$$;
revoke all on function public.admin_update_post(uuid, text) from public, anon;
grant execute on function public.admin_update_post(uuid, text) to authenticated;

-- ---------- 7. UPDATE: hide / unhide post ----------
create or replace function momentum_private.admin_set_post_hidden(p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  update public.posts set is_hidden = coalesce(p_hidden, false) where id = p_id;
  if not found then raise exception 'That post no longer exists.' using errcode = '22023'; end if;
end $$;
revoke all on function momentum_private.admin_set_post_hidden(uuid, boolean) from public, anon;
grant execute on function momentum_private.admin_set_post_hidden(uuid, boolean) to authenticated;

create or replace function public.admin_set_post_hidden(p_id uuid, p_hidden boolean)
returns void language sql security invoker set search_path = '' as $$
  select momentum_private.admin_set_post_hidden(p_id, p_hidden);
$$;
revoke all on function public.admin_set_post_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_post_hidden(uuid, boolean) to authenticated;

-- ---------- 8. DELETE: delete post and notify author ----------
create or replace function momentum_private.admin_delete_post(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.current_profile_id();
  v_post public.posts%rowtype;
  v_preview text;
  v_body text;
begin
  perform momentum_private.require_admin();
  select * into v_post from public.posts where id = p_id for update;
  if not found then raise exception 'That post no longer exists.' using errcode = '22023'; end if;

  -- Notify the author if deleting someone else's post
  if v_post.author_id <> v_me and not v_post.is_announcement then
    v_preview := left(v_post.caption, 60);
    if char_length(v_post.caption) > 60 then
      v_preview := v_preview || '…';
    end if;

    v_body := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Your post was removed by a moderator for violating community guidelines.')
      || ' ("' || v_preview || '")';

    insert into public.notifications (profile_id, kind, title, body, link)
    values (v_post.author_id, 'post_deleted', 'Post removed by moderator', v_body, 'profile.html');
  end if;

  delete from public.posts where id = p_id;
end $$;
revoke all on function momentum_private.admin_delete_post(uuid, text) from public, anon;
grant execute on function momentum_private.admin_delete_post(uuid, text) to authenticated;

create or replace function public.admin_delete_post(p_id uuid, p_reason text default null)
returns void language sql security invoker set search_path = '' as $$
  select momentum_private.admin_delete_post(p_id, p_reason);
$$;
revoke all on function public.admin_delete_post(uuid, text) from public, anon;
grant execute on function public.admin_delete_post(uuid, text) to authenticated;

-- PREVIEW
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'momentum_private')
      and p.proname in ('admin_list_posts', 'admin_create_announcement', 'admin_update_post', 'admin_set_post_hidden', 'admin_delete_post')) as functions_made, -- expect 10
  (select count(*) from public.posts) as total_posts;

-- commit;
