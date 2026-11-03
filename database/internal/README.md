# Internal event trackers

These are manually run, SELECT-only reports for the Momentum team.
They are not migrations and have no frontend integration. No views, functions,
tables, policies, grants, triggers, or stored counters are created.

## Usage

1. Open the Momentum DB project in Supabase and go to SQL Editor.
2. Use an authorized operator role with SELECT access to all rows in
   public.profiles, public.activities, and public.rsvps.
3. Paste and run either events_posted.sql or events_committed.sql.
   Each returns profile_id, username, and its bigint count, sorted by count
   descending and then profile ID. Zero-count profiles are included.
4. Re-run whenever a current report is needed. No installation is required.

Do not run database/schema.sql to use these reports: that file rebuilds app data.
Keep these queries and their results internal. Do not add them to frontend
code or expose them through a client endpoint. Row-level security still applies
to the executing role; a restricted role can produce partial counts. These
queries do not bypass or change permissions.

## Counting rules and limitations

- **Events posted:** COUNT(*) of existing public.activities rows grouped by
  host_id, joined to all current public.profiles rows.
- **Events committed:** COUNT(*) of direct public.rsvps rows whose current
  status is exactly 'committed', grouped by profile_id and joined to all
  current profiles. The unique (activity_id, profile_id) constraint makes this
  one commitment per person per event. Cancelled RSVPs are excluded.
- Both reports include past and future events without a date filter.
  'Active commitment' means the stored RSVP status, not an upcoming event.
  Attendance/check-in fields do not affect the counts.
- rsvp_guests is never read or joined. An accepted guest record alone adds
  nothing; a person with a separate direct committed RSVP is counted for that
  direct RSVP.
- Hosting alone does not create a commitment count; it requires a direct RSVP.
- **Activity cancellation cannot be detected:** activities has no cancellation
  status or cancellation timestamp. Every existing activity counts as posted.
  An activity informally considered cancelled will still count while its row
  exists. RSVP cancellation is separate and is detectable through rsvps.status.
- These are all-time counts of currently stored records, not lifetime audit
  totals. Deleted activities and their cascading RSVPs disappear from counts.
  Deleted profiles are absent. All current profiles are included, including
  demo profiles or profiles without a linked auth account.
- Counts reflect data visible at query execution. Running the reports separately
  can observe different snapshots if data changes between runs.

## Verification

Verified on 2026-11-03 against the feature branch's database/schema.sql and
read-only inspection of Momentum DB's live columns and constraints. The reports
use columns shared by both schemas; unrelated profile columns differ.

Both exact report SELECTs were executed inside a read-only validation query:
each returned all 3 current profiles, had 0 per-profile mismatches against
independent correlated counts, and matched the source-table totals. No live
rows or database objects were changed.

Run verify_event_trackers.sql in SQL Editor for a self-contained SELECT-only
regression check. It must return passed = true. Its CTE fixtures cover zero-count
profiles, multiple events for one host, past and future events, committed and
cancelled direct RSVPs, and accepted guest-only records. The report SELECTs are
copied into that check with fixture table names; keep them synchronized when
changing counting rules.
