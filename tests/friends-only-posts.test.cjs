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

function setupApp(options = {}) {
  const { document, elements } = createDOM();
  const dbData = options.dbData || {};
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
        from: (table) => ({
          select: () => ({
            order: () => ({
              data: dbData[table] || [],
              error: null
            })
          })
        })
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
  assert.match(code, /Posts save to your profile and are visible only to your friends\./);
  assert.match(code, /visibility:\s*"friends"/);
});

test('profile.js hides posts from non-friends and shows Activities, Friends, Momentum on every profile', () => {
  const code = fs.readFileSync('js/pages/profile.js', 'utf8');
  // Every profile shows the same three numbers (decided 2026-11-16: no Status or Posts stat)
  assert.match(code, /<span>Activities<\/span>[\s\S]*<span>Friends<\/span>[\s\S]*<span>Momentum<\/span>/);
  assert.doesNotMatch(code, /<span>\$\{own \? "Momentum" : "Posts"\}<\/span>/);
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

test('store.js feed() filters posts and activities to only friends, excluding self and strangers', () => {
  const code = fs.readFileSync('js/store.js', 'utf8');
  const feedSection = code.match(/function feed\(\)[\s\S]*?^  \}/m);
  assert.ok(feedSection, 'feed function should exist');
  assert.match(feedSection[0], /pList\.filter\(\(p\) => fr\.has\(p\.authorId\)\)/);
  assert.doesNotMatch(feedSection[0], /fr\.add\(ME\)/);
  assert.doesNotMatch(feedSection[0], /a\.visibility === "public"/);
  assert.match(feedSection[0], /fr\.has\(a\.hostId\)/);
  assert.match(feedSection[0], /!isPast\(a\)/);
});

test('social.js subnav renders "Friends List" label', () => {
  const { ctx } = setupApp();
  ctx.Store.incomingRequests = () => [];
  const socialCode = fs.readFileSync('js/pages/social.js', 'utf8');
  vm.runInContext(socialCode, ctx);
  const navHtml = ctx.Social.subnav('feed');
  assert.match(navHtml, /Friends List/);
  assert.doesNotMatch(navHtml, />Friends</);
});

test('Store.feed() returns only friends active activities and posts, excluding own and strangers', async () => {
  const now = Date.now();
  const futureStart = new Date(now + 3600000).toISOString();
  const futureEnd = new Date(now + 7200000).toISOString();
  const pastStart = new Date(now - 7200000).toISOString();
  const pastEnd = new Date(now - 3600000).toISOString();

  const db = {
    profiles: [
      { id: 'user-me', auth_user_id: 'user-me', first_name: 'Me', bio: '', avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 'friend-1', auth_user_id: 'friend-1', first_name: 'Friend', bio: '', avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
      { id: 'stranger-1', auth_user_id: 'stranger-1', first_name: 'Stranger', bio: '', avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
    ],
    profile_private: [
      { profile_id: 'user-me', email: 'me@example.com' },
    ],
    lessons: Array.from({ length: 6 }, (_, i) => ({ id: 101 + i, number: i + 1, curriculum_version: 2 })),
    lesson_completions: [],
    habits: [],
    habit_checkins: [],
    momentum_log: [],
    interests: [{ id: 'int-1', name: 'Games', is_active: true }],
    profile_interests: [],
    user_blocks: [],
    conversations: [],
    rsvps: [],
    guests: [],
    friendships: [
      { id: 'f-1', requester_id: 'user-me', addressee_id: 'friend-1', status: 'accepted', met_at_activity_id: null, created_at: '2026-01-01T00:00:00Z', accepted_at: '2026-01-01T01:00:00Z' },
    ],
    activities: [
      {
        id: 'act-friend-public',
        host_id: 'friend-1',
        title: 'Friend Public Activity',
        starts_at: futureStart,
        ends_at: futureEnd,
        visibility: 'public',
        created_at: new Date(now - 1000).toISOString(),
      },
      {
        id: 'act-friend-friends',
        host_id: 'friend-1',
        title: 'Friend Friends-Only Activity',
        starts_at: futureStart,
        ends_at: futureEnd,
        visibility: 'friends',
        created_at: new Date(now - 2000).toISOString(),
      },
      {
        id: 'act-friend-past',
        host_id: 'friend-1',
        title: 'Friend Past Activity',
        starts_at: pastStart,
        ends_at: pastEnd,
        visibility: 'public',
        created_at: new Date(now - 3000).toISOString(),
      },
      {
        id: 'act-own',
        host_id: 'user-me',
        title: 'Own Activity',
        starts_at: futureStart,
        ends_at: futureEnd,
        visibility: 'friends',
        created_at: new Date(now - 500).toISOString(),
      },
      {
        id: 'act-stranger',
        host_id: 'stranger-1',
        title: 'Stranger Activity',
        starts_at: futureStart,
        ends_at: futureEnd,
        visibility: 'public',
        created_at: new Date(now - 4000).toISOString(),
      },
    ],
    posts: [
      {
        id: 'post-own',
        author_id: 'user-me',
        caption: 'My own post',
        activity_id: null,
        visibility: 'friends',
        created_at: new Date(now - 400).toISOString(),
      },
      {
        id: 'post-friend',
        author_id: 'friend-1',
        caption: 'Friend post',
        activity_id: null,
        visibility: 'friends',
        created_at: new Date(now - 1500).toISOString(),
      },
      {
        id: 'post-stranger',
        author_id: 'stranger-1',
        caption: 'Stranger post',
        activity_id: null,
        visibility: 'friends',
        created_at: new Date(now - 2500).toISOString(),
      },
    ],
  };

  const { document } = createDOM();
  const uid = 'user-me';
  const memory = new Map();

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
      data: memory,
      getItem(k) { return memory.get(k) || null; },
      setItem(k, v) { memory.set(k, String(v)); },
      removeItem(k) { memory.delete(k); }
    },
    location: { hash: '', search: '', replace: () => {} },
    MOMENTUM_CONFIG: { SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'test-key' },
  });
  ctx.window = ctx;

  const builder = (table) => {
    const filters = [];
    let wantSingle = false;
    let wantMaybeSingle = false;

    const execute = () => {
      let data = (db[table] || []).slice();
      for (const [op, k, v] of filters) {
        if (op === 'eq') data = data.filter((r) => r[k] === v);
        if (op === 'or') {
          data = data.filter((r) => {
            const clauses = String(v).split(',');
            return clauses.some((clause) => {
              const m = clause.match(/^(\w+)\.eq\.(.+)$/);
              return m ? r[m[1]] === m[2] : false;
            });
          });
        }
      }
      if (table === 'friendships') {
        data = data.map((r) => {
          const req = db.profiles.find((p) => p.id === r.requester_id) || null;
          const add = db.profiles.find((p) => p.id === r.addressee_id) || null;
          return { ...r, requester: req, addressee: add };
        });
      }
      if (table === 'activities') {
        data = data.map((r) => {
          const host = db.profiles.find((p) => p.id === r.host_id) || null;
          return { ...r, host, type: { name: 'Games' } };
        });
      }
      if (table === 'posts') {
        data = data.map((r) => {
          const author = db.profiles.find((p) => p.id === r.author_id) || null;
          return { ...r, author };
        });
      }
      if (wantMaybeSingle) return { data: data[0] || null, error: null };
      if (wantSingle) return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'Not found' } };
      return { data, error: null };
    };

    const b = {
      select: () => b,
      eq: (k, v) => { filters.push(['eq', k, v]); return b; },
      neq: () => b,
      ilike: () => b,
      in: () => b,
      or: (v) => { filters.push(['or', 'or', v]); return b; },
      order: () => b,
      limit: () => b,
      insert: () => b,
      update: () => b,
      delete: () => b,
      single: async () => { wantSingle = true; return execute(); },
      maybeSingle: async () => { wantMaybeSingle = true; return execute(); },
      then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject),
    };
    return b;
  };

  ctx.supabase = {
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: uid } } } }) },
      from: builder,
    }),
  };

  const storeCode = fs.readFileSync('js/store.js', 'utf8');
  const uiCode = fs.readFileSync('js/ui.js', 'utf8');

  vm.runInContext(storeCode, ctx);
  vm.runInContext(uiCode, ctx);

  assert.equal(await ctx.Store.init(), true);
  await ctx.Store.loadActivities(true);
  await ctx.Store.loadPosts(true);

  const feedItems = ctx.Store.feed();

  // Items should be:
  // 1. act-friend-public (friend, future, created at now - 1000)
  // 2. post-friend (friend, created at now - 1500)
  // 3. act-friend-friends (friend, future, created at now - 2000)
  // Excluded:
  // - post-own (own post)
  // - act-own (own activity)
  // - act-friend-past (past activity)
  // - post-stranger (stranger post)
  // - act-stranger (stranger activity)
  assert.equal(feedItems.length, 3);
  assert.equal(feedItems[0].kind, 'activity');
  assert.equal(feedItems[0].activity.id, 'act-friend-public');
  assert.equal(feedItems[1].kind, 'post');
  assert.equal(feedItems[1].post.id, 'post-friend');
  assert.equal(feedItems[2].kind, 'activity');
  assert.equal(feedItems[2].activity.id, 'act-friend-friends');
});

test('button text and ordering: "Host an activity" (green, left) and "Share a post" (white, right)', () => {
  const homeCode = fs.readFileSync('js/pages/home.js', 'utf8');
  const profileCode = fs.readFileSync('js/pages/profile.js', 'utf8');
  const activitiesCode = fs.readFileSync('js/pages/activities.js', 'utf8');
  const activityNewCode = fs.readFileSync('js/pages/activity-new.js', 'utf8');

  // Home: quick actions has Host an activity on left (btn-primary) and Share a post on right (btn)
  assert.match(homeCode, /<a class="btn btn-primary" href="activity-new\.html">\$\{icon\("plus"\)\}Host an activity<\/a>\s*<a class="btn" href="profile\.html\?compose=1">\$\{icon\("post"\)\}Share a post<\/a>/);
  // Home: sidebar hosting prompt says Host an activity with plus icon
  assert.match(homeCode, /href="activity-new\.html">\$\{icon\("plus",\s*"sm"\)\}Host an activity<\/a>/);

  // Profile: Host an activity on left (btn-primary), Share a post in middle (btn), Edit profile on right (btn-ghost)
  assert.match(profileCode, /<a class="btn btn-primary" href="activity-new\.html">\$\{icon\("plus",\s*"sm"\)\}Host an activity<\/a><button class="btn" id="open-compose">\$\{icon\("post",\s*"sm"\)\}Share a post<\/button><a class="btn btn-ghost" href="settings\.html#profile">/);

  // Activities: header and empty filter state say Host an activity with plus icon
  assert.match(activitiesCode, /<a class="btn btn-primary" href="activity-new\.html">\$\{icon\("plus",\s*"sm"\)\}Host an activity<\/a>/);
  assert.match(activitiesCode, /host your own/);

  // Activity-new: <h1> heading says Host an activity
  // (in edit mode the same heading reads "Edit activity")
  assert.match(activityNewCode, /<h1>\$\{editingActivity \? "Edit activity" : "Host an activity"\}<\/h1>/);
});
