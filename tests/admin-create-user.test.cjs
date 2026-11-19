// Admin › Accounts › "Add user" Edge Function (supabase/functions/admin-create-user/handler.mjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const good = { firstName: 'Cosmo', lastName: 'Cougar', email: 'Cosmo@BYU.edu', sex: 'male', password: 'Cougar_tail1', ageConfirmed: true };

async function setup(options = {}) {
  const { createHandler } = await import('../supabase/functions/admin-create-user/handler.mjs');
  const calls = [];
  const vars = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ...options.env };
  const handler = createHandler({ env: key => vars[key], fetcher: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/rest/v1/rpc/is_admin')) return json(options.isAdmin ?? true, options.adminStatus || 200);
    if (url.endsWith('/auth/v1/admin/users')) return json(options.created || { id: 'new-user-id' }, options.createStatus || 200);
    throw new Error('unexpected ' + url);
  } });
  const request = (body = good, headers = {}, method = 'POST') => handler(new Request('https://example/functions/v1/admin-create-user', {
    method, headers: { Authorization: 'Bearer user-token', Origin: 'https://hypotenuse-squad-group-5.github.io', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  }));
  return { request, calls };
}

test('an admin creates a confirmed account with the service key; the profile details ride along', async () => {
  const { request, calls } = await setup();
  const res = await request();
  assert.equal(res.status, 201);
  assert.equal((await res.json()).userId, 'new-user-id');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://hypotenuse-squad-group-5.github.io');
  const [adminCheck, create] = calls;
  assert.equal(adminCheck.init.headers.Authorization, 'Bearer user-token');   // asked as the caller
  assert.equal(create.init.headers.Authorization, 'Bearer service');          // created with the service key
  const sent = JSON.parse(create.init.body);
  assert.equal(sent.email, 'cosmo@byu.edu');
  assert.equal(sent.email_confirm, true);
  assert.deepEqual(sent.user_metadata, { first_name: 'Cosmo', last_name: 'Cougar', sex: 'male', age_confirmed: true });
});

test('non-admins and signed-out callers are refused before anything is created', async () => {
  let s = await setup({ isAdmin: false });
  let res = await s.request();
  assert.equal(res.status, 403);
  assert.equal((await res.json()).message, 'Admins only.');
  assert.equal(s.calls.length, 1);
  s = await setup();
  res = await s.request(good, { Authorization: '' });
  assert.equal(res.status, 401);
  assert.equal(s.calls.length, 0);
  s = await setup({ adminStatus: 401 });
  assert.equal((await s.request()).status, 401);
});

test('other websites are refused; the browser pre-check is answered', async () => {
  let s = await setup();
  assert.equal((await s.request(good, { Origin: 'https://evil.example' })).status, 403);
  const pre = await s.request(undefined, {}, 'OPTIONS');
  assert.equal(pre.status, 204);
  assert.equal(s.calls.length, 0);
});

test('the form is checked field by field, password rules included', async () => {
  const { request, calls } = await setup();
  const res = await request({ firstName: '', lastName: 'C', email: 'nope', sex: 'x', password: 'short', ageConfirmed: false });
  assert.equal(res.status, 400);
  const { fields } = await res.json();
  assert.deepEqual(Object.keys(fields).sort(), ['ageConfirmed', 'email', 'firstName', 'password', 'sex']);
  assert.match(fields.password, /8 characters.*uppercase letter.*number.*symbol/);
  assert.equal(calls.filter(c => c.url.includes('/admin/users')).length, 0);
});

test('a taken email comes back on the email field', async () => {
  const { request } = await setup({ createStatus: 422, created: { error_code: 'email_exists', msg: 'A user with this email address has already been registered' } });
  const res = await request();
  assert.equal(res.status, 409);
  assert.equal((await res.json()).fields.email, 'An account with that email already exists.');
});

test('missing server settings give a clear message', async () => {
  const { request } = await setup({ env: { SUPABASE_SERVICE_ROLE_KEY: '' } });
  const res = await request();
  assert.equal(res.status, 503);
});
