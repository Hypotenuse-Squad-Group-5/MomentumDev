-- Internal reporting only. Run manually as an authorized database operator.
-- Current direct committed RSVPs, including those for past events.
-- Guest records are deliberately excluded. See README.md.
SELECT
  p.id AS profile_id,
  p.username,
  COALESCE(r.events_committed, 0::bigint) AS events_committed
FROM public.profiles AS p
LEFT JOIN (
  SELECT profile_id, COUNT(*) AS events_committed
  FROM public.rsvps
  WHERE status = 'committed'
  GROUP BY profile_id
) AS r ON r.profile_id = p.id
ORDER BY events_committed DESC, p.id;
