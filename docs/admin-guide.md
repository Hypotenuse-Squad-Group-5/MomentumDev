# Admin page: team guide

Each of us builds one tab of the Admin page, with full CRUD (Create, Read, Update, Delete) for one area. The foundation is already built: who's an admin, the Admin mode switch, the Admin page with five tabs, and one worked example. Your job is to replace your tab's placeholder with the real thing.

## Who owns what

| Teammate | Tab | Your files | Your migration |
|---|---|---|---|
| Teammate 1 | **Lessons** | `js/pages/admin-lessons.js` | `supabase/migrations/20261119020050_admin_lessons.sql` |
| Teammate 2 | **Accounts** | `js/pages/admin-accounts.js` (+ an Edge Function if you do Create) | `database/034_admin_accounts.sql` |
| Teammate 3 | **Posts & announcements** | `js/pages/admin-posts.js` | `database/035_admin_posts.sql` |
| Teammate 4 | **Activities & official events** | `js/pages/admin-activities.js` | `database/036_admin_activities.sql` |

The migration numbers are reserved so nobody collides. If you need a second one, tell the team and take the next free number.

## How it works (2-minute version)

- **Who's an admin** lives in `momentum_private.admins` (migration `032_admin.sql`). The website can't read or write that table, so nobody can make themselves an admin from the app. Only someone signed in to the Supabase project can.
- **Admin mode** is a switch in **Settings › Admin**. Only admins see it. It's off by default and lasts only for that browser tab. Turning it on adds **Admin** as a 6th item in the menu.
- **The Admin page** (`admin.html`) shares the app's header, menu, styles and themes. It has 5 tabs: Accounts, Posts, Activities, Lessons, and Admins (the worked example).
- **Security lives in the database, not the page.** Every admin action is a database function that starts with `perform momentum_private.require_admin();`. Hiding a button is never the protection.

## Get set up (once (already done))

1. Pull the latest `main` (with the foundation merged).
2. In the Supabase SQL editor, run `database/032_admin.sql`: preview, then uncomment `commit;` and run again. (Only needed once for the whole team.)
3. Make yourself an admin. In the SQL editor, with your Momentum sign-in email:
   ```sql
   insert into momentum_private.admins (profile_id, note)
   select p.id, 'team member' from public.profiles p join auth.users u on u.id = p.auth_user_id
    where lower(u.email) = lower('you@byu.edu')
   on conflict (profile_id) do nothing;
   ```
4. Sign in → **Settings** → **Admin** → turn on **Admin mode** → open **Admin** in the menu → your tab.

## The pattern (copy this)

Every action is three small pieces: a database function, a public wrapper, and a call from your tab.

### 1. Database: one function per action (in your migration)

```sql
-- READ: list rows (example from App lists)
create or replace function momentum_private.admin_list_interests()
returns table (id smallint, name text, sort_order smallint, is_active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();          -- ALWAYS the first line
  return query select i.id, i.name, i.sort_order, i.is_active from public.interests i order by i.sort_order;
end $$;
revoke all on function momentum_private.admin_list_interests() from public, anon;
grant execute on function momentum_private.admin_list_interests() to authenticated;

-- the public wrapper the website calls (same name, in public)
create or replace function public.admin_list_interests()
returns table (id smallint, name text, sort_order smallint, is_active boolean)
language sql stable security invoker set search_path = '' as $$ select * from momentum_private.admin_list_interests(); $$;
revoke all on function public.admin_list_interests() from public, anon;
grant execute on function public.admin_list_interests() to authenticated;

-- CREATE / UPDATE / DELETE look the same, with arguments and plpgsql:
create or replace function momentum_private.admin_rename_interest(p_id smallint, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform momentum_private.require_admin();
  if char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'Names are 1 to 40 characters.' using errcode = '22023';   -- shown to the admin as-is
  end if;
  update public.interests set name = trim(p_name) where id = p_id;
  if not found then raise exception 'That interest no longer exists.' using errcode = '22023'; end if;
end $$;
-- (+ the same revoke/grant lines and a public wrapper)
```

Rules for every function:
- `security definer` + `set search_path = ''` + **`perform momentum_private.require_admin();` as the first line**.
- Write full names (`public.interests`, not `interests`), because the search path is empty.
- `revoke ... from public, anon;` then `grant execute ... to authenticated;` for both the private function and its wrapper.
- Check inputs and `raise exception 'Plain-English message.'`. The message shows up in the toast.
- Name them `admin_<verb>_<thing>`: `admin_list_posts`, `admin_create_announcement`, `admin_delete_post`.
- Use the preview format like every other migration: `begin;` … a preview `select` … `-- commit;`.

### 2. Website: call it

```js
const res = await Store.admin.call("admin_rename_interest", { p_id: 3, p_name: "Hiking" });
if (!res.ok) return UI.toast(res.message);   // e.g. "Names are 1 to 40 characters."
UI.toast("Saved");
ctx.refresh();                                // redraw your tab with fresh data
```

`Store.admin.call(name, args)` returns `{ ok: true, data }` or `{ ok: false, message }`. Argument names must match the SQL (`p_id`, `p_name`).

### 3. Your tab file

`js/pages/admin-admins.js` is the worked example (read-only). A full CRUD tab looks like this:

```js
AdminTabs.register({
  key: "lists", label: "App lists", order: 4,
  async render(el, ctx) {
    const res = await Store.admin.call("admin_list_interests");
    if (!ctx.isCurrent()) return;                       // they switched tabs while loading
    if (!res.ok) { el.innerHTML = AdminUI.error(res.message); return; }
    const { esc } = AdminUI;

    el.innerHTML = `<section class="panel">
      <div class="row-between"><h2 class="mb0">Interests</h2><button class="btn btn-primary" id="add">${UI.icon("plus", "sm")}Add</button></div>
      ${AdminUI.table([
        { label: "Name", cell: (r) => esc(r.name) },
        { label: "", className: "actions", cell: (r) =>
            `<button class="btn btn-ghost" data-edit="${r.id}">Edit</button><button class="btn btn-danger" data-del="${r.id}">Delete</button>` },
      ], res.data)}
    </section>`;

    // CREATE: a small form in a modal
    el.querySelector("#add").onclick = () => UI.modal(`<h2>Add interest</h2>
        <div class="field"><label for="f-name">Name</label><input id="f-name" maxlength="40"></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="save">Add</button></div>`, {
      onMount(m, close) {
        m.querySelector("#save").onclick = async () => {
          const r = await Store.admin.call("admin_create_interest", { p_name: m.querySelector("#f-name").value });
          if (!r.ok) return UI.toast(r.message);
          close(); UI.toast("Added"); ctx.refresh();
        };
      },
    });

    // DELETE: always confirm first
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const row = res.data.find((r) => String(r.id) === b.dataset.del);
      if (!(await AdminUI.confirm({ title: `Delete "${row.name}"?`, body: "This can't be undone." }))) return;
      const r = await Store.admin.call("admin_delete_interest", { p_id: row.id });
      UI.toast(r.ok ? "Deleted" : r.message); if (r.ok) ctx.refresh();
    }));
    // UPDATE: same as Create, with the form pre-filled (data-edit buttons)
  },
});
```

Shared helpers in `js/pages/admin.js`:
- `AdminUI.table(columns, rows)`: a data table. Cell HTML isn't escaped, so wrap text in `esc()`.
- `AdminUI.confirm({ title, body, confirmLabel })` resolves to `true` or `false`. Use it before every delete.
- `AdminUI.error(message)`, `AdminUI.empty(text)`, `AdminUI.loading()`: states.
- `AdminUI.when(iso)`: a readable date and time.
- `ctx.refresh()` redraws your tab; `ctx.isCurrent()` is false if they switched tabs while you were loading.

## Team rules

1. **Stay in your lane.** Edit only your tab file and your migration. If you need a change to a normal page (e.g. showing "Momentum" as an author), keep it small and tell the team first. Never edit someone else's tab.
2. **Never widen the normal rules.** Don't add "admins can read everything" policies to existing tables. Rules stack, so they'd leak into the normal app (an admin's own feed would turn site-wide). Admin powers go only through `admin_*` functions.
3. **`require_admin()` is the first line of every admin function.** No exceptions, even for read-only ones.
4. **Confirm before deleting, toast after every change.**
5. **Styles:** use the app's classes (`panel`, `btn`, `field`, `tag`…) and `var(--…)` colors. `tests/themes.test.cjs` fails on hard-coded colors or corners.
6. **Privacy line:** no private messages in admin. Account edits are limited to the fields listed below.
7. **Cache tags:** when you change your tab file, bump its `?v=` in `admin.html`.
8. **Before your PR:** `node --test tests/*.test.cjs`. Then click through your tab, and check a non-admin account still works normally.

## Notes for each area

### Lessons (teammate 1)

- The tab lists the published curriculum. **Preview** shows what learners see and lets admins try the practice exercises.
- **Add lesson** appends a lesson to the path. **Edit** opens the same form with the published content. The form includes the lesson body, knowledge-check questions and correct answers, practice planner fields, sources, and reflection prompts.
- **Publish lesson** makes changes visible to learners. **Delete** removes the lesson from the path and keeps existing completions and habits. Learners skip deleted lessons.
- For rollout, apply the Supabase migration, deploy the updated site and `suggest-habits` function, then begin publishing or deleting lessons. The previous site expects exactly six lessons.

### Accounts (teammate 2)
- **Read:** search profiles by name or username (`public.profiles`: first_name, username, bio, photo…). Email lives in `auth.users`; only show it inside an admin function.
- **Update:** name, bio, photo; **suspend/unsuspend**. Suspend needs a column (e.g. `profiles.suspended_at`), plus a check that blocks suspended users. Decide where: the simplest is the website signing them out with a message.
- **Delete:** copy the approach of `delete_my_account` in `database/025_settings_posts_cancel_account.sql` (it deletes from `auth.users`; everything else cascades). Keep its rule: don't delete someone hosting an upcoming activity people are going to; cancel those first.
- **Create:** needs the Supabase service key, which must **never** be in the website. Do it in an Edge Function (like `supabase/functions/suggest-habits`) that checks the caller is an admin, then calls `auth.admin.createUser({ email, password, email_confirm: true })`. If the professor agrees, skipping Create for accounts is fine. Ask first.

### Posts & announcements (teammate 3)
- **Read:** all posts (`public.posts`: id, author_id, caption, activity_id, visibility, created_at) with the author's name.
- **Create = announcement:** posts are friends-only by a constraint (`posts_visibility_check`). Add a flag (e.g. `is_announcement boolean`) and a read rule so everyone sees announcements; show them pinned at the top of the feed, author shown as **"Momentum"** with the logo.
- **Update:** edit the caption, or hide a post. **Delete:** with confirm.

### Activities & official events (teammate 4)
- **Read:** every activity, including friends-only and cancelled (`cancelled_at`).
- **Create = official event:** add a flag (e.g. `activities.official boolean`). The admin creates it through an admin function, and it shows **"Hosted by Momentum"** with the logo instead of the admin's name.
- **Update:** edit any activity. **Cancel on the host's behalf:** reuse the rules in `cancel_or_delete_activity` (025), so everyone going is notified, but skip the "you must be the host" check.
- **Delete:** with confirm.

### "Momentum" as the author
Announcements and official events show **Momentum** (with the logo) instead of the admin's own name. Admins' normal posts and activities, made from the normal pages, still show their own name. Teammates 3 and 4: agree on one way to draw the "Momentum" author so posts and activities match.

## Done means
- [ ] All four letters work from your tab: Create, Read, Update, Delete (or a written reason one is skipped).
- [ ] Every admin function starts with `require_admin()`; a non-admin calling it gets "Admins only."
- [ ] Deletes ask to confirm; every change shows a toast.
- [ ] Works on phone and desktop, in every theme (try `admin.html?theme=pop`).
- [ ] Team tests pass; a normal account looks and works exactly as before.
- [ ] Your migration is in `database/` with the preview format, and it's been run on Supabase.
