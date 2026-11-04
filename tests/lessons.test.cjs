const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function app() {
  const memory = new Map();
  const context = vm.createContext({ console, Date, crypto: webcrypto, location: { origin: 'http://localhost', pathname: '/lesson.html' }, localStorage: { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) } });
  context.window = context; context.addEventListener = () => {};
  for (const file of ['js/store.js', 'js/lessons-content.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context;
}
test('all six lessons unlock and complete through the existing Store interface', async () => {
  const { Store, LESSONS } = app();
  assert.equal(LESSONS.length, Store.LESSON_COUNT);
  assert.equal(Store.isLessonUnlocked(6), false);
  assert.equal((await Store.completeLesson(6, 'word '.repeat(35), 'Read')).ok, false);
  for (const lesson of LESSONS) {
    assert.equal(Store.currentLesson(), lesson.n);
    assert.equal((await Store.completeLesson(lesson.n, 'Too short', 'Read')).ok, false);
    const before = Store.habits().length;
    const result = await Store.completeLesson(lesson.n, 'A personal reflection with specific details. '.repeat(6), 'Practice lesson ' + lesson.n);
    assert.equal(result.ok, true); assert.equal(Store.habits().length, before + 1);
    assert.ok(Store.lessonGoal(lesson.n).startsWith('A personal'));
    assert.equal((await Store.completeLesson(lesson.n, 'word '.repeat(35), 'Duplicate')).ok, false);
    assert.equal(Store.habits().length, before + 1);
  }
  assert.equal(Store.currentLesson(), null);
});
test('exercises have complete templates, valid choices and HTTPS sources', () => {
  const { LESSONS } = app();
  for (const lesson of LESSONS) {
    assert.ok(!/placeholder|coming soon|draft lesson/i.test(lesson.html)); assert.ok(lesson.sources.length);
    lesson.sources.forEach(s => assert.equal(new URL(s.url).protocol, 'https:'));
    assert.ok(lesson.activities.some(a => a.type === 'quiz')); assert.ok(lesson.activities.some(a => a.type === 'planner'));
    for (const a of lesson.activities) {
      if (a.type === 'quiz') { assert.ok(a.answer >= 0 && a.answer < a.options.length); continue; }
      const keys = new Set(a.fields.map(f => f.id)); assert.equal(keys.size, a.fields.length);
      for (const [, key] of a.template.matchAll(/\{(\w+)\}/g)) assert.ok(keys.has(key), key);
      assert.ok(a.habit.length <= 80);
    }
  }
});
