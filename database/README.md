# Database operations

Project: Momentum DB. Treat the connected production database as live user data.

## Lesson sync migration

`007_lesson_sync.sql` adds curriculum versioning to `lessons`, inserts six new version-2 lessons using generated IDs, extends `lesson_completions` with a canonical `habit_id`, and installs `complete_momentum_lesson(number, goal, habit_title)`.

It preserves every old lesson, habit, check-in, point event, and completion. Version-1 lesson IDs and numbers stay unchanged. The former globally unique lesson number becomes unique within a curriculum version. Always look up version 2 plus number; never treat a UI lesson number as a database ID.

The completion function resolves ownership from `auth.uid()`, enforces order and text limits, serializes completion requests for the account, saves habit/completion/points atomically, and returns the existing completion on retry. The public RPC is SECURITY INVOKER and delegates to an unexposed `momentum_private` helper. The helper uses SECURITY DEFINER specifically to award points and commit the operation together; it has an empty search path, fully qualified application tables, no caller-provided owner, and EXECUTE granted only to authenticated users. Direct completion writes are not granted to client roles. Row-level security permits only the owner to read completions; existing habit ownership policies remain unchanged.

Existing habitual check-ins continue using migration 002. One linked habit per account/database lesson and one lesson point event per account/database lesson are enforced with unique indexes. Duplicate preexisting links will stop migration creation rather than delete user data.

Migration 007 originally replaced the old <200-character constraint with a 10,000-character cap and a 30-word minimum. **Migration 008 supersedes those rules: the current limit is 1,000 characters, with no word minimum and a nonblank response required.** The column constraint is NOT VALID for historical compatibility; new or updated records are checked without scanning/rejecting old records. No existing responses are truncated.

## Deployment order

1. Commit/checkpoint the frontend and review the incremental SQL. Take a database backup using your project's backup/export facilities if a full restore point is needed; a Git commit is not a database backup.
2. Confirm the live schema and duplicate counts. Do not use `schema.sql` as a production snapshot.
3. Apply `007_lesson_sync.sql` once through Supabase migration tooling, as one transaction. Record its production migration-history version.
4. Run `internal/verify_lesson_sync.sql` as an authorized operator. It uses two existing accounts internally and rolls test writes back. It intentionally refuses accounts already holding version-2 completions.
5. Deploy the new frontend from `main` (or a deliberate preview branch), then verify sign-in and cross-browser restoration. No additional Auth redirects are required because the existing deployed origin is retained.

## Recovery and rollback

The archival pre-change checkpoint is `checkpoint/interactive-lessons-before-db-sync` (commit `651b2123159364b6ab04ad2bfe1f9c1b929806c6`). It predates the current account-schema fixes and must not be deployed unchanged against today's database. The verified main integration is commit `4861f359947488030a764d3a395b0b17ccfe247a`; retain it as a code recovery point for future edits. An application rollback should use a tested commit compatible with the current account schema while keeping the additive database changes.

Do not delete new lesson rows to roll back: their foreign keys may cascade to completions and detach habit links. Do not run historical destructive reset scripts. Disabling the new RPC for incident response should be coordinated with frontend rollback so users see a clear save failure. Reverting the versioned number constraint requires first exporting and intentionally migrating version-2 records; it is not a safe automatic rollback.

Legacy browser-only progress is retained as `legacyLessonProgress` in the signed-in browser cache when v2 sync first loads. It is not silently uploaded or reinterpreted. Existing database habits remain visible on Home even when linked to an older curriculum. No automatic rewrite of old reflections or habit meanings is performed.

## Historical files

`schema.sql` is the original destructive bootstrap. Earlier numbered SQL files (including `007_profile_photos.sql` and `008_slim_signup.sql`) are historical team migrations, some of which include cleanup or differ from today's managed schema. Do not replay them on an existing project. For a new installation, reconcile the current schema first; this repository does not provide a guaranteed one-command production clone.

## Applied verification

Applied to Momentum DB as migration `20261109043237_versioned_lesson_sync` on November 8, 2026 (America/Denver). The matching CLI-created file is retained under `supabase/migrations/`. Its SQL is identical to `007_lesson_sync.sql`; these are two references to the same migration, not two migrations to apply.

The real-database rollback test passed: sequential completion through all six lessons, long reflections, retry protection, shared habit renaming/archiving, two-account read/write isolation, anonymous RPC denial, and rollback of a forced late save failure. After testing, existing habits/check-ins/points/completion counts were unchanged (9/8/8/0). Five legacy lessons and their existing habit link remain intact; six v2 lessons were added. Sequence gaps from rolled-back test inserts are normal and do not represent missing user records.

## Current account schema compatibility

`profiles` includes id, auth_user_id, username, first_name, bio, avatar_url, and created_at. `profile_private` includes profile_id, last_name, email, sex, avatar_url, and age_confirmed_at. This is narrower than the original account migration in this repository. Frontend account reads/writes and signup metadata must match the current schema; in particular, signup supplies explicit age confirmation rather than birthdate. The signup trigger creates the public/private profile and settings only on a NEW auth-user insertion. Repeated signup for an existing email does not repair manually deleted app rows. Never infer an age-confirmation timestamp or recreate private fields with made-up values.

The account compatibility regression uses a temporary auth-user insertion with the current signup metadata, verifies all three app records, and rolls the transaction back without sending email or retaining an account. Mocked signed-in tests also reject references to removed profile columns.

## Paragraph-length reflections (migration 008)

`008_reflection_character_limit.sql` removes the word minimum from all six v2 lessons and caps new reflections at 1,000 characters. A nonblank response remains required. The UI shows a character counter. Existing saved responses are never shortened or deleted, including any historical response longer than the new limit. The replacement column constraint is NOT VALID to preserve those historical records. Migration 007 above documents the earlier rules; apply 008 after 007.

Migration 008 was applied as `20261109050600_reflection_character_limit`. Real-database rollback checks passed for short responses, exactly 1,000 characters, over-limit rejection, and the existing ownership/atomic-save checks. Existing user responses were preserved.

## Main integration

The photo/signup SQL files and lesson SQL files share numeric prefixes but are separate changes; refer to their full filenames, not just a migration number. Existing production schema already includes photo, slim-signup, expanded activity types, and friendships (`010_friendships.sql`, originally drafted as `008_friendships.sql`) changes. The lesson migrations are recorded in Supabase migration history as listed above; merging frontend code to main does not require replaying them.
