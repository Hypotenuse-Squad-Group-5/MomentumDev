# Gemini habit suggestions

Branch: `feature/ai-habit-suggestions`. The website remains on its current production frontend until this branch is deliberately merged/published.

An unfinished lesson offers optional AI assistance after the reflection/habit fields. Students explicitly confirm that their reflection contains no personal, sensitive, or confidential information before sending it to Google. Three suggestions can fill the existing editable habit field. Selecting one never saves a lesson. Existing lesson completion, ownership checks, linked habits, and retry handling remain unchanged.

## Setup

1. Apply `database/021_ai_habit_suggestions.sql` once. It adds only a private allowance table and a service-only reservation RPC; no reflections or suggestions are stored there.
2. In Supabase Edge Functions → Secrets, save `GEMINI_API_KEY` from Google AI Studio. Never add it to `js/config.js`, Git, screenshots, or logs. Keep the Google project on the free tier if zero API spending is required. Application limits do not prevent Google billing if someone upgrades that project.
3. Deploy `supabase/functions/suggest-habits/index.ts` as `suggest-habits`, including `handler.mjs`, `lessons.json`, and `deno.json`. Disable the legacy gateway JWT check for this function: the handler independently validates each bearer token with Supabase Auth before calling Google. Anonymous Auth users are rejected. Do not remove that authentication check.
4. Optional server secrets: `GEMINI_MODEL` (default `gemini-3.5-flash-lite`) and comma-separated `ALLOWED_ORIGINS`. Defaults allow `https://hypotenuse-squad-group-5.github.io`, `http://localhost:8765`, and `http://127.0.0.1:8765`. Add an exact preview origin if needed. Do not enable arbitrary origins.
5. Serve the branch with `python3 -m http.server 8765`, sign in with a test account, and open its unlocked lesson. Use a fictional, nonpersonal reflection. Confirm the three choices, editable selection, and normal completion. Verify restoration on Home after finishing.

The function uses the Supabase runtime's default URL, anonymous key, and service role key. Only the server uses service credentials. The browser uses its normal publishable key and signed-in access token.

## Limits and failures

Reservations serialize in Postgres across function workers: 10 attempts per account per day, 100 attempts across the site per day, and 15 seconds between an account's requests. Days reset at midnight America/Los_Angeles to match Google's daily quota boundary. Requests that reach Google consume an attempt even if Google fails. The provider's own quota can be lower. The reservation requires an existing age-confirmed profile and prior lesson completions. Only `service_role` may call it, so clients cannot impersonate another account to spend its allowance.

The private table intentionally has RLS enabled and no client policies. Only the server can use it. Supabase's informational “RLS enabled, no policy” notice on this table is expected; no client access should be granted to silence it.

Requests and responses are size/length bounded, provider requests time out, and quota/backend errors fail closed. Google receives only fixed lesson context and the submitted reflection, not names, email, profile IDs, or tokens. The function does not log prompt text, provider error bodies, credentials, or suggestions. Google still handles the reflection under its own terms. Free-tier content may be reviewed and used for product improvement; this design is for an eligible adult audience and nonpersonal inputs. An age checkbox alone does not establish regional or audience eligibility. Review the Google terms before a public rollout, especially for minors or EEA/UK/Swiss users.

## Verification

- `node --test tests/habit-suggestions.test.cjs`: auth, validation/consent, quota failure, provider errors/invalid output, selection behavior, stale responses, and preservation of manual drafts.
- `node --test tests/*.test.cjs`: full existing suite. At implementation time, the unchanged branch already had seven failures in demo-mode tests and a hardcoded cache-version test. The new tests pass; those baseline failures remain.
- Live database reservation checks were performed in a transaction and rolled back: initial allowance, cooldown, per-user daily cap, day reset, global cap, and rejection of client-role execution.
- Live unauthenticated Edge Function smoke test returns 401.
- Browser QA uses mocked AI responses to avoid sending user data; this does not establish live Gemini API access. A signed-in live request is still required.

Keep `lessons.json` aligned with the six lesson titles/summaries if curriculum context changes. Suggestions are rendered with `textContent`, never HTML. No paid fallback models, search grounding, model tools, or automatic provider retries are enabled.

To disable the feature, remove its optional UI or remove `GEMINI_API_KEY` from Supabase. Manual habit entry continues to work. Retain allowance records/migration history; do not replay historical schema scripts.
