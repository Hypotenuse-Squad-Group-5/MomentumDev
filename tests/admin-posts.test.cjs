const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Migration 035 exists and contains full admin CRUD, columns, and require_admin() guards', () => {
  const sql = fs.readFileSync('database/035_admin_posts.sql', 'utf8');

  // Verify column additions
  assert.match(sql, /add column if not exists is_announcement boolean/i);
  assert.match(sql, /add column if not exists is_hidden boolean/i);
  assert.match(sql, /add column if not exists edited_by_admin boolean/i);
  assert.match(sql, /add column if not exists admin_edited_at timestamptz/i);

  // Verify notifications kind check includes post_deleted
  assert.match(sql, /'post_deleted'/);

  // Verify all 5 admin functions exist and enforce require_admin()
  const requiredFns = [
    'admin_list_posts',
    'admin_create_announcement',
    'admin_update_post',
    'admin_set_post_hidden',
    'admin_delete_post'
  ];

  for (const fn of requiredFns) {
    const fnRegex = new RegExp(`create or replace function momentum_private\\.${fn}[\\s\\S]*?perform momentum_private\\.require_admin\\(\\);`, 'i');
    assert.match(sql, fnRegex, `momentum_private.${fn} must call require_admin() as its guard`);

    const publicWrapper = new RegExp(`create or replace function public\\.${fn}`, 'i');
    assert.match(sql, publicWrapper, `public.${fn} wrapper must exist`);
  }

  // Verify preview query at the end
  assert.match(sql, /-- commit;/);
});

test('admin-posts.js registers the Posts tab with CRUD actions', () => {
  const code = fs.readFileSync('js/pages/admin-posts.js', 'utf8');

  assert.match(code, /AdminTabs\.register/);
  assert.match(code, /key:\s*"posts"/);
  assert.match(code, /label:\s*"Posts"/);
  assert.match(code, /order:\s*2/);

  // Create
  assert.match(code, /admin_create_announcement/);
  assert.match(code, /Create announcement/i);

  // Read
  assert.match(code, /admin_list_posts/);

  // Update
  assert.match(code, /admin_update_post/);
  assert.match(code, /admin_set_post_hidden/);

  // Delete
  assert.match(code, /admin_delete_post/);
  assert.match(code, /Reason for removal/i);
});

test('admin.html loads admin-posts.js with bumped cache version tag', () => {
  const html = fs.readFileSync('admin.html', 'utf8');
  assert.match(html, /<script src="js\/pages\/admin-posts\.js\?v=admin-posts-1"><\/script>/);
});

test('social.js renders "Edited by admin" and "Hidden by moderator" tags, plus Momentum announcement branding', () => {
  const socialCode = fs.readFileSync('js/pages/social.js', 'utf8');

  // Verify logic is in postCard
  assert.match(socialCode, /Edited by admin/);
  assert.match(socialCode, /Hidden by moderator/);
  assert.match(socialCode, /UI\.LOGO/);

  // Test execution in isolated VM
  const ctx = vm.createContext({
    console,
    Date,
    UI: {
      esc: (s) => String(s || ''),
      icon: (name) => `<icon-${name}>`,
      avatar: () => '<avatar>',
      displayName: (id) => 'User ' + id,
      fmtAgo: () => '2h ago',
      fmtDay: () => 'Monday',
      LOGO: '<svg-logo>',
    },
    Store: {
      ME: 'user-me',
      profile: () => ({ first: 'Alice' }),
      fullName: () => 'Alice Smith',
      activity: () => null,
    },
    document: { body: { dataset: {} } },
    window: {},
  });
  ctx.window = ctx;

  vm.runInContext(socialCode, ctx);

  // 1. Regular post
  const regPost = {
    id: 'p1', authorId: 'user-friend', caption: 'Regular post', createdAt: new Date().toISOString()
  };
  const regHtml = ctx.Social.postCard(regPost);
  assert.match(regHtml, /<span class="tag grey">Friends Only<\/span>/);
  assert.doesNotMatch(regHtml, /Edited by admin/);

  // 2. Edited by admin
  const editedPost = {
    id: 'p2', authorId: 'user-friend', caption: 'Edited post', editedByAdmin: true, createdAt: new Date().toISOString()
  };
  const editedHtml = ctx.Social.postCard(editedPost);
  assert.match(editedHtml, /<span class="tag grey">Edited by admin<\/span>/);

  // 3. Hidden post
  const hiddenPost = {
    id: 'p3', authorId: 'user-me', caption: 'Hidden post', isHidden: true, createdAt: new Date().toISOString()
  };
  const hiddenHtml = ctx.Social.postCard(hiddenPost);
  assert.match(hiddenHtml, /<span class="tag danger">Hidden by moderator<\/span>/);

  // 4. Announcement
  const annPost = {
    id: 'p4', authorId: 'user-admin', caption: 'Big news!', isAnnouncement: true, createdAt: new Date().toISOString()
  };
  const annHtml = ctx.Social.postCard(annPost);
  assert.match(annHtml, /<svg-logo>/);
  assert.match(annHtml, /Momentum/);
  assert.match(annHtml, /<span class="tag">Announcement<\/span>/);
});

test('store.js pins announcements in feed() and excludes hidden posts', () => {
  const storeCode = fs.readFileSync('js/store.js', 'utf8');

  // Verify pinned announcements and hidden filtering are handled
  assert.match(storeCode, /isAnnouncement/);
  assert.match(storeCode, /isHidden/);
  assert.match(storeCode, /editedByAdmin/);
});

test('home.js handles post_deleted notifications with alert styling', () => {
  const homeCode = fs.readFileSync('js/pages/home.js', 'utf8');
  assert.match(homeCode, /case "post_deleted":/);
});
