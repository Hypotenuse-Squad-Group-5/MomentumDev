const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createDOM() {
  const elements = new Map();

  function makeEl(tag) {
    return {
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
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }

  const document = {
    createElement: makeEl,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl('div'));
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: makeEl('body')
  };

  return { document, elements };
}

function setupApp() {
  const { document, elements } = createDOM();
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

  return { ctx, document, elements };
}

test('Migration 022 exists and contains friends-only posts migration, constraints, and RLS', () => {
  const sql = fs.readFileSync('database/022_friends_only_posts.sql', 'utf8');
  const supaSql = fs.readFileSync('supabase/migrations/20261116010000_friends_only_posts.sql', 'utf8');

  for (const content of [sql, supaSql]) {
    assert.match(content, /update public\.posts set visibility = 'friends'/i);
    assert.match(content, /alter table public\.posts drop constraint if exists posts_visibility_check/i);
    assert.match(content, /alter table public\.posts add constraint posts_visibility_check check \(visibility = 'friends'\)/i);
    assert.match(content, /update public\.user_settings set post_visibility = 'friends'/i);
    assert.match(content, /create policy "read friends or own posts" on public\.posts/i);
    assert.match(content, /author_id = public\.current_profile_id\(\)/i);
    assert.match(content, /f\.status = 'accepted'/i);
  }
});

test('profile.js composer removes visibility selector and includes friends-only reminder', () => {
  const code = fs.readFileSync('js/pages/profile.js', 'utf8');
  assert.doesNotMatch(code, /<select id="vis"/);
  assert.doesNotMatch(code, /Who can see this\?/);
  assert.doesNotMatch(code, /All posts made are currently public right now/);
  assert.match(code, /Text posts save to your profile and are only visible to your friends\./);
  assert.match(code, /visibility:\s*"friends"/);
});

test('profile.js hides posts and shows "-" for Posts count when viewing non-friend profile', () => {
  const code = fs.readFileSync('js/pages/profile.js', 'utf8');
  // Stat shows "-" for non-friends
  assert.match(code, /friend \? history\.filter\(\(h\) => h\.kind === "post"\)\.length : "-"/);
  // History filter excludes posts for non-friends
  assert.match(code, /h\.kind === "activity" && h\.hosting && h\.activity\.visibility === "public"/);
  assert.doesNotMatch(code, /h\.kind === "post" && h\.post\.visibility === "public"/);
});

test('settings.js does not offer post visibility options', () => {
  const code = fs.readFileSync('js/pages/settings.js', 'utf8');
  assert.doesNotMatch(code, /sel\("postVisibility"/);
});

test('social.js renders "Friends Only" tag on post cards', () => {
  const { ctx } = setupApp();
  ctx.Store.profile = (id) => ({ id, first: 'Test', last: 'User' });
  ctx.Store.fullName = (id) => 'Test User';
  ctx.Store.isFriend = () => false;
  const socialCode = fs.readFileSync('js/pages/social.js', 'utf8');
  vm.runInContext(socialCode, ctx);

  const post = {
    id: 'post-123',
    authorId: ctx.Store.ME || 'user-1',
    caption: 'My friends-only post',
    activityId: null,
    visibility: 'friends',
    createdAt: new Date().toISOString()
  };

  const cardHtml = ctx.Social.postCard(post, { own: true });
  assert.match(cardHtml, /<span class="tag grey">Friends Only<\/span>/);
  assert.doesNotMatch(cardHtml, /<span class="tag ok">Public<\/span>/);
});

test('store.js createPost inserts visibility as "friends"', () => {
  const code = fs.readFileSync('js/store.js', 'utf8');
  const createPostSection = code.match(/async function createPost[\s\S]*?^  \}/m);
  assert.ok(createPostSection, 'createPost function should exist');
  assert.match(createPostSection[0], /visibility:\s*"friends"/);
  assert.doesNotMatch(createPostSection[0], /visibility:\s*"public"/);
});

test('store.js feed() filters posts to only friends and self', () => {
  const code = fs.readFileSync('js/store.js', 'utf8');
  const feedSection = code.match(/function feed\(\)[\s\S]*?^  \}/m);
  assert.ok(feedSection, 'feed function should exist');
  assert.match(feedSection[0], /pList\.filter\(\(p\) => fr\.has\(p\.authorId\)\)/);
  assert.doesNotMatch(feedSection[0], /p\.visibility === "public" \|\| fr\.has\(p\.authorId\)/);
});
