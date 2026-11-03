-- Internal reporting only. Run manually as an authorized database operator.
-- All existing activities, including past events. Cancellation cannot be
-- filtered: activities has no cancellation status. See README.md.
SELECT
  p.id AS profile_id,
  p.username,
  COALESCE(a.events_posted, 0::bigint) AS events_posted
FROM public.profiles AS p
LEFT JOIN (
  SELECT host_id, COUNT(*) AS events_posted
  FROM public.activities
  GROUP BY host_id
) AS a ON a.host_id = p.id
ORDER BY events_posted DESC, p.id;
