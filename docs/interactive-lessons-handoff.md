# Interactive lessons and account sync

Integrated into `main` from `feature/interactive-lessons`. The six-lesson curriculum, page-only exercises, habit creation, and signed-in completion restoration are integrated here. Coordinate with the owner of `lesson/progress-sync`; that separate branch is not modified by this integration.

## Data contract

`Store.completeLesson(number, goalText, habitTitle)` returns a Promise resolving to `{ ok, points, message? }`. The data layer calls `complete_momentum_lesson` for signed-in users. The server owns identity, order validation, completion, habit creation, points, and retry protection. A successful retry can include `alreadyCompleted: true` and zero new points.

`loadLessonData` loads version-2 lesson ID/number mappings and the signed-in profile's completions. `loadHabitData` restores habits, check-ins, and habit/lesson points. `Store.lessonHabit(number)` finds the canonical habit referenced by the completion; a changed title or archive state on Home is shown on the completed lesson. The habit input is the final input below the reflection and above Finish lesson.

Live progress is not inferred from localStorage. The cache preserves old browser progress separately for reference, but only confirmed server completions unlock the six-lesson course. If initial restore fails, the UI blocks the lesson view and offers reload rather than rendering cached completion as confirmed.

Practice inputs remain page-only. Add plan to my reflection appends text and supplies a suggested habit only when empty; nothing is persisted until completion. Browser autocomplete is disabled for practice, reflection, and habit-name inputs. Quiz attempts do not gate completion or award points.

## Curriculum and preservation

`LESSON_CONTENT_VERSION = 2` corresponds to `lessons.curriculum_version = 2`. UI positions 1–6 map to generated database IDs. The old five lessons remain version 1, preserving their original links and meanings. New completions do not overwrite old records. Keep both version and number in any future query or analytics.

## Deployment and checks

See [database operations](../database/README.md) and [main README](../README.md). Migrations 007 and 008 must be installed before frontend deployment; both are already applied to Momentum DB. Run the node tests and the rollback-only database regression. The completed-lesson page and Home must use the same `habits.id`; do not duplicate habit titles into a second independently editable record.

The earlier UI-only checkpoint is `checkpoint/interactive-lessons-before-db-sync`. Rolling back frontend code does not roll back database writes. No live reset scripts should be run.

Reflections now use a 1,000-character maximum and no word minimum (migration 008). Require only a nonblank response. Preserve existing longer responses; do not truncate saved text.

Main integration preserves the public `index.html` landing page, `login.html` signup/sign-in page, About & Privacy page, and profile-photo support. Core script URLs are versioned together to avoid mixing cached account and lesson data layers.
