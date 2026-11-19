-- =====================================================================
-- Migration 034: Admin › Accounts (teammate 2)
--
-- Every function starts with momentum_private.require_admin() (migration 032), so only admins can run them.
--   READ    admin_list_accounts(search, limit, offset)    every account, searchable, 25 a page
--   UPDATE  admin_update_account(profile, first, last, bio, remove_photo)
--           admin_set_suspended(profile, true/false)      uses Supabase's own login ban (auth.users.banned_until):
--                                                         a suspended person can't sign in, and their sessions are
--                                                         ended so they're signed out within the hour.
--                                                         Banned until now + 100 years, like Supabase's Ban button.
--                                                         NOT 'infinity': Supabase's login server can't read it and
--                                                         sign-in fails with "Database error querying schema".
--   DELETE  admin_delete_account(profile)                 same approach as delete_my_account (025)
--   CREATE  is not here: making a login needs the service key, so it lives in the Edge Function
--           supabase/functions/admin-create-user (see docs/admin-guide.md).
--
-- Safety rules: you can't suspend or delete yourself or another admin (remove their admin access first),
-- and you can't delete someone hosting an upcoming activity people are going to (cancel it first).
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- ---------- READ: every account ----------
create or replace function momentum_private.admin_list_accounts(p_search text default '', p_limit int default 25, p_offset int default 0)
returns table (profile_id uuid, first_name text, last_name text, username text, email text, bio text, avatar_url text,
               joined timestamptz, last_sign_in timestamptz, is_admin boolean, suspended boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := '%' || coalesce(trim(p_search), '') || '%';
begin
  perform momentum_private.require_admin();
  return query
    select p.id, p.first_name, pp.last_name, p.username::text, coalesce(u.email, pp.email)::text, p.bio,
           coalesce(p.avatar_url, pp.avatar_url), p.created_at, u.last_sign_in_at,
           exists (select 1 from momentum_private.admins a where a.profile_id = p.id),
           coalesce(u.banned_until > now(), false),
           count(*) over ()
      from public.profiles p
      left join public.profile_private pp on pp.profile_id = p.id
      left join auth.users u on u.id = p.auth_user_id
     where coalesce(trim(p_search), '') = ''
        or p.first_name ilike v_q or pp.last_name ilike v_q or p.username ilike v_q or coalesce(u.email, pp.email) ilike v_q
        or (p.first_name || ' ' || coalesce(pp.last_name, '')) ilike v_q
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function momentum_private.admin_list_accounts(text, int, int) from public, anon;
grant execute on function momentum_private.admin_list_accounts(text, int, int) to authenticated;

create or replace function public.admin_list_accounts(p_search text default '', p_limit int default 25, p_offset int default 0)
returns table (profile_id uuid, first_name text, last_name text, username text, email text, bio text, avatar_url text,
               joined timestamptz, last_sign_in timestamptz, is_admin boolean, suspended boolean, total bigint)
language sql stable security invoker set search_path = '' as $$ select * from momentum_private.admin_list_accounts(p_search, p_limit, p_offset); $$;
revoke all on function public.admin_list_accounts(text, int, int) from public, anon;
grant execute on function public.admin_list_accounts(text, int, int) to authenticated;

-- ---------- UPDATE: name, bio, photo ----------
create or replace function momentum_private.admin_update_account(p_profile uuid, p_first_name text, p_last_name text, p_bio text, p_remove_photo boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  if not exists (select 1 from public.profiles where id = p_profile) then
    raise exception 'That account no longer exists.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_first_name, ''))) not between 1 and 40 then
    raise exception 'First name is 1 to 40 characters.' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_last_name, ''))) not between 1 and 60 then
    raise exception 'Last name is 1 to 60 characters.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_bio, '')) > 160 then
    raise exception 'Bio is at most 160 characters.' using errcode = '22023';
  end if;
  update public.profiles
     set first_name = trim(p_first_name),
         bio = nullif(trim(coalesce(p_bio, '')), ''),
         avatar_url = case when p_remove_photo then null else avatar_url end
   where id = p_profile;
  update public.profile_private
     set last_name = trim(p_last_name),
         avatar_url = case when p_remove_photo then null else avatar_url end
   where profile_id = p_profile;
end $$;
revoke all on function momentum_private.admin_update_account(uuid, text, text, text, boolean) from public, anon;
grant execute on function momentum_private.admin_update_account(uuid, text, text, text, boolean) to authenticated;

create or replace function public.admin_update_account(p_profile uuid, p_first_name text, p_last_name text, p_bio text, p_remove_photo boolean default false)
returns void language sql security invoker set search_path = '' as $$ select momentum_private.admin_update_account(p_profile, p_first_name, p_last_name, p_bio, p_remove_photo); $$;
revoke all on function public.admin_update_account(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_update_account(uuid, text, text, text, boolean) to authenticated;

-- ---------- shared check: who can be suspended or deleted ----------
create or replace function momentum_private.admin_target_login(p_profile uuid, p_action text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_login uuid;
begin
  if p_profile = public.current_profile_id() then
    raise exception 'You can''t % your own account here.', p_action using errcode = '22023';
  end if;
  if exists (select 1 from momentum_private.admins where profile_id = p_profile) then
    raise exception 'Admins can''t be suspended or deleted. Remove their admin access in Supabase first.' using errcode = '22023';
  end if;
  select auth_user_id into v_login from public.profiles where id = p_profile;
  if not found then raise exception 'That account no longer exists.' using errcode = '22023'; end if;
  return v_login;
end $$;
revoke all on function momentum_private.admin_target_login(uuid, text) from public, anon, authenticated;

-- ---------- UPDATE: suspend / unsuspend ----------
create or replace function momentum_private.admin_set_suspended(p_profile uuid, p_suspended boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_login uuid;
begin
  perform momentum_private.require_admin();
  v_login := momentum_private.admin_target_login(p_profile, case when p_suspended then 'suspend' else 'unsuspend' end);
  if v_login is null then raise exception 'That account has no login to suspend.' using errcode = '22023'; end if;
  update auth.users set banned_until = case when p_suspended then now() + interval '100 years' else null end where id = v_login;
  if p_suspended then
    delete from auth.sessions where user_id = v_login; -- ends their sessions: signed out at the next token refresh
  end if;
  return jsonb_build_object('ok', true, 'suspended', p_suspended);
end $$;
revoke all on function momentum_private.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function momentum_private.admin_set_suspended(uuid, boolean) to authenticated;

create or replace function public.admin_set_suspended(p_profile uuid, p_suspended boolean)
returns jsonb language sql security invoker set search_path = '' as $$ select momentum_private.admin_set_suspended(p_profile, p_suspended); $$;
revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

-- ---------- DELETE ----------
create or replace function momentum_private.admin_delete_account(p_profile uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_login uuid;
  v_n int;
  v_titles text;
begin
  perform momentum_private.require_admin();
  v_login := momentum_private.admin_target_login(p_profile, 'delete');
  select count(*), string_agg(a.title, ', ' order by a.starts_at) into v_n, v_titles
    from public.activities a
   where a.host_id = p_profile and a.cancelled_at is null and a.starts_at > now()
     and exists (select 1 from momentum_private.people_on(a.id));
  if v_n > 0 then
    raise exception 'They''re hosting % upcoming % people are going to (%). Cancel % first in the Activities tab.',
      v_n, case when v_n = 1 then 'activity' else 'activities' end, v_titles, case when v_n = 1 then 'it' else 'them' end
      using errcode = '22023', hint = 'hosting';
  end if;
  if v_login is not null then
    delete from auth.users where id = v_login;      -- the profile and everything of theirs go with it
  else
    delete from public.profiles where id = p_profile; -- (an old profile with no login)
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function momentum_private.admin_delete_account(uuid) from public, anon;
grant execute on function momentum_private.admin_delete_account(uuid) to authenticated;

create or replace function public.admin_delete_account(p_profile uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select momentum_private.admin_delete_account(p_profile); $$;
revoke all on function public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;

-- Repair: accounts suspended by the first version of this file ('infinity') get the 100-year date instead
update auth.users set banned_until = now() + interval '100 years' where banned_until = 'infinity';

-- PREVIEW: the new functions, and how many accounts there are
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'momentum_private')
      and p.proname in ('admin_list_accounts', 'admin_update_account', 'admin_set_suspended', 'admin_delete_account')) as functions_made, -- expect 8
  (select count(*) from public.profiles) as accounts,
  (select count(*) from auth.users where banned_until > now()) as suspended_now;

-- commit;
