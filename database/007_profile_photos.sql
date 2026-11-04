-- =====================================================================
-- Migration 007: profile pictures in Supabase Storage
--
-- WHAT THIS CHANGES (plain English):
--   1. Re-adds `avatar_url` to the public `profiles` table so other members
--      can see profile pictures.
--   2. Grants permission for authenticated users to update their own `avatar_url`.
--      (The existing "edit own profile" RLS policy from migration 001 already
--       ensures users can only update their own row).
--   3. Creates a dedicated public storage bucket named `avatars` (1MB limit, images only).
--   4. Configures Row Level Security (RLS) policies on storage.objects:
--        - Read:   Public can view pictures in the 'avatars' bucket.
--        - Create: Authenticated users only, and only inside their own folder.
--        - Update: Authenticated users can overwrite/replace their existing picture.
--        - Delete: Authenticated users can remove their own picture.
--
-- HOW TO RUN (preview first):
--   1. Run as-is: it runs inside a transaction (BEGIN) and displays
--      the PREVIEW summary table at the bottom showing all changes.
--      Nothing is permanently committed yet.
--   2. Review the preview output:
--        - profiles_avatar_url_column: 'text'
--        - profiles_authenticated_can_update: includes 'avatar_url'
--        - avatars_bucket_status: public = true
--        - avatar_storage_policies: 4 policies (read, create, edit/overwrite, delete)
--   3. If everything looks good, uncomment `commit;` on the last line and click Run.
--   Re-running is completely safe (idempotent).
-- =====================================================================

begin;

-- ---------- 1. Database: add avatar_url back to public profiles ----------
alter table public.profiles add column if not exists avatar_url text;

-- ---------- 2. Permissions: allow users to update their own avatar_url ----------
grant update (avatar_url) on public.profiles to authenticated;

-- ---------- 3. Storage bucket: create 'avatars' if missing ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576, -- 1MB file size limit (client resizes to ~50-100KB)
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- ---------- 4. Storage security: policies on storage.objects ----------
-- Note: RLS is already permanently enabled on storage.objects by Supabase.

drop policy if exists "public reads avatars" on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users update own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;

-- Read: public access to avatar pictures
create policy "public reads avatars" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Insert: authenticated users can upload only to their own folder
create policy "users upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.current_profile_id()::text
    )
  );

-- Update: authenticated users can replace their existing picture (for upsert)
create policy "users update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.current_profile_id()::text
    )
  );

-- Delete: authenticated users can delete their own picture
create policy "users delete own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = public.current_profile_id()::text
    )
  );

-- ---------- 5. PREVIEW: inspect all changes before committing ----------
select
  (select data_type
     from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url') as profiles_avatar_url_column,
  (select string_agg(column_name, ', ' order by column_name)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE') as profiles_authenticated_can_update,
  (select json_build_object(
            'bucket_name', name,
            'is_public', public,
            'max_file_size_bytes', file_size_limit,
            'allowed_types', allowed_mime_types
          )
     from storage.buckets
    where id = 'avatars') as avatars_bucket_status,
  (select json_agg(json_build_object(
            'policy', polname,
            'action', case polcmd when 'r' then 'read' when 'a' then 'create' when 'd' then 'delete' when 'w' then 'edit/overwrite' else 'all' end
          ) order by polname)
     from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in (
        'public reads avatars',
        'users upload own avatar',
        'users update own avatar',
        'users delete own avatar'
      )) as avatar_storage_policies;

-- When you are ready to permanently save these changes, uncomment the line below and run again:
-- commit;
