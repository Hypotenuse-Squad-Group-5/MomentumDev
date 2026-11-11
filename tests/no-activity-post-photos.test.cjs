const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');

function makeMiniDom() {
  const docListeners = new Map();
  let document;

  const parseAttrs = (str) => {
    const attrs = {};
    const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = re.exec(str))) {
      attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    return attrs;
  };

  const matchSelector = (el, sel) => {
    if (!el || el.nodeType !== 1) return false;
    return sel.split(',').some((part) => {
      const s = part.trim();
      if (!s) return false;
      const simple = s.split(/\s+/).pop();
      let rest = simple;
      if (/:checked\b/.test(rest)) {
        if (!el.checked) return false;
        rest = rest.replace(/:checked\b/g, '');
      }
      const idMatch = rest.match(/^#([A-Za-z0-9_-]+)/);
      if (idMatch) {
        if (el.id !== idMatch[1]) return false;
        rest = rest.slice(idMatch[0].length);
        if (!rest) return true;
      }
      const tagMatch = rest.match(/^([A-Za-z][A-Za-z0-9]*)/);
      if (tagMatch) {
        if (el.tagName !== tagMatch[1].toUpperCase()) return false;
        rest = rest.slice(tagMatch[1].length);
      }
      const attrMatches = [...rest.matchAll(/\[([^=\]]+)(?:=["']?([^"\]]+)["']?)?\]/g)];
      for (const am of attrMatches) {
        const val = el.getAttribute(am[1]);
        if (am[2] !== undefined) {
          if (val !== am[2]) return false;
        } else if (val === null) {
          return false;
        }
      }
      rest = rest.replace(/\[[^\]]+\]/g, '');
      const clsMatches = [...rest.matchAll(/\.([A-Za-z0-9_-]+)/g)];
      for (const cm of clsMatches) {
        if (!el.classList.contains(cm[1])) return false;
      }
      return true;
    });
  };

  const VOID_TAGS = new Set(['input', 'img', 'hr', 'br', 'meta', 'link']);

  class FakeElement {
    constructor(tag) {
      this.nodeType = 1;
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.dataset = {};
      this._text = '';
      this._value = '';
      this._listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
      this.open = false;
      this.files = [];
      this.scrollTop = 0;
      this.scrollHeight = 100;
      const self = this;
      this.classList = {
        add: (...cls) => {
          const set = new Set((self.className || '').split(/\s+/).filter(Boolean));
          cls.forEach((c) => set.add(c));
          self.className = [...set].join(' ');
        },
        remove: (...cls) => {
          const rem = new Set(cls);
          self.className = (self.className || '').split(/\s+/).filter((c) => c && !rem.has(c)).join(' ');
        },
        toggle: (c, force) => {
          const has = self.classList.contains(c);
          const want = force !== undefined ? !!force : !has;
          if (want) self.classList.add(c);
          else self.classList.remove(c);
          return want;
        },
        contains: (c) => (self.className || '').split(/\s+/).includes(c),
      };
    }
    get id() { return this.attributes.id || ''; }
    set id(v) { this.attributes.id = String(v); }
    get className() { return this.attributes.class || ''; }
    set className(v) { this.attributes.class = String(v); }
    get value() {
      if (this.tagName === 'TEXTAREA') return this._value || this.textContent;
      if (this.tagName === 'SELECT' && !this._value) {
        const opt = this.querySelector('option[selected]') || this.querySelector('option');
        return opt ? (opt.getAttribute('value') ?? opt.textContent) : '';
      }
      return this._value;
    }
    set value(v) { this._value = String(v ?? ''); this.attributes.value = this._value; }
    get textContent() {
      return this._text + this.children.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this._text = String(v ?? '');
      this.children = [];
    }
    setAttribute(k, v) {
      const val = String(v ?? '');
      this.attributes[k] = val;
      if (k === 'hidden') this.hidden = true;
      if (k === 'disabled') this.disabled = true;
      if (k === 'checked') this.checked = true;
      if (k === 'open') this.open = true;
      if (k === 'value') this._value = val;
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        this.dataset[camel] = val;
      }
    }
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    insertBefore(newNode, ref) {
      newNode.parentNode = this;
      const idx = this.children.indexOf(ref);
      if (idx === -1) this.children.push(newNode);
      else this.children.splice(idx, 0, newNode);
      return newNode;
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
        this.parentNode = null;
      }
    }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    setSelectionRange() {}
    dispatchEvent(ev) {
      const type = ev && ev.type ? ev.type : '';
      if (type && typeof this['on' + type] === 'function') this['on' + type](ev);
      if (type && this._listeners[type]) this._listeners[type].forEach((fn) => fn(ev));
    }
    addEventListener(ev, fn) {
      if (!this._listeners[ev]) this._listeners[ev] = [];
      this._listeners[ev].push(fn);
    }
    removeEventListener(ev, fn) {
      if (this._listeners[ev]) this._listeners[ev] = this._listeners[ev].filter((f) => f !== fn);
    }
    click() {
      let stopped = false;
      const e = { preventDefault() {}, stopPropagation() { stopped = true; }, target: this };
      let ret;
      if (typeof this.onclick === 'function') ret = this.onclick(e);
      let cur = this;
      while (cur && !stopped) {
        if (cur._listeners.click) cur._listeners.click.forEach((fn) => fn(e));
        cur = cur.parentNode;
      }
      return ret;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (node) => {
        for (const ch of node.children) {
          if (matchSelector(ch, sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (matchSelector(cur, sel)) return cur;
        cur = cur.parentNode;
      }
      return null;
    }
    get innerHTML() {
      const ser = (node) =>
        '<' + node.tagName.toLowerCase() +
        Object.entries(node.attributes).map(([k, v]) => ' ' + k + '="' + v + '"').join('') + '>' +
        (VOID_TAGS.has(node.tagName.toLowerCase()) ? '' : node._text + node.children.map(ser).join('') + '</' + node.tagName.toLowerCase() + '>');
      return this._text + this.children.map(ser).join('');
    }
    set innerHTML(html) {
      this.children = [];
      this._text = '';
      const stack = [this];
      const tokenRe = /<(\/)?([A-Za-z][A-Za-z0-9]*)([^>]*?)(\/)?>|([^<]+)/g;
      let m;
      while ((m = tokenRe.exec(String(html || '')))) {
        const top = stack[stack.length - 1];
        if (m[5]) {
          top._text += m[5].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        } else if (m[1]) {
          if (stack.length > 1) stack.pop();
        } else {
          const tag = m[2].toLowerCase();
          const el = new FakeElement(tag);
          const attrs = parseAttrs(m[3] || '');
          Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
          top.appendChild(el);
          if (!m[4] && !VOID_TAGS.has(tag)) stack.push(el);
        }
      }
    }
  }

  const root = new FakeElement('html');
  const body = new FakeElement('body');
  const main = new FakeElement('main');
  main.id = 'main';
  body.appendChild(main);
  root.appendChild(body);

  document = {
    body,
    activeElement: null,
    documentElement: new FakeElement('html'),
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() {} }),
          toBlob: (cb, type) => cb({ size: 1234, type: type || 'image/jpeg' }),
        };
      }
      return new FakeElement(tag);
    },
    getElementById: (id) => root.querySelector('#' + id),
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener: (ev, fn) => {
      if (!docListeners.has(ev)) docListeners.set(ev, []);
      docListeners.get(ev).push(fn);
    },
    removeEventListener: (ev, fn) => {
      if (docListeners.has(ev)) docListeners.set(ev, docListeners.get(ev).filter((f) => f !== fn));
    },
  };
  return { document, body, main };
}

function makeLiveApp(db, opts = {}) {
  const dom = opts.dom || makeMiniDom();
  const memory = new Map();
  const storageOps = [];
  const uid = opts.user || 'user-a';
  const page = opts.page || 'home';
  const search = opts.search || '';
  const hash = opts.hash || '';

  const ctx = vm.createContext({
    console,
    Date,
    Math,
    URLSearchParams,
    Event: function Event(type) { this.type = type; },
    setTimeout,
    clearTimeout,
    crypto: webcrypto,
    document: dom.document,
    getComputedStyle: () => ({ getPropertyValue: () => '', display: 'none' }),
    URL: { createObjectURL: () => 'blob:mock-avatar', revokeObjectURL: () => {} },
    Image: class MockImage {
      constructor() { this.naturalWidth = 600; this.naturalHeight = 600; }
      set src(v) { this._src = v; if (typeof this.onload === 'function') this.onload(); }
    },
    location: { origin: 'http://test', pathname: '/' + page + '.html', search, hash, replace() {}, reload() {}, href: '' },
    localStorage: {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    confirm: () => true,
  });
  ctx.window = ctx;
  ctx.addEventListener = () => {};
  ctx.MOMENTUM_CONFIG = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test-key' };

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
          return String(v).split(',').some((clause) => {
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

  const hydratePosts = (rows) =>
    rows.map((r) => {
      const author = (db.profiles || []).find((p) => p.id === r.author_id) || null;
      return {
        ...r,
        author: author ? { first_name: author.first_name, avatar_url: author.avatar_url, created_at: author.created_at } : null,
      };
    });

  const hydrateActivities = (rows) =>
    rows.map((r) => {
      const host = (db.profiles || []).find((p) => p.id === r.host_id) || null;
      const type = (db.activity_types || []).find((t) => t.id === r.type_id) || null;
      return {
        ...r,
        host: host ? { first_name: host.first_name, avatar_url: host.avatar_url, created_at: host.created_at } : null,
        type: type ? { name: type.name } : null,
      };
    });

  const builder = (table) => {
    const filters = [];
    let inserted = null;
    let updated = null;
    let deleting = false;
    let wantSingle = false;
    let wantMaybeSingle = false;

    const execute = () => {
      if (inserted) {
        db[table] = db[table] || [];
        const row = {
          id: inserted.id || table + '-' + (db[table].length + 1),
          created_at: inserted.created_at || new Date().toISOString(),
          ...inserted,
        };
        db[table].push(row);
        const out = table === 'posts' ? hydratePosts([row])[0] : row;
        return { data: wantSingle || wantMaybeSingle ? out : [out], error: null };
      }
      if (updated) {
        const matched = applyFilters(db[table] || [], filters);
        if (!matched.length) return { data: wantMaybeSingle ? null : [], error: null };
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
      if (table === 'friendships') data = hydrateFriendships(data);
      if (table === 'posts') data = hydratePosts(data);
      if (table === 'activities') data = hydrateActivities(data);
      if (wantMaybeSingle) return { data: data[0] || null, error: null };
      if (wantSingle) return data[0] ? { data: data[0], error: null } : { data: null, error: { message: 'Not found' } };
      return { data, error: null };
    };

    const b = {
      select: () => b,
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
      auth: {
        getSession: async () => ({ data: { session: { user: { id: uid } } } }),
        signOut: async () => {},
      },
      from: builder,
      storage: {
        from: (bucket) => ({
          upload: async (filePath, blob, uploadOpts) => {
            storageOps.push({ op: 'upload', bucket, filePath, blob, uploadOpts });
            return { data: { path: filePath }, error: null };
          },
          getPublicUrl: (filePath) => ({
            data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${filePath}` },
          }),
          remove: async (paths) => {
            storageOps.push({ op: 'remove', bucket, paths });
            return { data: paths, error: null };
          },
        }),
      },
    }),
  };

  vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/ui.js', 'utf8'), ctx);
  return { ctx, dom, Store: ctx.Store, UI: ctx.UI, storageOps };
}

function seedDb() {
  const futureStart = new Date(Date.now() + 2 * 864e5).toISOString();
  const futureEnd = new Date(Date.now() + 2 * 864e5 + 3600e3).toISOString();
  return {
    profiles: [
      { id: 'user-a', auth_user_id: 'user-a', username: 'alice', first_name: 'Alice', bio: 'Enjoys board games', avatar_url: null, created_at: '2026-10-01T00:00:00Z' },
      { id: 'user-b', auth_user_id: 'user-b', username: 'bob', first_name: 'Bob', bio: 'Hikes on weekends', avatar_url: 'https://example.com/bob.jpg', created_at: '2026-10-05T00:00:00Z' },
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
    posts: [
      { id: 'post-1', author_id: 'user-b', caption: 'Evening walk around Provo!', activity_id: null, visibility: 'public', created_at: '2026-11-10T10:00:00Z' },
    ],
    interests: [{ name: 'Board games' }],
    profile_interests: [],
    activity_types: [{ id: 'type-1', name: 'Games', emoji: '🎲', sort_order: 1 }],
    activity_suggestions: [{ name: 'Board games', sort_order: 1 }],
    activities: [
      {
        id: 'act-1',
        host_id: 'user-b',
        title: 'Catan Night',
        type_id: 'type-1',
        activity_name: 'board games',
        location_name: 'Wilkinson Center',
        city: 'Provo',
        exact_address: '100 Campus Dr',
        starts_at: futureStart,
        ends_at: futureEnd,
        min_people: 3,
        max_people: 8,
        description: 'Bring snacks if you want!',
        bring: 'Nothing required',
        visibility: 'public',
        created_at: '2026-11-10T09:00:00Z',
        updated_at: '2026-11-10T09:00:00Z',
      },
    ],
    friendships: [
      { id: 'f-ab', requester_id: 'user-a', addressee_id: 'user-b', status: 'accepted', met_at_activity_id: null, created_at: '2026-10-15T00:00:00Z', accepted_at: '2026-10-15T01:00:00Z' },
    ],
    conversations: [],
    conversation_members: [],
    messages: [],
    user_blocks: [],
  };
}

test('all edited scripts and settings.js parse cleanly', () => {
  const files = [
    'js/ui.js',
    'js/store.js',
    'js/pages/home.js',
    'js/pages/profile.js',
    'js/pages/social.js',
    'js/pages/activity.js',
    'js/pages/activity-new.js',
    'js/pages/settings.js',
  ];
  for (const file of files) {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  }
});

test('UI.icon exposes a non-camera post icon while preserving camera and image icons', () => {
  const db = seedDb();
  const { UI } = makeLiveApp(db);
  const postSvg = UI.icon('post');
  const camSvg = UI.icon('camera');
  const imgSvg = UI.icon('image');

  assert.match(postSvg, /<path /);
  assert.match(camSvg, /<path /);
  assert.match(imgSvg, /<rect /);
  assert.notEqual(postSvg, camSvg);
});

function iconInnerHtml(app, name, cls = '') {
  const probe = app.dom.document.createElement('div');
  probe.innerHTML = app.UI.icon(name, cls);
  return probe.innerHTML;
}

test('home quick action uses post icon instead of camera icon', async () => {
  const db = seedDb();
  const app = makeLiveApp(db, { page: 'home' });
  app.dom.document.body.setAttribute('data-page', 'home');
  vm.runInContext(fs.readFileSync('js/pages/home.js', 'utf8'), app.ctx);
  await new Promise((r) => setTimeout(r, 25));

  const shareLink = app.dom.document.querySelector('a[href="profile.html?compose=1"]');
  assert.ok(shareLink);
  assert.match(shareLink.textContent, /Share a post/);
  assert.equal(shareLink.innerHTML.includes(iconInnerHtml(app, 'post')), true);
  assert.equal(shareLink.innerHTML.includes(iconInnerHtml(app, 'camera')), false);
});

test('profile post composer has no photo picker, uses post icon & "Post" label, and creates text-only posts', async () => {
  const db = seedDb();
  const app = makeLiveApp(db, { page: 'profile', search: '?compose=1' });
  app.dom.document.body.setAttribute('data-page', 'profile');
  vm.runInContext(fs.readFileSync('js/pages/social.js', 'utf8'), app.ctx);
  vm.runInContext(fs.readFileSync('js/pages/profile.js', 'utf8'), app.ctx);
  await new Promise((r) => setTimeout(r, 25));

  const mainHtml = app.dom.main.innerHTML;
  const openBtn = app.dom.document.getElementById('open-compose');
  const emptyBtn = app.dom.document.getElementById('empty-compose');
  assert.ok(openBtn);
  assert.ok(emptyBtn);
  assert.equal(openBtn.innerHTML.includes(iconInnerHtml(app, 'post', 'sm')), true);
  assert.equal(openBtn.innerHTML.includes(iconInnerHtml(app, 'camera', 'sm')), false);
  assert.equal(emptyBtn.innerHTML.includes(iconInnerHtml(app, 'post', 'sm')), true);
  assert.equal(emptyBtn.innerHTML.includes(iconInnerHtml(app, 'camera', 'sm')), false);

  assert.equal(app.dom.document.querySelector('.photo-picker'), null);
  assert.equal(app.dom.document.querySelector('[data-photo]'), null);
  assert.equal(/Photos coming soon/i.test(mainHtml), false);

  const label = app.dom.document.querySelector('label[for="caption"]');
  assert.ok(label);
  assert.equal(label.textContent, 'Post');

  // Empty submit shows updated error message
  const form = app.dom.document.getElementById('composer');
  assert.ok(form);
  await form.onsubmit({ preventDefault() {} });
  assert.match(app.dom.main.textContent, /Write something before posting\./);

  // Over-500-char validation through Store.createPost
  const longRes = await app.Store.createPost({ caption: 'a'.repeat(501), activityId: '', visibility: 'public' });
  assert.equal(longRes.ok, false);
  assert.equal(longRes.message, 'Posts can be up to 500 characters.');

  // Valid submit persists post without any photos field
  const captionEl = app.dom.document.getElementById('caption');
  captionEl.oninput({ target: { value: 'Went on a sunset walk!' } });
  await app.dom.document.getElementById('composer').onsubmit({ preventDefault() {} });

  const inserted = db.posts.find((p) => p.caption === 'Went on a sunset walk!');
  assert.ok(inserted);
  assert.equal('photos' in inserted, false);
  assert.equal('photos' in app.Store.state.posts[0], false);
  assert.equal(app.dom.document.getElementById('composer'), null);
  assert.match(app.dom.main.textContent, /Went on a sunset walk!/);
});

test('social feed and cards render posts and activities without photo grids or cover banners', async () => {
  const db = seedDb();
  const app = makeLiveApp(db, { page: 'social' });
  app.dom.document.body.setAttribute('data-page', 'feed');
  app.dom.document.body.dataset = { page: 'feed' };
  vm.runInContext(fs.readFileSync('js/pages/social.js', 'utf8'), app.ctx);
  await new Promise((r) => setTimeout(r, 25));

  assert.match(app.dom.main.textContent, /Evening walk around Provo!/);
  assert.match(app.dom.main.textContent, /Catan Night/);
  assert.equal(app.dom.main.querySelector('.photo-grid'), null);
  assert.equal(app.dom.main.querySelector('.photo'), null);
  assert.equal(app.dom.main.innerHTML.includes(iconInnerHtml(app, 'camera', 'lg')), false);

  // Even if passed a legacy post object with photos > 0, Social.postCard never renders .photo-grid
  const legacyCard = app.ctx.Social.postCard({
    id: 'legacy-p',
    authorId: 'user-b',
    caption: 'Legacy text still renders',
    photos: 4,
    activityId: null,
    visibility: 'public',
    createdAt: '2026-11-10T10:00:00Z',
  });
  assert.equal(legacyCard.includes('photo-grid'), false);
  assert.equal(legacyCard.includes('class="photo'), false);
  assert.match(legacyCard, /Legacy text still renders/);
});

test('activity detail and new-activity pages contain no cover photo placeholders or upload hints', async () => {
  const db = seedDb();

  // Activity detail page
  const detailApp = makeLiveApp(db, { page: 'activity', search: '?id=act-1' });
  detailApp.dom.document.body.setAttribute('data-page', 'activity');
  vm.runInContext(fs.readFileSync('js/pages/activity.js', 'utf8'), detailApp.ctx);
  await new Promise((r) => setTimeout(r, 25));

  assert.match(detailApp.dom.main.textContent, /Catan Night/);
  assert.equal(detailApp.dom.main.querySelector('.photo'), null);
  assert.equal(detailApp.dom.main.innerHTML.includes(iconInnerHtml(detailApp, 'camera', 'lg')), false);

  // New activity page
  const newApp = makeLiveApp(db, { page: 'activity-new' });
  newApp.dom.document.body.setAttribute('data-page', 'activity-new');
  vm.runInContext(fs.readFileSync('js/pages/activity-new.js', 'utf8'), newApp.ctx);
  await new Promise((r) => setTimeout(r, 25));

  assert.match(newApp.dom.main.textContent, /Items to bring & visibility/);
  assert.equal(/Cover photo/i.test(newApp.dom.main.innerHTML), false);
  assert.equal(/Photo upload comes in a later slice/i.test(newApp.dom.main.innerHTML), false);
  assert.equal(newApp.dom.main.querySelector('.photo'), null);
  assert.equal(newApp.dom.main.innerHTML.includes(iconInnerHtml(newApp, 'camera', 'lg')), false);
});

test('profile photo functionality remains intact in UI, Store, and Settings', async () => {
  const db = seedDb();
  const app = makeLiveApp(db, { page: 'settings', hash: '#profile' });
  app.dom.document.body.setAttribute('data-page', 'settings');
  vm.runInContext(fs.readFileSync('js/pages/settings.js', 'utf8'), app.ctx);
  await new Promise((r) => setTimeout(r, 25));

  const fileInp = app.dom.document.getElementById('avatar-input');
  const changeBtn = app.dom.document.getElementById('btn-change-photo');
  assert.ok(fileInp);
  assert.ok(changeBtn);
  assert.equal(changeBtn.innerHTML.includes(iconInnerHtml(app, 'camera', 'sm')), true);
  assert.equal(app.dom.document.getElementById('btn-remove-photo'), null);

  // Simulate uploading a valid profile photo
  const fakeFile = { name: 'me.png', type: 'image/png', size: 2048 };
  fileInp.files = [fakeFile];
  await fileInp.onchange();

  assert.equal(app.storageOps.some((o) => o.op === 'upload' && o.bucket === 'avatars' && o.filePath === 'user-a/avatar.jpg'), true);
  assert.match(app.Store.profile('user-a').avatarUrl, /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/avatars\/user-a\/avatar\.jpg\?v=\d+$/);
  assert.match(db.profiles.find((p) => p.id === 'user-a').avatar_url, /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/avatars\/user-a\/avatar\.jpg/);

  // UI.avatar renders <img> with avatar-img class and Remove photo button now appears
  const avatarHtml = app.UI.avatar('user-a', 'lg');
  assert.match(avatarHtml, /<img class="avatar-img" src="https:\/\/test\.supabase\.co\//);
  const removeBtn = app.dom.document.getElementById('btn-remove-photo');
  assert.ok(removeBtn);

  // Simulate removing the profile photo
  await removeBtn.onclick();
  assert.equal(app.storageOps.some((o) => o.op === 'remove' && o.bucket === 'avatars' && o.paths[0] === 'user-a/avatar.jpg'), true);
  assert.equal(app.Store.profile('user-a').avatarUrl, null);
  assert.equal(db.profiles.find((p) => p.id === 'user-a').avatar_url, null);
  assert.equal(app.dom.document.getElementById('btn-remove-photo'), null);
});

test('HTML pages cache-bust all modified JS scripts', () => {
  const editedScripts = [
    'js/store.js',
    'js/ui.js',
    'js/pages/social.js',
    'js/pages/home.js',
    'js/pages/profile.js',
    'js/pages/activity.js',
    'js/pages/activity-new.js',
  ];
  const htmlFiles = fs.readdirSync('.').filter((f) => f.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    for (const script of editedScripts) {
      if (html.includes(`src="${script}`)) {
        assert.equal(
          html.includes(`src="${script}?v=no-post-photos-1"`),
          true,
          `${htmlFile} should load ${script}?v=no-post-photos-1`
        );
      }
    }
  }
});
