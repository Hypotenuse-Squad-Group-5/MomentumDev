# Six interactive lessons: integration handoff

Branch: `feature/interactive-lessons`. This slice owns curriculum, lesson presentation, and page-only practice. It does not implement progress synchronization or change database tables, policies, auth, or analytics.

## Files and boundary

- `js/lessons-content.js`: six lessons, stable numeric lesson identifiers 1–6, source notes, quizzes, and planner definitions. `LESSON_CONTENT_VERSION = 2` identifies the new curriculum; it does not migrate existing records.
- `js/lesson-interactions.js`, `css/lessons.css`: isolated exercise renderer and styles. No Store writes, localStorage writes, database requests, or network calls. Clipboard access only copies the learner's invitation when requested.
- `lesson.html`: loads the lesson-only assets.
- `js/pages/lesson.js`: mounts practice content; awaits the existing completion call, supports synchronous or asynchronous returns, and preserves form contents on save failure.
- `js/pages/lessons.js`: copy changes for the six-lesson path.
- `js/store.js`: only `LESSON_COUNT` changes from 5 to 6. Keep the progress-sync implementation of `completeLesson` when integrating; do not replace its body with this branch's older implementation.

## Existing completion contract

`Store.completeLesson(n, goalText, habitTitle)` must return `{ ok: true, points }` or `{ ok: false, message }`, directly or via a Promise. The UI continues to use `isLessonDone`, `isLessonUnlocked`, `currentLesson`, and `lessonGoal`. The 30-word minimum and habit-name requirement remain in place. Exercise scores do not gate completion or award points.

Practice inputs exist only in the current page DOM. “Add plan to my reflection” appends the plan to the existing goal textarea, preserves anything already written, and suggests a habit title only if the habit field is empty. Nothing is saved until the existing Finish lesson action. Raw practice answers and quiz choices are not part of the persistence contract. If structured exercise answers need syncing later, agree on a separate versioned contract first.

## Required coordination before live rollout

1. **Seed/update the six lesson rows.** Existing `habits.source_lesson_id` references the `lessons` table. The existing habit writer uses the lesson number as the database ID. Ensure IDs 1–6 exist and match this curriculum, or make the data layer explicitly map number to ID. Otherwise lesson 6 habit insertion can fail. This branch intentionally does not run or alter database migrations.
2. **Decide how to handle older completions.** The previous five lessons have different meanings (old lesson 1 was phone hooks; new lesson 1 is habits). Do not silently assume a saved completion/reflection for the older curriculum means the learner completed the new topic. The progress owner should choose an explicit content-version/mapping/reset policy for existing records. This branch does not delete or rewrite them.
3. **Keep both teams' UI changes.** In `js/pages/lesson.js`, preserve the practice mount and `await Store.completeLesson(...)`; the progress branch also made the handler asynchronous. The shared Store file has evolved substantially on main, so integrate progress functions deliberately rather than copying an entire older Store file.
4. **Check real accounts and errors.** The progress owner should test two separate users, a fresh browser, restore after sign-in, permission failures, repeated submissions, and lesson 6. Do not run `database/schema.sql` on a live project: its clean-slate section drops tables.

These changes are prepared against the interactive branch's current main-based code. No modifications, merge, or push are made to `lesson/progress-sync`.

## Verification

Run `node --test tests/lessons.test.cjs` for sequential unlocking through lesson 6, validation, duplicate rejection, habit creation, and curriculum integrity. Browser QA uses a temporary offline copy with empty config, so no test completions or habits reach the live database.

All six lesson readings include inspectable research sources. Research claims distinguish experimental findings, general health guidance, and practical exercises. Placeholder statistics and draft lesson content have been removed.
