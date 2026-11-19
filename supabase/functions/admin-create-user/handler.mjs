// Admin › Accounts › "Add user" (migration 034, docs/admin-guide.md).
// Creating a login needs the Supabase service key, which must never reach the website, so it happens here.
// Dependency-free (like suggest-habits) so tests/admin-create-user.test.cjs can run it with Node.
//
// Flow: check the caller is signed in AND an admin (the same is_admin() the database uses),
// validate the form, then create the login with the service key. The sign-up trigger
// (momentum_handle_new_user) makes the profile, exactly like a normal sign-up.
const PASSWORD_RULES = [
  [v => v.length >= 8, 'at least 8 characters'],
  [v => /[a-z]/.test(v), 'a lowercase letter'],
  [v => /[A-Z]/.test(v), 'an uppercase letter'],
  [v => /[0-9]/.test(v), 'a number'],
  [v => /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(v), 'a symbol'],
];
const SEXES = ['male', 'female', 'prefer_not_to_say'];

export function createHandler({ env, fetcher = fetch }) {
  const allowed = (env('ALLOWED_ORIGINS') || 'https://hypotenuse-squad-group-5.github.io,http://localhost:8765,http://127.0.0.1:8765').split(',').map(s => s.trim());

  return async function handle(req) {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, message, extra = {}) => new Response(JSON.stringify({ message, ...extra }), { status, headers });
    if (origin && !allowed.includes(origin)) return reply(403, 'This website cannot add users.');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply(405, 'Use POST.');
    const authorization = req.headers.get('authorization') || '';
    if (!/^Bearer \S+$/.test(authorization)) return reply(401, 'Sign in first.');
    const url = env('SUPABASE_URL'), anon = env('SUPABASE_ANON_KEY'), service = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return reply(503, 'Adding users isn\'t set up yet.');

    try {
      // 1. Only admins: ask the database, as the caller
      const check = await fetcher(`${url}/rest/v1/rpc/is_admin`, {
        method: 'POST', headers: { apikey: anon, Authorization: authorization, 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(5000),
      });
      if (!check.ok) return reply(check.status >= 500 ? 503 : 401, 'Please sign in again.');
      if ((await check.json()) !== true) return reply(403, 'Admins only.');

      // 2. Read and check the form (small body only)
      const text = await req.text();
      if (text.length > 4096) return reply(413, 'That request is too large.');
      let body;
      try { body = JSON.parse(text); } catch { return reply(400, 'Invalid request.'); }
      const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
      const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const fields = {};
      if (firstName.length < 1 || firstName.length > 40) fields.firstName = 'First name is 1 to 40 characters.';
      if (lastName.length < 1 || lastName.length > 60) fields.lastName = 'Last name is 1 to 60 characters.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fields.email = 'Enter a valid email.';
      if (!SEXES.includes(body?.sex)) fields.sex = 'Choose one.';
      const missing = PASSWORD_RULES.filter(([ok]) => !ok(password)).map(([, label]) => label);
      if (missing.length) fields.password = 'Password needs ' + missing.join(', ') + '.';
      if (body?.ageConfirmed !== true) fields.ageConfirmed = 'Confirm they\'re 18 or older.';
      if (Object.keys(fields).length) return reply(400, 'Fix the highlighted fields.', { fields });

      // 3. Create the login with the service key (already confirmed, so they can sign in right away)
      const created = await fetcher(`${url}/auth/v1/admin/users`, {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName, sex: body.sex, age_confirmed: true } }),
      });
      const result = await created.json().catch(() => ({}));
      if (!created.ok) {
        const code = result.error_code || result.code || '';
        const message = String(result.msg || result.message || result.error_description || '');
        if (code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) {
          return reply(409, 'An account with that email already exists.', { fields: { email: 'An account with that email already exists.' } });
        }
        if (code === 'weak_password' || /password/i.test(message)) {
          return reply(400, message || 'That password is too weak.', { fields: { password: message || 'That password is too weak.' } });
        }
        return reply(502, 'Couldn\'t create the account. Try again.');
      }
      return reply(201, 'Account created.', { ok: true, userId: result.id || result.user?.id || null });
    } catch (error) {
      if (error?.name === 'TimeoutError') return reply(504, 'Supabase took too long. Try again.');
      return reply(500, 'Couldn\'t create the account. Try again.');
    }
  };
}
