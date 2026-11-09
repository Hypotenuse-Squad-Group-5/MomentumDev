const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');

function makeLiveApp(db, opts = {}) {
  const memory = new Map();
  const selections = [];
  const ctx = vm.createContext({
    console,
    Date,
    crypto: webcrypto,
    location: { origin: 'http://test', pathname: '/friends.html' },
    localStorage: {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    },
  });
  ctx.window = ctx;
  ctx.addEventListener = () => {};
  ctx.MOMENTUM_CONFIG = { SUPABASE_URL: 'test', SUPABASE_ANON_KEY: 'test' };

  const uid = opts.user || 'user-a';

  const applyFilters = (rows, filters) =>
    rows.filter((row) =>
      filters.every(([op, k, v]) => {
        if (op === 'eq') return row[k] === v;
        if (op === 'neq') return row[k] !== v;
        if (op === 'ilike') {
          const needle = String(v).replace(/%/g, '').toLowerCase();
          return String(row[k] || '').toLowerCase().includes(needle);
        }
        if (op === 'in') return Array.isArray(v) && v.includes(row[k]);
        if (op === 'or') {
          return String(v)
            .split(',')
            .some((clause) => {
              const m = clause.match(/^(\w+)\.eq\.(.+)$/);
              return m ? row[m[1]] === m[2] : false;
            });
        }
        return true;
      })
    );

  const hydrateFriendships = (rows) =>
    rows.map((r) => {
      const req = (db.profiles || []).find((p) => p.id === r.requester_id) || null;
      const add = (db.profiles || []).find((p) => p.id === r.addressee_id) || null;
      return {
        ...r,
        requester: req ? { id: req.id, first_name: req.first_name, bio: req.bio, avatar_url: req.avatar_url, created_at: req.created_at } : null,
        addressee: add ? { id: add.id, first_name: add.first_name, bio: add.bio, avatar_url: add.avatar_url, created_at: add.created_at } : null,
      };
    });

  const builder = (table) => {
    const filters = [];
    let selection = '';
    let inserted = null;
    let updated = null;
    let deleting = false;
    let wantSingle = false;
    let wantMaybeSingle = false;

    const execute = () => {
      selections.push({ table, selection });
      if (table === 'profiles' && /\b(city|state)\b/.test(selection)) {
        return { data: null, error: { message: 'Column does not exist in current schema: ' + selection } };
      }
      if (opts.failTable === table) {
        return { data: null, error: { message: 'Database error on ' + table } };
      }

      if (inserted) {
        if (table === 'friendships') {
          const dup = (db.friendships || []).find(
            (r) =>
              (r.requester_id === inserted.requester_id && r.addressee_id === inserted.addressee_id) ||
              (r.requester_id === inserted.addressee_id && r.addressee_id === inserted.requester_id)
          );
          if (dup) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "friendships_one_per_pair"' } };
          }
          const row = {
            id: 'f-' + ((db.friendships || []).length + 1),
            created_at: new Date().toISOString(),
            accepted_at: null,
            ...inserted,
          };
          db.friendships.push(row);
          return { data: wantSingle || wantMaybeSingle ? row : [row], error: null };
        }
        db[table].push(inserted);
        return { data: inserted, error: null };
      }

      if (updated) {
        const matched = applyFilters(db[table] || [], filters);
        if (!matched.length) {
          return { data: wantMaybeSingle ? null : [], error: null };
        }
        matched.forEach((row) => Object.assign(row, updated));
        return { data: wantSingle || wantMaybeSingle ? matched[0] : matched, error: null };
      }

      if (deleting) {
        const matched = new Set(applyFilters(db[table] || [], filters));
        db[table] = (db[table] || []).filter((r) => !matched.has(r));
        return { data: null, error: null };
      }

      let data = applyFilters(db[table] || [], filters);
      if (['habits', 'lesson_completions', 'point_events'].includes(table)) {
        data = data.filter((r) => r.profile_id === uid);
      }
      if (table === 'friendships') {
        data = hydrateFriendships(data);
      }
      if (wantMaybeSingle) {
        return { data: data[0] || null, error: null };
      }
      if (wantSingle) {
        return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'Not found' } };
      }
      return { data, error: null };
    };

    const b = {
      select: (cols) => { selection = cols; return b; },
      eq: (k, v) => { filters.push(['eq', k, v]); return b; },
      neq: (k, v) => { filters.push(['neq', k, v]); return b; },
      ilike: (k, v) => { filters.push(['ilike', k, v]); return b; },
      in: (k, v) => { filters.push(['in', k, v]); return b; },
      or: (v) => { filters.push(['or', 'or', v]); return b; },
      order: () => b,
      limit: () => b,
      insert: (row) => { inserted = row; return b; },
      update: (patch) => { updated = patch; return b; },
      delete: () => { deleting = true; return b; },
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

  vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), ctx);
  return { Store: ctx.Store, selections };
}

function seedDb() {
  return {
    profiles: [
      { id: 'user-a', auth_user_id: 'user-a', username: 'user_a', first_name: 'Alice', bio: 'Hi', avatar_url: null, created_at: '2026-10-01T00:00:00Z' },
      { id: 'user-b', auth_user_id: 'user-b', username: 'user_b', first_name: 'Bob', bio: 'Hikes on weekends', avatar_url: 'https://example.com/bob.jpg', created_at: '2026-10-05T00:00:00Z' },
      { id: 'user-c', auth_user_id: 'user-c', username: 'user_c', first_name: 'Clara', bio: 'Board game fan', avatar_url: null, created_at: '2026-10-12T00:00:00Z' },
    ],
    profile_private: [
      { profile_id: 'user-a', last_name: 'Smith', email: 'alice@example.invalid', sex: 'female', age_confirmed_at: '2026-10-01T00:00:00Z' },
    ],
    lessons: Array.from({ length: 6 }, (_, i) => ({ id: 101 + i, number: i + 1, curriculum_version: 2 })),
    lesson_completions: [],
    habits: [],
    habit_checkins: [],
    point_events: [],
    point_values: [],
    posts: [],
    interests: [],
    profile_interests: [],
    activities: [],
    friendships: [
      { id: 'f-existing', requester_id: 'user-b', addressee_id: 'user-a', status: 'pending', met_at_activity_id: null, created_at: '2026-11-01T00:00:00Z', accepted_at: null },
    ],
  };
}

test('live friendships never query dropped city/state columns and support full request lifecycle', async () => {
  const db = seedDb();
  const { Store, selections } = makeLiveApp(db, { user: 'user-a' });
  assert.equal(await Store.init(), true);

  // Incoming request from Bob loaded in init()
  assert.equal(Store.incomingRequests().length, 1);
  assert.equal(Store.profile('user-b').first, 'Bob');
  assert.equal(Store.profile('user-b').avatarUrl, 'https://example.com/bob.jpg');

  // Accept incoming request
  const acc = await Store.acceptFriend('f-existing');
  assert.equal(acc.ok, true);
  assert.equal(Store.isFriend('user-b'), true);
  assert.equal(Store.incomingRequests().length, 0);

  // Search profiles returns Clara and caches her public fields
  const found = await Store.searchProfiles('cla');
  assert.equal(found.ok, true);
  assert.deepEqual(found.ids, ['user-c']);
  assert.equal(Store.profile('user-c').first, 'Clara');
  assert.equal(Store.profile('user-c').memberSince, '2026-10-12T00:00:00Z');

  // Send request to Clara, then cancel it
  const sent = await Store.sendFriendRequest('user-c');
  assert.equal(sent.ok, true);
  assert.equal(Store.sentRequests().length, 1);
  const cancelled = await Store.cancelFriendRequest('user-c');
  assert.equal(cancelled.ok, true);
  assert.equal(Store.sentRequests().length, 0);

  // Unfriend Bob
  const removed = await Store.removeFriend('user-b');
  assert.equal(removed.ok, true);
  assert.equal(Store.isFriend('user-b'), false);

  // Confirm no query ever asked for city or state
  const badSelection = selections.find((s) => /\b(city|state)\b/.test(s.selection));
  assert.equal(badSelection, undefined);
});

test('loadProfile loads public profile across fresh page load and handles missing IDs', async () => {
  const db = seedDb();
  const { Store } = makeLiveApp(db, { user: 'user-a' });
  assert.equal(await Store.init(), true);

  const clara = await Store.loadProfile('user-c');
  assert.equal(clara.ok, true);
  assert.equal(clara.profile.first, 'Clara');
  assert.equal(clara.profile.bio, 'Board game fan');
  assert.equal(Store.profile('user-c').first, 'Clara');

  const missing = await Store.loadProfile('does-not-exist');
  assert.equal(missing.ok, true);
  assert.equal(missing.profile, null);
});

test('simultaneous mutual friend request refreshes state and surfaces incoming request', async () => {
  const db = seedDb();
  const { Store } = makeLiveApp(db, { user: 'user-a' });
  assert.equal(await Store.init(), true);

  // Clara sends a request to Alice behind the scenes before Alice clicks Add Friend
  db.friendships.push({
    id: 'f-clara-to-alice',
    requester_id: 'user-c',
    addressee_id: 'user-a',
    status: 'pending',
    met_at_activity_id: null,
    created_at: '2026-11-09T12:00:00Z',
    accepted_at: null,
  });

  const res = await Store.sendFriendRequest('user-c');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'exists');
  assert.match(res.message, /already sent you a friend request/i);
  assert.equal(Store.incomingRequests().some((r) => r.requesterId === 'user-c'), true);
});

test('acceptFriend handles request cancelled by sender right before acceptance', async () => {
  const db = seedDb();
  const { Store } = makeLiveApp(db, { user: 'user-a' });
  assert.equal(await Store.init(), true);

  // Bob cancels in DB before Alice clicks Accept
  db.friendships = db.friendships.filter((r) => r.id !== 'f-existing');

  const res = await Store.acceptFriend('f-existing');
  assert.equal(res.ok, false);
  assert.match(res.message, /no longer pending/i);
  assert.equal(Store.incomingRequests().length, 0);
});

test('searchProfiles surfaces database errors instead of pretending zero matches', async () => {
  const db = seedDb();
  const { Store } = makeLiveApp(db, { user: 'user-a', failTable: 'profiles' });
  // Directly verify searchProfiles behavior when profiles table query errors
  const res = await Store.searchProfiles('Bob');
  assert.equal(res.ok, false);
  assert.match(res.message, /Database error/);
});

test('demo mode search and friendships work without Supabase', async () => {
  const memory = new Map();
  const ctx = vm.createContext({
    console,
    Date,
    crypto: webcrypto,
    location: { origin: 'http://test', pathname: '/friends.html' },
    localStorage: {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    },
  });
  ctx.window = ctx;
  ctx.addEventListener = () => {};
  ctx.MOMENTUM_CONFIG = {};
  vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), ctx);
  const { Store } = ctx;

  // Non-friends can be searched by first name (e.g. Alex)
  const search = await Store.searchProfiles('Alex');
  assert.equal(search.ok, true);
  assert.equal(search.ids.length, 1);

  const alexId = search.ids[0];
  const req = await Store.sendFriendRequest(alexId);
  assert.equal(req.ok, true);
  assert.equal(Store.sentRequests().some((r) => r.addresseeId === alexId), true);

  const cancel = await Store.cancelFriendRequest(alexId);
  assert.equal(cancel.ok, true);
  assert.equal(Store.sentRequests().some((r) => r.addresseeId === alexId), false);
});

test('frontend social scripts parse cleanly and contain no removed profile city/state references', () => {
  const files = ['js/store.js', 'js/ui.js', 'js/pages/social.js', 'js/pages/friends.js', 'js/pages/profile.js'];
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    new vm.Script(code, { filename: file });
    if (file !== 'js/store.js') {
      assert.equal(/\.city\b/.test(code), false, `${file} should not reference removed profile city field`);
      assert.equal(/(?:\bp|\bprofile\([^)]*\))\.state\b/.test(code), false, `${file} should not reference removed profile state field`);
    }
  }
});
