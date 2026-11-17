-- =====================================================================
-- Migration 031: each account's theme (Settings › Appearance)
--
-- Adds user_settings.theme. The website also remembers the theme in the browser, so pages
-- open in the right look before this loads; this column makes it follow you to other devices.
-- Allowed values match js/theme.js: default, trailhead, pop, quiet, field.
-- Nothing else changes: the existing "edit own settings" rule already covers the new column.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see a summary at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
--   The site works before this runs too (everyone just stays on the theme saved in their browser).
-- =====================================================================

begin;

alter table public.user_settings add column if not exists theme text not null default 'default';

alter table public.user_settings drop constraint if exists user_settings_theme_check;
alter table public.user_settings add constraint user_settings_theme_check
  check (theme in ('default', 'trailhead', 'pop', 'quiet', 'field'));

-- PREVIEW: the new column and how many accounts are on each theme
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'user_settings' and column_name = 'theme') as theme_column,
  (select string_agg(theme || ': ' || n, ', ' order by theme)
     from (select theme, count(*) n from public.user_settings group by theme) t) as accounts_by_theme;

-- commit;
