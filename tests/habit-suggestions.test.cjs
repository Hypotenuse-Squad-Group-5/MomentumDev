const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const lessons = JSON.parse(fs.readFileSync('supabase/functions/suggest-habits/lessons.json'));
const habits = ['Leave my phone in my bag after lunch', 'Read two pages before bed', 'Take a five-minute walk after class'];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('server lesson context matches the current curriculum', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/lessons-content.js', 'utf8'), context);
  assert.equal(JSON.stringify(lessons), JSON.stringify(context.window.LESSONS.map(({ n, title, summary }) => ({ n, title, summary }))));
});
async function setup(options = {}) {
  const { createHandler } = await import('../supabase/functions/suggest-habits/handler.mjs');
  const calls = [];
  const vars = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', GEMINI_API_KEY: 'private-key', ...options.env };
  const handler = createHandler({ env: key => vars[key], lessons, fetcher: async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/auth/')) return json(options.user || { id: 'user-a' }, options.authStatus || 200);
    if (url.includes('/rest/v1/lessons?')) {
      if (options.catalogError) return json({ code: options.catalogError }, 400);
      const number = Number(new URL(url).searchParams.get('number').slice(3));
      const lesson = (options.catalog ?? lessons).find(l => l.n === number);
      return json(lesson ? [{ title: lesson.title, summary: lesson.summary }] : []);
    }
    if (url.includes('/rpc/')) return json(options.quota || { ok: true }, options.quotaStatus || 200);
    if (options.timeout) throw new DOMException('timeout', 'TimeoutError');
    return json(options.result || { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ suggestions: options.habits || habits }) }] } }] }, options.providerStatus || 200);
  } });
  const request = (body = {}, headers = {}, method = 'POST') => handler(new Request('https://example/functions/v1/suggest-habits', {
    method, headers: { origin: 'http://localhost:8765', authorization: 'Bearer user-token', 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: JSON.stringify({ lessonNumber: 1, reflection: 'I want to scroll less after lunch.', consent: true, ...body }) } : {})
  }));
  return { request, calls };
}
test('authenticated request reserves quota and returns three habits without sending identity to Google', async () => {
  const { request, calls } = await setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).suggestions, habits);
  assert.equal(calls.length, 4);
  assert.equal(calls[3].init.headers['x-goog-api-key'], 'private-key');
  assert.ok(!calls[3].init.body.includes('user-a'));
  assert.equal(JSON.parse(calls[2].init.body).p_user, 'user-a');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('rejects missing/invalid auth, anonymous users, bad origin, and unsupported methods before Gemini', async () => {
  for (const options of [{ authStatus: 401 }, { user: { id: 'anon', is_anonymous: true } }]) {
    const { request, calls } = await setup(options); assert.equal((await request()).status, 401); assert.equal(calls.length, 1);
  }
  const { request, calls } = await setup();
  assert.equal((await request({}, { authorization: '' })).status, 401);
  assert.equal((await request({}, { origin: 'https://other.example' })).status, 403);
  assert.equal((await request({}, {}, 'GET')).status, 405);
  assert.equal((await request({}, {}, 'OPTIONS')).status, 204);
  assert.equal(calls.length, 0);
});
test('invalid input and missing consent never consume quota or call Gemini', async () => {
  for (const body of [{ reflection: '' }, { reflection: 'x'.repeat(1001) }, { consent: false }, { lessonNumber: 0 }, { lessonNumber: '1' }]) {
    const { request, calls } = await setup(); assert.equal((await request(body)).status, 400); assert.equal(calls.length, 1);
  }
  const { request, calls } = await setup(); assert.equal((await request({ reflection: 'x'.repeat(9000) })).status, 413); assert.equal(calls.length, 1);
});
test('missing key and quota errors fail closed without a provider call', async () => {
  for (const [options, expected, count] of [[{ env: { GEMINI_API_KEY: '' } }, 503, 2], [{ quota: { ok: false, message: 'Daily limit' } }, 429, 3], [{ quotaStatus: 500 }, 503, 3]]) {
    const { request, calls } = await setup(options); assert.equal((await request()).status, expected); assert.equal(calls.length, count);
  }
});
test('handles provider throttling, blocked output, malformed habits, and timeout without leaking errors', async () => {
  for (const [options, expected] of [[{ providerStatus: 429 }, 429], [{ providerStatus: 403 }, 503], [{ result: { promptFeedback: { blockReason: 'SAFETY' } } }, 502], [{ habits: ['<script>', 'Walk', 'Read'] }, 502], [{ habits: ['Walk', 'Walk', 'Read'] }, 502], [{ habits: ['x'.repeat(81), 'Walk', 'Read'] }, 502], [{ timeout: true }, 503]]) {
    const { request } = await setup(options); const response = await request(); assert.equal(response.status, expected); assert.ok(!(await response.text()).includes('private-key'));
  }
});

test('new and edited published lessons supply current context and use their stable quota number', async () => {
  for (const n of [2, 7]) {
    const current = { n, title: 'Updated lesson', summary: 'Current published summary' };
    const { request, calls } = await setup({ catalog: [current] });
    assert.equal((await request({ lessonNumber: n })).status, 200);
    const query = new URL(calls[1].url).searchParams;
    assert.equal(query.get('number'), `eq.${n}`);
    assert.equal(query.get('retired_at'), 'is.null');
    assert.equal(calls[1].init.headers.Authorization, 'Bearer user-token');
    assert.equal(JSON.parse(calls[2].init.body).p_lesson, n);
    const prompt = JSON.parse(calls[3].init.body).contents[0].parts[0].text;
    assert.equal(JSON.parse(prompt).lesson, current.title);
    assert.equal(JSON.parse(prompt).summary, current.summary);
  }
});

test('deleted lessons and catalog failures stop before quota or Gemini', async () => {
  for (const [options, status] of [[{ catalog: [] }, 400], [{ catalogError: 'XX000' }, 503]]) {
    const { request, calls } = await setup(options);
    assert.equal((await request()).status, status);
    assert.equal(calls.length, 2);
  }
});

test('the old schema can still suggest habits for the bundled curriculum during rollout', async () => {
  const { request, calls } = await setup({ catalogError: '42703' });
  assert.equal((await request()).status, 200);
  assert.equal(calls.length, 4);
  assert.equal((await request({ lessonNumber: 7 })).status, 400);
  assert.equal(calls.length, 6);
});

// Minimal DOM harness exercises async races and actual click behavior, without dependencies.
function ui(fetcher) {
  class Element {
    constructor() { this.value = ''; this.checked = false; this.disabled = false; this.textContent = ''; this.children = []; this.listeners = {}; this.attrs = {}; this.classList = { remove() {} }; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    fire(name) { return this.listeners[name]?.(); }
    append(el) { this.children.push(el); }
    replaceChildren() { this.children = []; }
    querySelectorAll() { return this.children; }
    closest() { return this; }
    setAttribute(k, v) { this.attrs[k] = v; }
    dispatchEvent() {}
    focus() { this.focused = true; }
  }
  const elements = Object.fromEntries(['suggest-habits', 'goal', 'habit', 'ai-consent', 'ai-status', 'habit-suggestions', 'habit-error', 'submit'].map(k => [k, new Element()]));
  const form = { querySelector: selector => elements[selector.startsWith('#') ? selector.slice(1) : 'submit'] };
  const context = { window: {}, Store: { auth: { session: async () => ({ access_token: 'token' }) } }, document: { createElement: () => new Element() }, fetch: fetcher, AbortSignal, Event };
  context.window.MOMENTUM_CONFIG = { SUPABASE_URL: 'https://test', SUPABASE_ANON_KEY: 'publishable' };
  vm.runInNewContext(fs.readFileSync('js/habit-suggestions.js', 'utf8'), context);
  context.window.HabitSuggestions.mount(form, 1);
  elements.goal.value = 'I scroll after lunch.'; elements['ai-consent'].checked = true;
  return elements;
}
test('UI suggestion click fills editable habit without submitting or overwriting typed text automatically', async () => {
  const el = ui(async () => json({ suggestions: habits })); el.habit.value = 'My own habit';
  await el['suggest-habits'].fire('click'); assert.equal(el.habit.value, 'My own habit');
  assert.equal(el['habit-suggestions'].children.length, 3);
  el['habit-suggestions'].children[0].fire('click'); assert.equal(el.habit.value, habits[0]); assert.equal(el.habit.focused, true);
  assert.equal(el.submit.disabled, false);
});
test('UI discards stale responses and clears consent when reflection changes', async () => {
  let resolve; const el = ui(() => new Promise(r => resolve = r));
  const pending = el['suggest-habits'].fire('click'); await new Promise(r => setImmediate(r));
  el.goal.value = 'Changed reflection'; el.goal.fire('input'); resolve(json({ suggestions: habits })); await pending;
  assert.equal(el['habit-suggestions'].children.length, 0); assert.equal(el['ai-consent'].checked, false); assert.equal(el['suggest-habits'].disabled, false);
});
test('UI failures preserve draft and manual completion', async () => {
  const el = ui(async () => json({ message: 'Daily limit reached' }, 429)); el.habit.value = 'Keep this';
  await el['suggest-habits'].fire('click'); assert.equal(el.habit.value, 'Keep this'); assert.equal(el['ai-status'].textContent, 'Daily limit reached'); assert.equal(el.submit.disabled, false);
});
