/* =====================================================================
   Admin › Accounts (teammate 2). Guide: docs/admin-guide.md
     CREATE  "Add user": the admin-create-user Edge Function (it needs the service key)
     READ    admin_list_accounts: search by name, username or email, 25 a page
     UPDATE  admin_update_account (name, bio, remove photo) and admin_set_suspended (Supabase login ban)
     DELETE  admin_delete_account (type their username to confirm)
   The database functions (migration 034) enforce every rule: admins only, no suspending or deleting
   yourself or another admin, no deleting someone hosting an upcoming activity people are going to.
   ===================================================================== */
(() => {
  const { esc, when, table, confirm: askConfirm } = AdminUI;
  const PAGE = 25;
  const state = { search: "", page: 0 }; // kept while switching tabs
  const SEXES = [["male", "Male"], ["female", "Female"], ["prefer_not_to_say", "Prefer not to say"]];
  // Same rules as sign-up (and the Supabase project)
  const PW_RULES = [
    ["len", "8+ characters", (v) => v.length >= 8],
    ["lower", "lowercase letter", (v) => /[a-z]/.test(v)],
    ["upper", "uppercase letter", (v) => /[A-Z]/.test(v)],
    ["digit", "number", (v) => /[0-9]/.test(v)],
    ["symbol", "symbol", (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(v)],
  ];
  const fullName = (a) => [a.first_name, a.last_name].filter(Boolean).join(" ");
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "");

  // ---------- small form helpers (inline errors, like the rest of the app) ----------
  const field = (id, label, input, hint = "") =>
    `<div class="field" data-f="${id}"><label for="acc-${id}">${esc(label)}</label>${input}${hint ? `<div class="hint">${hint}</div>` : ""}<div class="err" hidden></div></div>`;
  function setErrors(m, fields = {}) {
    m.querySelectorAll(".field[data-f]").forEach((f) => {
      const msg = fields[f.dataset.f], err = f.querySelector(".err");
      f.classList.toggle("invalid", !!msg);
      err.hidden = !msg; err.textContent = msg || "";
    });
    const first = m.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea");
    if (first) first.focus();
  }
  // Editing a red field clears its error right away (Generate counts too)
  function liveClear(m) {
    const clear = (e) => { const f = e.target.closest(".field.invalid"); if (!f) return; f.classList.remove("invalid"); const err = f.querySelector(".err"); err.hidden = true; err.textContent = ""; };
    m.addEventListener("input", clear); m.addEventListener("change", clear);
  }
  const formMsg = (m, text) => { const p = m.querySelector("[data-form-msg]"); p.textContent = text || ""; p.hidden = !text; };

  // ---------- READ: the list ----------
  async function loadList(el) {
    const box = el.querySelector("#acc-results");
    box.innerHTML = '<p class="muted small mt">Loading…</p>';
    const res = await Store.admin.call("admin_list_accounts", { p_search: state.search, p_limit: PAGE, p_offset: state.page * PAGE });
    if (!el.isConnected) return;
    if (!res.ok) { box.innerHTML = AdminUI.error(res.message); box.querySelector("[data-admin-retry]").onclick = () => loadList(el); return; }
    const rows = res.data || [];
    const total = rows.length ? Number(rows[0].total) : 0;
    el.querySelector("#acc-count").textContent = state.search ? `${total} found` : `${total} ${total === 1 ? "account" : "accounts"}`;
    if (!rows.length && state.page > 0) { state.page--; return loadList(el); } // e.g. deleted the last one on a page
    if (!rows.length) { box.innerHTML = AdminUI.empty(state.search ? `No accounts match "${state.search}".` : "No accounts yet."); return; }

    const me = (a) => a.profile_id === Store.ME;
    const locked = (a) => me(a) || a.is_admin; // can't suspend or delete yourself or another admin
    box.innerHTML = table([
      { label: "Name", cell: (a) => `<a href="profile.html?id=${esc(a.profile_id)}">${esc(fullName(a))}</a>
          ${me(a) ? '<span class="tag grey">You</span>' : ""}${a.is_admin ? '<span class="tag ok">Admin</span>' : ""}${a.suspended ? '<span class="tag danger">Suspended</span>' : ""}
          <div class="small muted">@${esc(a.username || "")}</div>` },
      { label: "Email", cell: (a) => esc(a.email || "") },
      { label: "Joined", className: "acc-date", cell: (a) => esc(day(a.joined)) },
      { label: "Last sign-in", className: "acc-date", cell: (a) => (a.last_sign_in ? esc(when(a.last_sign_in)) : '<span class="muted">Never</span>') },
      { label: "", className: "actions", cell: (a) => `
          <button class="btn btn-ghost" data-act="edit" data-id="${esc(a.profile_id)}">Edit</button>
          <button class="btn btn-ghost" data-act="suspend" data-id="${esc(a.profile_id)}"${locked(a) ? ` disabled title="${me(a) ? "That's you" : "Admins can't be suspended"}"` : ""}>${a.suspended ? "Unsuspend" : "Suspend"}</button>
          <button class="btn btn-danger" data-act="delete" data-id="${esc(a.profile_id)}"${locked(a) ? ` disabled title="${me(a) ? "That's you" : "Admins can't be deleted"}"` : ""}>Delete</button>` },
    ], rows) + `
      <div class="row-between mt acc-pager">
        <span class="small muted">Showing ${state.page * PAGE + 1}–${state.page * PAGE + rows.length} of ${total}</span>
        <div class="row"><button class="btn btn-ghost" id="acc-prev"${state.page === 0 ? " disabled" : ""}>Previous</button>
        <button class="btn btn-ghost" id="acc-next"${(state.page + 1) * PAGE >= total ? " disabled" : ""}>Next</button></div>
      </div>`;
    box.querySelector("#acc-prev").onclick = () => { state.page--; loadList(el); };
    box.querySelector("#acc-next").onclick = () => { state.page++; loadList(el); };
    box.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
      const a = rows.find((r) => r.profile_id === b.dataset.id);
      ({ edit: editAccount, suspend: toggleSuspend, delete: deleteAccount })[b.dataset.act](a, () => loadList(el));
    }));
  }

  // ---------- UPDATE: name, bio, photo ----------
  function editAccount(a, reload) {
    UI.modal(`<h2>Edit ${esc(fullName(a))}</h2>
      <form id="acc-edit" novalidate>
        <div class="filter-pair">
          ${field("first", "First name", `<input id="acc-first" type="text" maxlength="40" value="${esc(a.first_name || "")}">`)}
          ${field("last", "Last name", `<input id="acc-last" type="text" maxlength="60" value="${esc(a.last_name || "")}">`)}
        </div>
        ${field("bio", "Bio", `<textarea id="acc-bio" rows="3" maxlength="160">${esc(a.bio || "")}</textarea>`, '<span id="acc-bio-n"></span>/160')}
        ${a.avatar_url ? `<label class="check small"><input type="checkbox" id="acc-photo"> Remove their profile photo</label>` : ""}
        <p class="err" data-form-msg hidden></p>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="acc-save" disabled>Save changes</button></div>
      </form>`, {
      onMount(m, close) {
        liveClear(m);
        const form = m.querySelector("#acc-edit"), save = m.querySelector("#acc-save");
        const now = () => ({ first: m.querySelector("#acc-first").value.trim(), last: m.querySelector("#acc-last").value.trim(),
          bio: m.querySelector("#acc-bio").value.trim(), photo: !!(m.querySelector("#acc-photo") || {}).checked });
        const before = JSON.stringify({ first: (a.first_name || "").trim(), last: (a.last_name || "").trim(), bio: (a.bio || "").trim(), photo: false });
        const sync = () => { m.querySelector("#acc-bio-n").textContent = m.querySelector("#acc-bio").value.length; save.disabled = JSON.stringify(now()) === before; };
        form.oninput = form.onchange = sync; sync();
        form.onsubmit = async (e) => {
          e.preventDefault();
          const v = now(), errs = {};
          if (!v.first) errs.first = "Required.";
          if (!v.last) errs.last = "Required.";
          setErrors(m, errs); formMsg(m, "");
          if (Object.keys(errs).length) return;
          save.disabled = true;
          const r = await Store.admin.call("admin_update_account", { p_profile: a.profile_id, p_first_name: v.first, p_last_name: v.last, p_bio: v.bio, p_remove_photo: v.photo });
          if (!r.ok) { formMsg(m, r.message); save.disabled = false; return; }
          close(); UI.toast("Account updated"); reload();
        };
      },
    });
  }

  // ---------- UPDATE: suspend / unsuspend ----------
  async function toggleSuspend(a, reload) {
    const suspend = !a.suspended;
    const ok = await askConfirm(suspend
      ? { title: `Suspend ${fullName(a)}?`, body: "They'll be signed out within the hour and can't sign in until you unsuspend them. Nothing of theirs is deleted.", confirmLabel: "Suspend" }
      : { title: `Unsuspend ${fullName(a)}?`, body: "They'll be able to sign in again right away.", confirmLabel: "Unsuspend", danger: false });
    if (!ok) return;
    const r = await Store.admin.call("admin_set_suspended", { p_profile: a.profile_id, p_suspended: suspend });
    UI.toast(r.ok ? (suspend ? `${a.first_name} is suspended` : `${a.first_name} can sign in again`) : r.message);
    if (r.ok) reload();
  }

  // ---------- DELETE: type their username to confirm ----------
  function deleteAccount(a, reload) {
    UI.modal(`<h2>Delete ${esc(fullName(a))}'s account?</h2>
      <p>This deletes their login, profile, habits, posts, messages and activities for good. It can't be undone.</p>
      ${field("confirm", `Type their username (${a.username}) to confirm`, `<input id="acc-confirm" type="text" autocomplete="off" spellcheck="false">`)}
      <p class="err" data-form-msg hidden></p>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger solid" id="acc-del" disabled>Delete account</button></div>`, {
      onMount(m, close) {
        liveClear(m);
        const input = m.querySelector("#acc-confirm"), btn = m.querySelector("#acc-del");
        input.oninput = () => { btn.disabled = input.value.trim() !== a.username; };
        btn.onclick = async () => {
          btn.disabled = true;
          const r = await Store.admin.call("admin_delete_account", { p_profile: a.profile_id });
          if (!r.ok) { formMsg(m, r.message); return; }
          close(); UI.toast("Account deleted"); reload();
        };
      },
    });
  }

  // ---------- CREATE: Add user (Edge Function) ----------
  function makePassword() {
    const sets = ["abcdefghijkmnpqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!#$%&*?"];
    const pick = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
    const chars = sets.map(pick).concat(Array.from({ length: 8 }, () => pick(sets.join(""))));
    for (let i = chars.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return chars.join("");
  }
  function addUser(reload) {
    UI.modal(`<h2>Add user</h2>
      <p class="small muted">Creates a ready-to-use login. Share the temporary password with them; they can change it in Settings.</p>
      <form id="acc-add" novalidate>
        <div class="filter-pair">
          ${field("firstName", "First name", '<input id="acc-firstName" type="text" maxlength="40" autocomplete="off">')}
          ${field("lastName", "Last name", '<input id="acc-lastName" type="text" maxlength="60" autocomplete="off">')}
        </div>
        ${field("email", "Email", '<input id="acc-email" type="email" maxlength="254" autocomplete="off">')}
        ${field("sex", "Sex", `<select id="acc-sex"><option value="">Choose…</option>${SEXES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`)}
        ${field("password", "Temporary password", `<div class="row" style="flex-wrap:nowrap"><input id="acc-password" type="text" autocomplete="off" spellcheck="false" class="grow"><button type="button" class="btn btn-ghost" id="acc-gen">Generate</button></div>`,
          `<ul class="pw-rules">${PW_RULES.map(([k, l]) => `<li data-rule="${k}">${l}</li>`).join("")}</ul>`)}
        <div class="field" data-f="ageConfirmed"><label class="check small"><input type="checkbox" id="acc-age"> I confirm this person is 18 or older</label><div class="err" hidden></div></div>
        <p class="err" data-form-msg hidden></p>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="acc-create">Create account</button></div>
      </form>`, {
      onMount(m, close) {
        liveClear(m);
        const $ = (id) => m.querySelector("#acc-" + id), pw = $("password");
        const tick = () => PW_RULES.forEach(([k, , ok]) => m.querySelector(`[data-rule="${k}"]`).classList.toggle("ok", ok(pw.value)));
        pw.oninput = tick; tick();
        $("gen").onclick = () => { pw.value = makePassword(); tick(); pw.dispatchEvent(new Event("input", { bubbles: true })); };
        m.querySelector("#acc-add").onsubmit = async (e) => {
          e.preventDefault();
          const body = { firstName: $("firstName").value.trim(), lastName: $("lastName").value.trim(), email: $("email").value.trim(),
            sex: $("sex").value, password: pw.value, ageConfirmed: $("age").checked };
          const errs = {};
          if (!body.firstName) errs.firstName = "Required.";
          if (!body.lastName) errs.lastName = "Required.";
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errs.email = "Enter a valid email.";
          if (!body.sex) errs.sex = "Choose one.";
          const missing = PW_RULES.filter(([, , ok]) => !ok(body.password)).map(([, l]) => l);
          if (missing.length) errs.password = "Still needs: " + missing.join(", ") + ".";
          if (!body.ageConfirmed) errs.ageConfirmed = "Required.";
          setErrors(m, errs); formMsg(m, "");
          if (Object.keys(errs).length) return;
          const btn = $("create"); btn.disabled = true; btn.textContent = "Creating…";
          const r = await Store.admin.invoke("admin-create-user", body);
          btn.disabled = false; btn.textContent = "Create account";
          if (!r.ok) { setErrors(m, r.fields || {}); if (!r.fields) formMsg(m, r.message); return; }
          // Done: show the login so the admin can share it
          m.innerHTML = `<h2>Account created</h2>
            <p>${esc(body.firstName)} can sign in now with:</p>
            <div class="panel soft acc-login"><div><span class="small muted">Email</span><br><b>${esc(body.email.toLowerCase())}</b></div>
              <div><span class="small muted">Temporary password</span><br><b class="acc-pw">${esc(body.password)}</b></div></div>
            <p class="small muted">Share it privately. They can change it in Settings › Account.</p>
            <div class="modal-actions"><button class="btn btn-ghost" id="acc-copy">Copy login</button><button class="btn btn-primary" data-close>Done</button></div>`;
          m.querySelector("#acc-copy").onclick = async () => {
            try { await navigator.clipboard.writeText(`Email: ${body.email.toLowerCase()}\nTemporary password: ${body.password}`); UI.toast("Copied"); }
            catch (err) { UI.toast("Couldn't copy. Select the text instead."); }
          };
          reload();
        };
      },
    });
  }

  AdminTabs.register({
    key: "accounts",
    label: "Accounts",
    order: 1,
    render(el) {
      el.innerHTML = `<section class="panel">
        <div class="row-between"><div><h2 class="mb0">Accounts</h2><span class="small muted" id="acc-count"></span></div>
          <button class="btn btn-primary" id="acc-add-btn">${UI.icon("plus", "sm")}Add user</button></div>
        <div class="field mt mb0"><label for="acc-search">Search</label>
          <input id="acc-search" type="search" placeholder="Name, username or email" value="${esc(state.search)}" autocomplete="off"></div>
        <div id="acc-results"></div>
      </section>`;
      let timer;
      el.querySelector("#acc-search").oninput = (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.search = e.target.value.trim(); state.page = 0; loadList(el); }, 300);
      };
      el.querySelector("#acc-add-btn").onclick = () => addUser(() => loadList(el));
      return loadList(el);
    },
  });
})();
