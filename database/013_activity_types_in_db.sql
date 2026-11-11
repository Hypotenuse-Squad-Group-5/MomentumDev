-- =====================================================================
-- Migration 013: activity categories live in the database only
--
-- WHY: the "Post an activity" page and the Activities filter each had their own
-- hardcoded copy of the category list (with emojis and guessed id numbers), so a
-- teammate had to change Supabase AND JavaScript to add a category. After this file
-- the website reads everything from activity_types. To add, rename, reorder or
-- re-emoji a category, edit the table in Supabase. No code change needed.
--
-- WHAT IT DOES:
--   1. Adds two columns to activity_types:
--        emoji       the icon shown on the category chip (e.g. 🏐)
--        sort_order  the order chips appear in (lowest first; blank goes last)
--   2. Removes the "Online" category (Momentum is in person). Any activity that
--      happened to use it is moved to "Other" first, so nothing breaks.
--   3. Capitalizes two names to match the others: "Food & Social", "Learning & Creative".
--   4. Fills in the emoji + order for every category (the same ones the page used).
--
-- RUN ORDER: run this BEFORE uploading the new js files. The new pages ask the
-- database for the emoji and sort_order columns, which don't exist until this runs.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the category list at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

-- 1. New columns
alter table public.activity_types add column if not exists emoji text;
alter table public.activity_types add column if not exists sort_order smallint;

-- 2. Remove "Online": move any activities using it to "Other", then delete it
update public.activities
   set type_id = (select id from public.activity_types where name = 'Other')
 where type_id = (select id from public.activity_types where name = 'Online');
delete from public.activity_types where name = 'Online';

-- 3. Consistent capitalization
update public.activity_types set name = 'Food & Social'       where name = 'Food & social';
update public.activity_types set name = 'Learning & Creative' where name = 'Learning & creative';

-- 4. Emoji + display order
update public.activity_types t
   set emoji = v.emoji, sort_order = v.sort_order
  from (values
    ('Outdoors · Active',      '🏐',  1),
    ('Outdoors · Relaxed',     '🌲',  2),
    ('Indoors · Relaxed',      '🎲',  3),
    ('Indoors · Active',       '🎳',  4),
    ('Food & Social',          '🍎',  5),
    ('Learning & Creative',    '🎨',  6),
    ('Wellness & Mindfulness', '🧘',  7),
    ('Volunteering & Service', '🤝',  8),
    ('Gaming & Esports',       '🎮',  9),
    ('Professional & Tech',    '💻', 10),
    ('Other',                  '✨', 99)
  ) as v(name, emoji, sort_order)
 where t.name = v.name;

-- PREVIEW: the categories exactly as the website will show them
select sort_order, emoji, name, id,
       (select count(*) from public.activities a where a.type_id = t.id) as activities_using_it
  from public.activity_types t
 order by sort_order nulls last, id;

-- commit;
