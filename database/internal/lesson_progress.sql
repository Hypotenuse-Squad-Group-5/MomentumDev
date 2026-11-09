-- Authorized operators only. Current curriculum progress; no reflection contents.
-- RLS applies: a normal user sees only their own completion rows, so do not use
-- a client role for team-wide totals. Do not expose this report in frontend code.
select p.id as profile_id, p.username,
       count(c.lesson_id) as lessons_completed,
       (select count(*) from public.lessons where curriculum_version=2) as total_lessons,
       max(c.completed_at) as last_completion_at
from public.profiles p
left join public.lesson_completions c on c.profile_id=p.id
  and c.lesson_id in (select id from public.lessons where curriculum_version=2)
group by p.id,p.username
order by lessons_completed desc,p.id;
