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
      const idMatch = rest.match(/^#([A-Za-z0-9_-]+)/);
      if (idMatch) return el.id === idMatch[1];
      const tagMatch = rest.match(/^([A-Za-z][A-Za-z0-9]*)/);
      if (tagMatch) {
        if (el.tagName !== tagMatch[1].toUpperCase()) return false;
        rest = rest.slice(tagMatch[1].length);
      }
      const clsMatches = [...rest.matchAll(/\.([A-Za-z0-9_-]+)/g)];
      for (const cm of clsMatches) {
        if (!el.classList.contains(cm[1])) return false;
      }
      rest = rest.replace(/\.[A-Za-z0-9_-]+/g, '');
      const attrMatches = [...rest.matchAll(/\[([^=\]]+)(?:=["']?([^"\]]+)["']?)?\]/g)];
      for (const am of attrMatches) {
        const val = el.getAttribute(am[1]);
        if (am[2] !== undefined) {
          if (val !== am[2]) return false;
        } else if (val === null) {
          return false;
        }
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
    get value() { return this._value; }
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
    setSelectionRange() {}
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
        node._text + node.children.map(ser).join('') +
        '</' + node.tagName.toLowerCase() + '>';
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
    createElement: (tag) => new FakeElement(tag),
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

function makeLiveMessagingApp(db, opts = {}) {
  const memory = new Map();
  const ctx = vm.createContext({
    console,
    Date,
    crypto: webcrypto,
    location: { origin: 'http://test', pathname: '/home.html' },
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
          return String(v).split(',').some((clause) => {
            const m = clause.match(/^(\w+)\.eq\.(.+)$/);
            return m ? row[m[1]] === m[2] : false;
          });
        }
        return true;
      })
    );

  const hydrateConversations = (rows) =>
    rows
      .filter((c) => (db.conversation_members || []).some((m) => m.conversation_id === c.id && m.profile_id === uid))
      .map((c) => ({
        ...c,
        members: (db.conversation_members || [])
          .filter((m) => m.conversation_id === c.id)
          .map((m) => {
            const prof = (db.profiles || []).find((p) => p.id === m.profile_id) || null;
            return {
              ...m,
              profile: prof ? { id: prof.id, first_name: prof.first_name, bio: prof.bio, avatar_url: prof.avatar_url, created_at: prof.created_at } : null,
            };
          }),
        messages: (db.messages || []).filter((m) => m.conversation_id === c.id),
      }));

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

  const areFriendsInDb = (a, b) =>
    (db.friendships || []).some(
      (f) => f.status === 'accepted' && ((f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a))
    );

  const isBlockedInDb = (a, b) =>
    (db.user_blocks || []).some(
      (ub) => (ub.blocker_id === a && ub.blocked_id === b) || (ub.blocker_id === b && ub.blocked_id === a)
    );

  const hydrateBlocks = (rows) =>
    rows.map((r) => {
      const blk = (db.profiles || []).find((p) => p.id === r.blocker_id) || null;
      const bkd = (db.profiles || []).find((p) => p.id === r.blocked_id) || null;
      return {
        ...r,
        blocker: blk ? { id: blk.id, first_name: blk.first_name, bio: blk.bio, avatar_url: blk.avatar_url, created_at: blk.created_at } : null,
        blocked: bkd ? { id: bkd.id, first_name: bkd.first_name, bio: bkd.bio, avatar_url: bkd.avatar_url, created_at: bkd.created_at } : null,
      };
    });

  const promoteOnFriendship = (a, b) => {
    for (const c of db.conversations || []) {
      if (c.kind !== 'direct') continue;
      const ms = (db.conversation_members || []).filter((m) => m.conversation_id === c.id);
      if (ms.some((m) => m.profile_id === a) && ms.some((m) => m.profile_id === b)) {
        ms.forEach((m) => { if (m.status === 'requested' || m.status === 'declined') m.status = 'active'; });
      }
    }
  };

  const builder = (table) => {
    const filters = [];
    let inserted = null;
    let updated = null;
    let deleting = false;
    let wantSingle = false;
    let wantMaybeSingle = false;

    const execute = () => {
      if (inserted) {
        if (table === 'user_blocks') {
          db.user_blocks = db.user_blocks || [];
          const dup = db.user_blocks.find((r) => r.blocker_id === inserted.blocker_id && r.blocked_id === inserted.blocked_id);
          if (dup) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
          const row = { created_at: new Date().toISOString(), ...inserted };
          db.user_blocks.push(row);
          return { data: wantSingle || wantMaybeSingle ? row : [row], error: null };
        }
        db[table] = db[table] || [];
        db[table].push(inserted);
        return { data: wantSingle || wantMaybeSingle ? inserted : [inserted], error: null };
      }
      if (updated) {
        const matched = applyFilters(db[table] || [], filters);
        if (!matched.length) return { data: wantMaybeSingle ? null : [], error: null };
        matched.forEach((row) => Object.assign(row, updated));
        if (table === 'friendships' && updated.status === 'accepted') {
          matched.forEach((f) => promoteOnFriendship(f.requester_id, f.addressee_id));
        }
        return { data: wantSingle || wantMaybeSingle ? matched[0] : matched, error: null };
      }
      if (deleting) {
        const matched = new Set(applyFilters(db[table] || [], filters));
        db[table] = (db[table] || []).filter((r) => !matched.has(r));
        return { data: null, error: null };
      }
      let data = applyFilters(db[table] || [], filters);
      if (['habits', 'lesson_completions'].includes(table)) {
        data = data.filter((r) => r.profile_id === uid);
      }
      if (table === 'friendships') data = hydrateFriendships(data);
      if (table === 'conversations') data = hydrateConversations(data);
      if (table === 'user_blocks') data = hydrateBlocks(data);
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
      auth: { getSession: async () => ({ data: { session: { user: { id: uid } } } }) },
      from: builder,
      rpc: async (name, args) => {
        if (name === 'send_direct_message') {
          const recip = args.p_recipient_id;
          const body = String(args.p_body || '').trim();
          if (!body || body.length > 2000) return { data: null, error: { message: 'Invalid body' } };
          if (isBlockedInDb(uid, recip)) {
            return { data: null, error: { message: 'Messaging this person is currently unavailable.' } };
          }
          const friends = areFriendsInDb(uid, recip);
          let convo = (db.conversations || []).find((c) => {
            if (c.kind !== 'direct') return false;
            const ms = (db.conversation_members || []).filter((m) => m.conversation_id === c.id);
            return ms.length === 2 && ms.some((m) => m.profile_id === uid) && ms.some((m) => m.profile_id === recip);
          });
          const now = new Date().toISOString();
          if (!convo) {
            convo = { id: 'c-' + (db.conversations.length + 1), kind: 'direct', activity_id: args.p_activity_id || null, created_at: now, archived_at: null };
            db.conversations.push(convo);
            db.conversation_members.push(
              { conversation_id: convo.id, profile_id: uid, status: 'active', joined_at: now, last_read_at: now },
              { conversation_id: convo.id, profile_id: recip, status: friends ? 'active' : 'requested', joined_at: now, last_read_at: null }
            );
          } else {
            const myM = db.conversation_members.find((m) => m.conversation_id === convo.id && m.profile_id === uid);
            const otherM = db.conversation_members.find((m) => m.conversation_id === convo.id && m.profile_id === recip);
            if (friends) {
              myM.status = 'active';
              otherM.status = 'active';
            } else if (!(myM.status === 'active' && otherM.status === 'active')) {
              if (myM.status === 'requested') return { data: null, error: { message: 'Accept this message request before replying.' } };
              if (otherM.status === 'declined') return { data: null, error: { message: 'Follow-up messages are not available for this request.' } };
              if (otherM.status === 'requested') {
                const existingMsgs = db.messages.filter((m) => m.conversation_id === convo.id);
                if (existingMsgs.length === 1 && Date.now() - new Date(existingMsgs[0].created_at).getTime() < 7 * 864e5) {
                  return { data: null, error: { message: 'You can send 1 follow-up message after 7 days if they have not responded.' } };
                }
                if (existingMsgs.length >= 2) {
                  return { data: null, error: { message: 'You have already sent your follow-up message.' } };
                }
              }
            }
            myM.last_read_at = now;
          }
          const msg = { id: 'm-' + (db.messages.length + 1), conversation_id: convo.id, sender_id: uid, body, created_at: now };
          db.messages.push(msg);
          const members = db.conversation_members
            .filter((m) => m.conversation_id === convo.id)
            .map((m) => ({ id: m.profile_id, status: m.status, lastReadAt: m.last_read_at }));
          return {
            data: {
              ok: true,
              conversationId: convo.id,
              activityId: convo.activity_id,
              createdAt: convo.created_at,
              members,
              message: { id: msg.id, senderId: msg.sender_id, body: msg.body, at: msg.created_at },
            },
            error: null,
          };
        }
        if (name === 'respond_message_request') {
          const m = (db.conversation_members || []).find((x) => x.conversation_id === args.p_conversation_id && x.profile_id === uid);
          if (!m) return { data: null, error: { message: 'Message request not found.' } };
          const other = (db.conversation_members || []).find((x) => x.conversation_id === args.p_conversation_id && x.profile_id !== uid);
          if (other && isBlockedInDb(uid, other.profile_id)) {
            return { data: null, error: { message: 'Messaging this person is currently unavailable.' } };
          }
          m.status = args.p_accept ? 'active' : 'declined';
          m.last_read_at = new Date().toISOString();
          return { data: { ok: true, conversationId: args.p_conversation_id, status: m.status }, error: null };
        }
        return { data: null, error: { message: 'Unknown RPC ' + name } };
      },
    }),
  };

  vm.runInContext(fs.readFileSync('js/store.js', 'utf8'), ctx);
  return { Store: ctx.Store };
}

function seedMessagingDb() {
  return {
    profiles: [
      { id: 'user-a', auth_user_id: 'user-a', username: 'alice', first_name: 'Alice', bio: '', avatar_url: null, created_at: '2026-10-01T00:00:00Z' },
      { id: 'user-b', auth_user_id: 'user-b', username: 'bob', first_name: 'Bob', bio: '', avatar_url: null, created_at: '2026-10-02T00:00:00Z' },
      { id: 'user-c', auth_user_id: 'user-c', username: 'clara', first_name: 'Clara', bio: '', avatar_url: null, created_at: '2026-10-03T00:00:00Z' },
      { id: 'user-d', auth_user_id: 'user-d', username: 'dan', first_name: 'Dan', bio: '', avatar_url: null, created_at: '2026-10-04T00:00:00Z' },
    ],
    profile_private: [
      { profile_id: 'user-a', last_name: 'A', email: 'a@example.invalid', sex: 'female', age_confirmed_at: '2026-10-01T00:00:00Z' },
      { profile_id: 'user-b', last_name: 'B', email: 'b@example.invalid', sex: 'male', age_confirmed_at: '2026-10-01T00:00:00Z' },
      { profile_id: 'user-c', last_name: 'C', email: 'c@example.invalid', sex: 'female', age_confirmed_at: '2026-10-01T00:00:00Z' },
      { profile_id: 'user-d', last_name: 'D', email: 'd@example.invalid', sex: 'male', age_confirmed_at: '2026-10-01T00:00:00Z' },
    ],
    lessons: Array.from({ length: 6 }, (_, i) => ({ id: 101 + i, number: i + 1, curriculum_version: 2 })),
    lesson_completions: [],
    habits: [],
    habit_checkins: [],
    posts: [],
    interests: [],
    profile_interests: [],
    activities: [],
    friendships: [
      { id: 'f-ab', requester_id: 'user-a', addressee_id: 'user-b', status: 'accepted', met_at_activity_id: null, created_at: '2026-10-10T00:00:00Z', accepted_at: '2026-10-10T01:00:00Z' },
      { id: 'f-da', requester_id: 'user-d', addressee_id: 'user-a', status: 'pending', met_at_activity_id: null, created_at: '2026-11-01T00:00:00Z', accepted_at: null },
    ],
    conversations: [],
    conversation_members: [],
    messages: [],
    user_blocks: [],
  };
}

test('friends message directly without message requests and sync across accounts', async () => {
  const db = seedMessagingDb();
  const alice = makeLiveMessagingApp(db, { user: 'user-a' });
  await alice.Store.init();

  assert.equal(alice.Store.requestStatusFor('user-b').kind, 'friend_new');
  const sent = await alice.Store.sendDirectMessage({ recipientId: 'user-b', body: 'Hey Bob!' });
  assert.equal(sent.ok, true);
  assert.equal(alice.Store.conversations().length, 1);
  assert.equal(alice.Store.incomingMessageRequests().length, 0);
  assert.equal(alice.Store.isOutgoingPending(alice.Store.conversations()[0]), false);

  const bob = makeLiveMessagingApp(db, { user: 'user-b' });
  await bob.Store.init();
  assert.equal(bob.Store.incomingMessageRequests().length, 0);
  assert.equal(bob.Store.conversations().length, 1);
  assert.equal(bob.Store.unreadConversationsCount(), 1);
  assert.equal(bob.Store.unreadCount(), 1);
  assert.equal(bob.Store.conversations()[0].messages[0].body, 'Hey Bob!');

  const reply = await bob.Store.sendDirectMessage({ recipientId: 'user-a', body: 'Hey Alice!' });
  assert.equal(reply.ok, true);
  assert.equal(bob.Store.unreadCount(), 0);
});

test('non-friend message becomes a request, even from an activity, with 1-message + 7-day follow-up limit', async () => {
  const db = seedMessagingDb();
  const alice = makeLiveMessagingApp(db, { user: 'user-a' });
  await alice.Store.init();

  // Even with activityId set, non-friends go to message requests
  const first = await alice.Store.sendDirectMessage({
    recipientId: 'user-c',
    body: 'Hi Clara, saw your board game event!',
    activityId: 'act-123',
  });
  assert.equal(first.ok, true);
  const cId = first.conversationId;

  // Sender sees it in Conversations as outgoing pending, NOT in Message requests
  assert.equal(alice.Store.incomingMessageRequests().length, 0);
  assert.equal(alice.Store.isOutgoingPending(alice.Store.conversation(cId)), true);
  assert.equal(alice.Store.requestStatusFor('user-c').kind, 'request_waiting');
  assert.equal(alice.Store.requestStatusFor('user-c').canSend, false);

  // Trying to send a second message immediately fails
  const secondTooEarly = await alice.Store.sendDirectMessage({ recipientId: 'user-c', body: 'Hello??' });
  assert.equal(secondTooEarly.ok, false);
  assert.match(secondTooEarly.message, /7 days/i);

  // Recipient (Clara) sees it in Message requests and can read the message text before accepting
  const clara = makeLiveMessagingApp(db, { user: 'user-c' });
  await clara.Store.init();
  assert.equal(clara.Store.incomingMessageRequests().length, 1);
  assert.equal(clara.Store.unreadCount(), 1);
  assert.equal(clara.Store.incomingMessageRequests()[0].messages[0].body, 'Hi Clara, saw your board game event!');

  // Fast-forward 7 days on the first message in DB + Alice's state
  const eightDaysAgo = new Date(Date.now() - 8 * 864e5).toISOString();
  db.messages[0].created_at = eightDaysAgo;
  await alice.Store.loadConversations();
  assert.equal(alice.Store.requestStatusFor('user-c').kind, 'request_followup_ready');
  assert.equal(alice.Store.requestStatusFor('user-c').canSend, true);

  // Follow-up succeeds (2nd message)
  const followup = await alice.Store.sendDirectMessage({ recipientId: 'user-c', body: 'Sorry, meant to say Thursday night!' });
  assert.equal(followup.ok, true);
  assert.equal(alice.Store.requestStatusFor('user-c').kind, 'request_limit_reached');
  assert.equal(alice.Store.requestStatusFor('user-c').canSend, false);

  // 3rd message is rejected even after another week
  const third = await alice.Store.sendDirectMessage({ recipientId: 'user-c', body: 'One more ping' });
  assert.equal(third.ok, false);

  // Clara accepts the message request -> moves to Conversations without making them friends
  const acc = await clara.Store.respondRequest(cId, true);
  assert.equal(acc.ok, true);
  assert.equal(clara.Store.incomingMessageRequests().length, 0);
  assert.equal(clara.Store.conversations().length, 1);
  assert.equal(clara.Store.isFriend('user-a'), false);

  // Now both can chat freely
  const claraReply = await clara.Store.sendDirectMessage({ recipientId: 'user-a', body: 'All good, see you Thursday!' });
  assert.equal(claraReply.ok, true);
});

test('declining a message request hides it and disables Day-7 follow-up; becoming friends later promotes it', async () => {
  const db = seedMessagingDb();
  const alice = makeLiveMessagingApp(db, { user: 'user-a' });
  await alice.Store.init();

  const sent = await alice.Store.sendDirectMessage({ recipientId: 'user-d', body: 'Hey Dan!' });
  assert.equal(sent.ok, true);
  const cId = sent.conversationId;

  // Dan declines the message request
  const dan = makeLiveMessagingApp(db, { user: 'user-d' });
  await dan.Store.init();
  assert.equal(dan.Store.incomingMessageRequests().length, 1);
  const dec = await dan.Store.respondRequest(cId, false);
  assert.equal(dec.ok, true);
  assert.equal(dan.Store.conversations().length, 0);

  // Even after 8 days, Alice sees declined_by_other (no Day-7 countdown/retry)
  db.messages[0].created_at = new Date(Date.now() - 8 * 864e5).toISOString();
  await alice.Store.loadConversations();
  const st = alice.Store.requestStatusFor('user-d');
  assert.equal(st.kind, 'declined_by_other');
  assert.equal(st.canSend, false);
  assert.equal(st.retryAt, null);
  const blocked = await alice.Store.sendDirectMessage({ recipientId: 'user-d', body: 'Try again' });
  assert.equal(blocked.ok, false);

  // Now Alice accepts Dan's pending friend request -> chat promotes automatically to active!
  const accFriend = await alice.Store.acceptFriend('f-da');
  assert.equal(accFriend.ok, true);
  assert.equal(alice.Store.requestStatusFor('user-d').kind, 'active');
  assert.equal(alice.Store.requestStatusFor('user-d').canSend, true);

  await dan.Store.loadFriendships(true);
  await dan.Store.loadConversations();
  assert.equal(dan.Store.conversations().length, 1);
  assert.equal(dan.Store.requestStatusFor('user-a').kind, 'active');

  // Unfriending later keeps existing active conversation active
  const removed = await alice.Store.removeFriend('user-d');
  assert.equal(removed.ok, true);
  assert.equal(alice.Store.requestStatusFor('user-d').kind, 'active');
  assert.equal(alice.Store.requestStatusFor('user-d').canSend, true);
});

test('demo mode filters out group chats, removes messageRequestsFrom setting, and renders two tabs without group chat hint', () => {
  const memory = new Map();
  const ctx = vm.createContext({
    console,
    Date,
    crypto: webcrypto,
    location: { origin: 'http://test', pathname: '/home.html', search: '' },
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

  assert.equal('messageRequestsFrom' in Store.state.settings, false);
  const convos = Store.conversations();
  assert.equal(convos.some((c) => c.kind === 'activity_group'), false);
  assert.equal(convos.some((c) => Store.isRequestToMe(c)), true);

  const uiCode = fs.readFileSync('js/ui.js', 'utf8');
  new vm.Script(uiCode, { filename: 'js/ui.js' });
  assert.equal(/Group chats exist only/.test(uiCode), false);
  assert.equal(/6 months/.test(uiCode), false);
  assert.equal(/Message hidden until you accept/.test(uiCode), false);
  assert.equal(uiCode.includes('data-tab="conversations"'), true);
  assert.equal(uiCode.includes('data-tab="requests"'), true);

  const settingsCode = fs.readFileSync('js/pages/settings.js', 'utf8');
  new vm.Script(settingsCode, { filename: 'js/pages/settings.js' });
  assert.equal(/messageRequestsFrom/.test(settingsCode), false);
});

test('UI.Messages end-to-end: tabs, incoming request preview/accept/decline, friend send, and New chat search', async () => {
  const db = seedMessagingDb();
  const dom = makeMiniDom();

  // Clara sends a non-friend message request to Alice
  const claraCtx = makeLiveMessagingApp(db, { user: 'user-c' });
  await claraCtx.Store.init();
  const reqRes = await claraCtx.Store.sendDirectMessage({ recipientId: 'user-a', body: 'Hey Alice, want to play Codenames?' });
  assert.equal(reqRes.ok, true);

  const memory = new Map();
  const liveHelpers = makeLiveMessagingApp(db, { user: 'user-a' });
  const ctx2 = vm.createContext({
    console,
    Date,
    Math,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    crypto: webcrypto,
    location: { origin: 'http://test', pathname: '/home.html', search: '' },
    localStorage: {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: dom.document,
    MOMENTUM_CONFIG: {},
  });
  ctx2.window = ctx2;
  ctx2.addEventListener = () => {};
  ctx2.Store = liveHelpers.Store;
  vm.runInContext(fs.readFileSync('js/ui.js', 'utf8'), ctx2);

  await ctx2.UI.mount('home', () => {});
  const panel = dom.document.getElementById('msg-panel');
  assert.ok(panel);
  assert.equal(panel.hidden, true);

  // Header badge shows 1 incoming request
  const msgToggle = dom.document.getElementById('msg-toggle');
  assert.equal(msgToggle.querySelector('.badge').textContent, '1');

  // Open Messages panel via toggle
  msgToggle.click();
  assert.equal(panel.hidden, false);
  await new Promise((r) => setTimeout(r, 20));

  // Verify two tabs and no group chat hint
  const convTab = panel.querySelector('[data-tab="conversations"]');
  const reqTab = panel.querySelector('[data-tab="requests"]');
  assert.ok(convTab);
  assert.ok(reqTab);
  assert.match(reqTab.textContent, /Message requests1/);
  assert.equal(/group chat/i.test(panel.innerHTML), false);

  // Switch to Message requests tab and open Clara's incoming request BEFORE accepting
  reqTab.click();
  const openReqBtn = panel.querySelector('[data-open="' + reqRes.conversationId + '"]');
  assert.ok(openReqBtn);
  openReqBtn.click();

  // Recipient reads the incoming message BEFORE accepting
  assert.match(panel.textContent, /Hey Alice, want to play Codenames\?/);
  const acceptBtn = panel.querySelector('[data-accept]');
  const declineBtn = panel.querySelector('[data-decline]');
  assert.ok(acceptBtn);
  assert.ok(declineBtn);

  // Accept moves conversation into Conversations tab and reveals composer
  await acceptBtn.onclick();
  assert.ok(panel.querySelector('.composer input'));
  assert.equal(panel.querySelector('[data-accept]'), null);

  // Open New chat -> defaults to Friends (Bob), then search Clara
  panel.querySelector('[data-back]').click();
  assert.equal(panel.querySelector('[data-tab="conversations"]').classList.contains('active'), true);
  panel.querySelector('[data-new]').click();
  assert.match(panel.textContent, /Your friends/);
  assert.match(panel.textContent, /Bob/);

  // Test live search inside New chat for "Clar"
  const pq = panel.querySelector('[data-pq]');
  pq.focus();
  pq.value = 'Clar';
  pq.oninput();
  await new Promise((r) => setTimeout(r, 260));
  assert.match(panel.querySelector('#msg-new-results').textContent, /Clara/);

  // Go back to New chat friend list (clear search) and click Bob to send a message
  pq.value = '';
  pq.oninput();
  assert.match(panel.querySelector('#msg-new-results').textContent, /Bob/);
  panel.querySelector('[data-person="user-b"]').click();
  const friendForm = panel.querySelector('.composer');
  const friendInput = panel.querySelector('.composer input');
  assert.ok(friendForm);
  friendInput.value = 'Hey Bob!';
  await friendForm.onsubmit({ preventDefault() {} });
  assert.match(panel.textContent, /Hey Bob!/);
  assert.equal(panel.querySelector('.composer input').value, '');

  // Open draft chat with Dan (non-friend) via openChat -> sends 1st message request and shows 7-day wait banner
  ctx2.UI.Messages.openChat('user-d');
  assert.match(panel.textContent, /appear as a message request/i);
  const reqForm = panel.querySelector('.composer');
  panel.querySelector('.composer input').value = 'Hi Dan, nice meeting you!';
  await reqForm.onsubmit({ preventDefault() {} });
  assert.equal(panel.querySelector('.composer'), null);
  assert.match(panel.querySelector('.msg-locked').textContent, /1 follow-up on/i);
});

test('blocking locks messaging both ways without notifying blocked user, preserves state on unblock, and enforces server-side', async () => {
  const db = seedMessagingDb();
  const alice = makeLiveMessagingApp(db, { user: 'user-a' });
  const bob = makeLiveMessagingApp(db, { user: 'user-b' });
  const clara = makeLiveMessagingApp(db, { user: 'user-c' });
  await Promise.all([alice.Store.init(), bob.Store.init(), clara.Store.init()]);

  // Alice and Bob (friends) exchange a message; Clara sends Alice a message request.
  await alice.Store.sendDirectMessage({ recipientId: 'user-b', body: 'Hey Bob!' });
  await clara.Store.sendDirectMessage({ recipientId: 'user-a', body: 'Hi Alice!' });

  await alice.Store.loadConversations();
  await bob.Store.loadConversations();
  assert.equal(alice.Store.conversations().length, 2);
  assert.equal(alice.Store.incomingMessageRequests().length, 1);
  assert.equal(bob.Store.unreadCount(), 1);

  // Alice blocks Bob (friend) -> hidden from Alice's inbox; friendship stays intact unless unfriended
  const blkBob = await alice.Store.blockUser('user-b');
  assert.equal(blkBob.ok, true);
  assert.equal(alice.Store.hasBlocked('user-b'), true);
  assert.equal(alice.Store.isFriend('user-b'), true);
  assert.equal(alice.Store.requestStatusFor('user-b').kind, 'blocked_by_me');
  assert.equal(alice.Store.requestStatusFor('user-b').canSend, false);
  assert.equal(alice.Store.conversations().some((c) => alice.Store.otherMember(c) === 'user-b'), false);

  // Bob refreshes (or tries sending directly): no unread badge notification, chat stays in Conversations, locked as blocked_by_other
  await bob.Store.loadBlocks();
  assert.equal(bob.Store.isBlockedBy('user-a'), true);
  assert.equal(bob.Store.unreadCount(), 0);
  assert.equal(bob.Store.conversations().length, 1);
  assert.equal(bob.Store.requestStatusFor('user-a').kind, 'blocked_by_other');
  assert.equal(bob.Store.requestStatusFor('user-a').canSend, false);
  const bobBlockedSend = await bob.Store.sendDirectMessage({ recipientId: 'user-a', body: 'Hello?' });
  assert.equal(bobBlockedSend.ok, false);
  assert.equal(bobBlockedSend.message, 'Messaging this person is currently unavailable.');

  // Alice blocks Clara (incoming message request) -> hidden from Message requests and unread count drops to 0
  const blkClara = await alice.Store.blockUser('user-c');
  assert.equal(blkClara.ok, true);
  assert.equal(alice.Store.incomingMessageRequests().length, 0);
  assert.equal(alice.Store.unreadCount(), 0);

  // Clara sees the thread in Conversations as blocked_by_other and cannot send
  await clara.Store.loadBlocks();
  assert.equal(clara.Store.conversations().length, 1);
  assert.equal(clara.Store.requestStatusFor('user-a').kind, 'blocked_by_other');

  // Unblocking Clara restores the exact prior state (pending incoming request returns to Message requests)
  const unblkClara = await alice.Store.unblockUser('user-c');
  assert.equal(unblkClara.ok, true);
  assert.equal(alice.Store.incomingMessageRequests().length, 1);
  assert.equal(alice.Store.requestStatusFor('user-c').kind, 'incoming_request');

  // Mutual blocking: Bob blocks Alice, Alice unblocks Bob -> Alice transitions to blocked_by_other
  await bob.Store.blockUser('user-a');
  await alice.Store.loadBlocks();
  assert.equal(alice.Store.requestStatusFor('user-b').kind, 'blocked_by_me');
  await alice.Store.unblockUser('user-b');
  assert.equal(alice.Store.requestStatusFor('user-b').kind, 'blocked_by_other');
});

test('UI blocking flow: confirmation + optional unfriend modal for friends, locked bar for blocked user, and unblock across Settings/Profile', async () => {
  const db = seedMessagingDb();

  // Clara sends a non-friend message request to Alice; Alice and Bob are friends with an existing chat
  const bobInit = makeLiveMessagingApp(db, { user: 'user-b' });
  const claraInit = makeLiveMessagingApp(db, { user: 'user-c' });
  await Promise.all([bobInit.Store.init(), claraInit.Store.init()]);
  await bobInit.Store.sendDirectMessage({ recipientId: 'user-a', body: 'See you Saturday!' });
  await claraInit.Store.sendDirectMessage({ recipientId: 'user-a', body: 'Hey Alice, quick question' });

  function mountUiFor(userId, { page = 'home', search = '' } = {}) {
    const dom = makeMiniDom();
    const memory = new Map();
    const helpers = makeLiveMessagingApp(db, { user: userId });
    const ctx = vm.createContext({
      console,
      Date,
      Math,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      crypto: webcrypto,
      location: { origin: 'http://test', pathname: '/' + page + '.html', search, hash: '' },
      localStorage: {
        getItem: (k) => memory.get(k) || null,
        setItem: (k, v) => memory.set(k, v),
        removeItem: (k) => memory.delete(k),
      },
      sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      document: dom.document,
      MOMENTUM_CONFIG: {},
    });
    ctx.window = ctx;
    ctx.addEventListener = () => {};
    ctx.Store = helpers.Store;
    vm.runInContext(fs.readFileSync('js/ui.js', 'utf8'), ctx);
    return { ctx, dom, Store: helpers.Store };
  }

  // 1. Alice opens Messages: Bob (friend) chat has header Block icon; Clara (incoming request) has Block button
  const aliceUi = mountUiFor('user-a');
  await aliceUi.ctx.UI.mount('home', () => {});
  aliceUi.dom.document.getElementById('msg-toggle').click();
  await new Promise((r) => setTimeout(r, 20));

  const panel = aliceUi.dom.document.getElementById('msg-panel');
  const bobConvo = aliceUi.Store.findDirect('user-b');
  panel.querySelector('[data-open="' + bobConvo.id + '"]').click();

  const headerBlockBtn = panel.querySelector('.msg-head [data-block]');
  assert.ok(headerBlockBtn);
  headerBlockBtn.click();

  // First modal: confirm block
  const modal1 = aliceUi.dom.body.querySelector('.modal');
  assert.match(modal1.textContent, /Block Bob\?/);
  await modal1.querySelector('#do-block').onclick();

  // Second modal appears for friends: tells user they can no longer message you + option to unfriend
  const modal2 = aliceUi.dom.body.querySelector('.modal');
  assert.ok(modal2);
  assert.match(modal2.textContent, /can no longer message you/i);
  assert.ok(modal2.querySelector('#do-block-unfriend'));
  await modal2.querySelector('#do-block-unfriend').onclick();
  assert.equal(aliceUi.Store.isFriend('user-b'), false);
  assert.equal(aliceUi.Store.hasBlocked('user-b'), true);

  // Switch to Message requests tab and block Clara (non-friend) via the incoming request Block button -> no follow-up modal
  panel.querySelector('[data-tab="requests"]').click();
  const claraConvo = aliceUi.Store.findDirect('user-c');
  panel.querySelector('[data-open="' + claraConvo.id + '"]').click();
  const reqBlockBtn = panel.querySelector('.msg-request-actions [data-block]');
  assert.ok(reqBlockBtn);
  reqBlockBtn.click();
  const modalClara = aliceUi.dom.body.querySelector('.modal');
  assert.match(modalClara.textContent, /Block Clara\?/);
  await modalClara.querySelector('#do-block').onclick();
  assert.equal(aliceUi.dom.body.querySelector('.modal'), null);
  assert.equal(aliceUi.Store.hasBlocked('user-c'), true);
  assert.equal(aliceUi.dom.document.getElementById('msg-toggle').querySelector('.badge'), null);

  // 2. Bob (blocked user) opens his conversation with Alice: old message visible, no text input, .msg-locked message shown
  const bobUi = mountUiFor('user-b');
  await bobUi.ctx.UI.mount('home', () => {});
  assert.equal(bobUi.dom.document.getElementById('msg-toggle').querySelector('.badge'), null);
  bobUi.dom.document.getElementById('msg-toggle').click();
  await new Promise((r) => setTimeout(r, 20));
  const bobPanel = bobUi.dom.document.getElementById('msg-panel');
  bobPanel.querySelector('[data-open="' + bobConvo.id + '"]').click();
  assert.match(bobPanel.textContent, /See you Saturday!/);
  assert.equal(bobPanel.querySelector('.composer'), null);
  assert.equal(bobPanel.querySelector('.msg-locked').textContent, 'Messaging this person is currently unavailable.');

  // 3. Alice can reopen Bob via New chat (shows past message + Unblock button) and confirm unblock
  panel.querySelector('[data-new]').click();
  const pq = panel.querySelector('[data-pq]');
  pq.value = 'Bob';
  pq.oninput();
  await new Promise((r) => setTimeout(r, 260));
  assert.match(panel.querySelector('#msg-new-results').textContent, /Blocked/);
  panel.querySelector('[data-person="user-b"]').click();
  assert.match(panel.textContent, /See you Saturday!/);
  assert.match(panel.querySelector('.msg-locked').textContent, /You blocked Bob/);
  panel.querySelector('[data-unblock]').click();
  const unbModal = aliceUi.dom.body.querySelector('.modal');
  assert.match(unbModal.textContent, /Unblock Bob\?/);
  await unbModal.querySelector('#do-unblock').onclick();
  assert.equal(aliceUi.Store.hasBlocked('user-b'), false);
  assert.ok(panel.querySelector('.composer input'));

  // 4. Settings page lists remaining blocked user (Clara) with Unblock + confirmation modal
  const settingsUi = mountUiFor('user-a', { page: 'settings' });
  vm.runInContext(fs.readFileSync('js/pages/settings.js', 'utf8'), settingsUi.ctx);
  await new Promise((r) => setTimeout(r, 20));
  const blockedSection = settingsUi.dom.document.getElementById('blocked-users-section');
  assert.ok(blockedSection);
  assert.match(blockedSection.textContent, /Clara/);
  const settingsUnblock = blockedSection.querySelector('[data-unblock="user-c"]');
  assert.ok(settingsUnblock);
  settingsUnblock.click();
  const settingsModal = settingsUi.dom.body.querySelector('.modal');
  assert.match(settingsModal.textContent, /Unblock Clara\?/);
  await settingsModal.querySelector('#do-unblock').onclick();
  assert.equal(settingsUi.Store.hasBlocked('user-c'), false);
  assert.match(settingsUi.dom.document.getElementById('blocked-users-section').textContent, /haven't blocked anyone/i);

  // 5. Profile page shows Unblock (no Message button and no Block button) when blocked
  await aliceUi.Store.blockUser('user-c');
  const profileUi = mountUiFor('user-a', { page: 'profile', search: '?id=user-c' });
  profileUi.ctx.Social = { subnav: () => '', postCard: () => '', activityCard: () => '', bind: () => {} };
  vm.runInContext(fs.readFileSync('js/pages/profile.js', 'utf8'), profileUi.ctx);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(profileUi.dom.document.getElementById('msg'), null);
  assert.equal(profileUi.dom.document.querySelector('[data-block]'), null);
  const profUnblock = profileUi.dom.document.getElementById('unblock-user');
  assert.ok(profUnblock);
  profUnblock.click();
  const profModal = profileUi.dom.body.querySelector('.modal');
  assert.match(profModal.textContent, /Unblock Clara\?/);
  await profModal.querySelector('#do-unblock').onclick();
  assert.equal(profileUi.Store.hasBlocked('user-c'), false);
  assert.ok(profileUi.dom.document.getElementById('msg'));

  // 6. Blocking does not remove pending friend requests, and a blocked user opening a brand-new draft sees "No messages yet." + locked bar
  await aliceUi.Store.blockUser('user-d');
  assert.equal(aliceUi.Store.incomingRequests().some((f) => f.requesterId === 'user-d'), true);
  const danUi = mountUiFor('user-d');
  await danUi.ctx.UI.mount('home', () => {});
  danUi.ctx.UI.Messages.openChat('user-a');
  await new Promise((r) => setTimeout(r, 20));
  const danPanel = danUi.dom.document.getElementById('msg-panel');
  assert.equal(danPanel.querySelector('.composer'), null);
  assert.equal(danPanel.querySelector('.msg-locked').textContent, 'Messaging this person is currently unavailable.');
  assert.match(danPanel.textContent, /No messages yet\./);
  assert.doesNotMatch(danPanel.textContent, /Say hi to/);

  // 7. Blocking a friend then clicking "Keep as friend" preserves the friendship while locking messaging
  db.friendships.push({ id: 'f-ab-keep', requester_id: 'user-a', addressee_id: 'user-b', status: 'accepted', met_at_activity_id: null, created_at: '2026-11-02T00:00:00Z', accepted_at: '2026-11-02T01:00:00Z' });
  const keepUi = mountUiFor('user-a');
  await keepUi.ctx.UI.mount('home', () => {});
  keepUi.ctx.UI.Messages.openChat('user-b');
  await new Promise((r) => setTimeout(r, 20));
  const keepPanel = keepUi.dom.document.getElementById('msg-panel');
  keepPanel.querySelector('.msg-head [data-block]').click();
  await keepUi.dom.body.querySelector('#do-block').onclick();
  const keepModal = keepUi.dom.body.querySelector('.modal');
  assert.match(keepModal.textContent, /Keep as friend/);
  const keepBtns = keepModal.querySelectorAll('[data-close]');
  keepBtns[keepBtns.length - 1].click();
  assert.equal(keepUi.dom.body.querySelector('.modal'), null);
  assert.equal(keepUi.Store.isFriend('user-b'), true);
  assert.equal(keepUi.Store.hasBlocked('user-b'), true);
  assert.equal(keepUi.Store.requestStatusFor('user-b').kind, 'blocked_by_me');

  // Verify blocked profile shows Blocked + Unblock AND Remove friend when still friends
  const friendBlockedProfile = mountUiFor('user-a', { page: 'profile', search: '?id=user-b' });
  friendBlockedProfile.ctx.Social = { subnav: () => '', postCard: () => '', activityCard: () => '', bind: () => {} };
  vm.runInContext(fs.readFileSync('js/pages/profile.js', 'utf8'), friendBlockedProfile.ctx);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(friendBlockedProfile.dom.document.getElementById('msg'), null);
  assert.ok(friendBlockedProfile.dom.document.getElementById('unblock-user'));
  assert.ok(friendBlockedProfile.dom.document.getElementById('remove-friend'));
});
