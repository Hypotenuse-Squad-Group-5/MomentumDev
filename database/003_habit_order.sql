-- =====================================================================
-- Migration 003: users can reorder their habits
-- HOW TO RUN: Supabase → SQL Editor → paste → Run. Once.
-- (Your existing "change own habits" policy already allows saving the order.)
-- =====================================================================
begin;

alter table habits add column sort_order integer;

-- Put existing habits in the order they were created, per person.
update habits h set sort_order = x.n
from (select id, row_number() over (partition by profile_id order by created_at) as n from habits) x
where x.id = h.id;

alter table habits alter column sort_order set default 0;
alter table habits alter column sort_order set not null;

commit;
