const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createDOM() {
  const listeners = new Map();
  const elements = new Map();

  function makeEl(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      attributes: new Map(),
      children: [],
      style: {},
      dataset: {},
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      setAttribute(k, v) { this.attributes.set(k, String(v)); },
      getAttribute(k) { return this.attributes.get(k) || null; },
      hasAttribute(k) { return this.attributes.has(k); },
      removeAttribute(k) { this.attributes.delete(k); },
      addEventListener(evt, fn) {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(fn);
      },
      querySelector(sel) {
        return null;
      },
      querySelectorAll(sel) {
        return [];
      }
    };
    return el;
  }

  const document = {
    createElement: makeEl,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl('div'));
      return elements.get(id);
    },
    querySelector(sel) {
      return null;
    },
    querySelectorAll(sel) {
      return [];
    },
    body: makeEl('body')
  };

  return { document, elements };
}

function setupApp() {
  const { document } = createDOM();
  const ctx = vm.createContext({
    console,
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    JSON,
    setTimeout,
    clearTimeout,
    document,
    window: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      data: new Map(),
      getItem(k) { return this.data.get(k) || null; },
      setItem(k, v) { this.data.set(k, String(v)); },
      removeItem(k) { this.data.delete(k); }
    },
    location: { hash: '', search: '', replace: () => {} },
    MOMENTUM_CONFIG: { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'test-key' },
    supabase: {
      createClient: () => ({
        auth: { getSession: async () => ({ data: { session: null } }) },
        from: () => ({ select: () => ({ order: () => ({ data: [], error: null }) }) })
      })
    }
  });
  ctx.window = ctx;

  const storeCode = fs.readFileSync('js/store.js', 'utf8');
  const uiCode = fs.readFileSync('js/ui.js', 'utf8');

  vm.runInContext(storeCode, ctx);
  vm.runInContext(uiCode, ctx);

  return ctx;
}

test('UI.VIS contains only Public and Friends Only', () => {
  const ctx = setupApp();
  assert.deepEqual(Object.keys(ctx.UI.VIS), ['public', 'friends']);
  assert.equal(ctx.UI.VIS.public, 'Public');
  assert.equal(ctx.UI.VIS.friends, 'Friends Only');
  assert.equal(ctx.UI.VIS.friends_of_friends, undefined);
  assert.equal(ctx.UI.VIS.private, undefined);
});

test('Store normalizes legacy visibility settings', () => {
  const storeCode = fs.readFileSync('js/store.js', 'utf8');
  assert.match(storeCode, /function normalizeVisibility/);
  assert.match(storeCode, /restored\.settings\.activityVisibility = normalizeVisibility/);
  assert.match(storeCode, /restored\.settings\.postVisibility = normalizeVisibility/);
  assert.match(storeCode, /restored\.settings\.friendsListVisibility = normalizeVisibility/);

  // Run the normalization logic in sandbox
  const match = storeCode.match(/function normalizeVisibility\([\s\S]*?^  \}/m);
  assert.ok(match, 'normalizeVisibility function must be present');
  const fn = new Function(`${match[0]}; return normalizeVisibility;`)();
  assert.equal(fn('friends_of_friends'), 'public');
  assert.equal(fn('private'), 'friends');
  assert.equal(fn('public'), 'public');
  assert.equal(fn('friends'), 'friends');
  assert.equal(fn('unknown', 'public'), 'public');
});

test('activity-new.js contains only Public and Friends Only options', () => {
  const code = fs.readFileSync('js/pages/activity-new.js', 'utf8');
  assert.equal(code.includes('Friends of friends'), false);
  assert.equal(code.includes('Only people you invite'), false);
  assert.match(code, /Only your friends can see it\./);
  assert.match(code, /Anyone on Momentum\. The default\./);
});

test('activities.js includes Visibility filter and Friends Only tag', () => {
  const code = fs.readFileSync('js/pages/activities.js', 'utf8');
  assert.match(code, /<select id="f-vis">/);
  assert.match(code, /<option value="all"/);
  assert.match(code, /<option value="friends"/);
  assert.match(code, /<option value="public"/);
  assert.match(code, /Friends Only/);
  assert.match(code, /f\.visibility !== "all"/);
  assert.match(code, /visibility:\s*"all"/);
});

test('activity.js detail page shows Friends Only tag and hides public tag', () => {
  const code = fs.readFileSync('js/pages/activity.js', 'utf8');
  assert.match(code, /a\.visibility === "friends" \? '<span class="tag grey">Friends Only<\/span>' : ""/);
});

test('social.js renders Friends Only tag on activity cards', () => {
  const code = fs.readFileSync('js/pages/social.js', 'utf8');
  assert.match(code, /a\.visibility === "friends" \? '<span class="tag grey">Friends Only<\/span>' : ""/);
});

test('activity.js redirects unfriended cancelled commitments to activities.html', () => {
  const code = fs.readFileSync('js/pages/activity.js', 'utf8');
  assert.match(code, /if \(a\.visibility === "friends" && !Store\.isFriend\(a\.hostId\)\)/);
  assert.match(code, /location\.replace\("activities\.html"\)/);
});

test('Migration 020 fixes RLS policy to ignore cancelled RSVPs and expired guests', () => {
  const sql = fs.readFileSync('database/020_fix_friends_activity_rls.sql', 'utf8');
  assert.match(sql, /signed-in users read activities/);
  assert.match(sql, /r\.status = 'committed' or r\.attended is not null/);
  assert.match(sql, /r\.status = 'committed'\s+and g\.status in \('accepted', 'pending'\)/);

  const supabaseSql = fs.readFileSync('supabase/migrations/20261114010000_fix_friends_activity_rls.sql', 'utf8');
  assert.match(supabaseSql, /signed-in users read activities/);
  assert.match(supabaseSql, /r\.status = 'committed' or r\.attended is not null/);
  assert.match(supabaseSql, /r\.status = 'committed'\s+and g\.status in \('accepted', 'pending'\)/);
});
