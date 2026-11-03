-- Read-only regression check: creates no tables and changes no data.
-- Expected result: passed = true.
WITH
profiles(id, username) AS (
  VALUES (1, 'host'), (2, 'attendee'), (3, 'zero'), (4, 'guest_only')
),
activities(id, host_id, starts_at) AS (
  VALUES (10, 1, timestamptz '2000-01-01 00:00:00+00'),
         (11, 1, timestamptz '2100-01-01 00:00:00+00')
),
rsvps(id, activity_id, profile_id, status) AS (
  VALUES (100, 10, 2, 'committed'), (101, 11, 2, 'committed'),
         (102, 11, 1, 'cancelled')
),
rsvp_guests(rsvp_id, guest_profile_id, status) AS (
  VALUES (100, 4, 'accepted'), (101, 4, 'accepted')
),
posted AS (
-- Internal reporting only. Run manually as an authorized database operator.
-- All existing activities, including past events. Cancellation cannot be
-- filtered: activities has no cancellation status. See README.md.
SELECT
  p.id AS profile_id,
  p.username,
  COALESCE(a.events_posted, 0::bigint) AS events_posted
FROM profiles AS p
LEFT JOIN (
  SELECT host_id, COUNT(*) AS events_posted
  FROM activities
  GROUP BY host_id
) AS a ON a.host_id = p.id
ORDER BY events_posted DESC, p.id
),
committed AS (
-- Internal reporting only. Run manually as an authorized database operator.
-- Current direct committed RSVPs, including those for past events.
-- Guest records are deliberately excluded. See README.md.
SELECT
  p.id AS profile_id,
  p.username,
  COALESCE(r.events_committed, 0::bigint) AS events_committed
FROM profiles AS p
LEFT JOIN (
  SELECT profile_id, COUNT(*) AS events_committed
  FROM rsvps
  WHERE status = 'committed'
  GROUP BY profile_id
) AS r ON r.profile_id = p.id
ORDER BY events_committed DESC, p.id
),
expected(profile_id, events_posted, events_committed) AS (
  VALUES (1, 2::bigint, 0::bigint), (2, 0, 2), (3, 0, 0), (4, 0, 0)
),
actual AS (
  SELECT p.profile_id, p.events_posted, c.events_committed
  FROM posted p JOIN committed c USING (profile_id)
)
SELECT NOT EXISTS (
  (SELECT * FROM actual EXCEPT SELECT * FROM expected)
  UNION ALL
  (SELECT * FROM expected EXCEPT SELECT * FROM actual)
) AS passed;
