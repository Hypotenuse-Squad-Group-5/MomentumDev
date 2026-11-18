/* Settings: General (privacy, blocked users, notifications, account) + Profile. General settings save to Supabase instantly. */
let interestPicks = null; // interests picked on the Profile tab, until saved
let pwDraft = null;       // what's typed in Change password, so a background refresh doesn't wipe it
let pwErrors = {};        // field -> message, shown again after a refresh
UI.mount("settings", function render() {
  const { icon, esc } = UI;
  const s = Store.state.settings, p = Store.profile(Store.ME);
  const tab = location.hash === "#profile" ? "profile" : "general";
  const sw = (k, title, sub) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><input type="checkbox" class="switch" data-k="${k}"${s[k] ? " checked" : ""}></label>`;
  const sel = (k, title, sub, opts) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${s[k] === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const vis = Object.entries(UI.VIS);
  const INTERESTS = Store.interestOptions(); // from the `interests` table (Supabase → Table Editor → interests)
  const blockedList = Store.blockedUsers ? Store.blockedUsers() : [];
  if (!interestPicks) interestPicks = (p.interests || []).slice(); // unsaved picks survive a re-render
  const picked = interestPicks;
  const themes = window.Theme ? Theme.ids : ["default"];
  const currentTheme = window.Theme ? Theme.current() : "default";
  if (tab === "general" && window.Theme) Theme.loadAllFonts();
  if (!Store.adminChecked()) Store.checkAdmin().then((yes) => { if (yes) render(); }); // admins get the Admin section
  document.getElementById("main").innerHTML = `
  <div style="max-width:720px">
    <h1>Settings</h1>
    <nav class="subnav" aria-label="Settings sections"><a href="#general"${tab === "general" ? ' class="active"' : ""}>General</a><a href="#profile"${tab === "profile" ? ' class="active"' : ""}>Profile</a></nav>
    ${tab === "general" ? `
    ${Store.isAdmin() ? `
    <section class="panel" id="admin-section">
      <h2>Admin</h2>
      <label class="setting-row"><span class="grow">Admin mode<br><span class="small muted">Adds the Admin page to the menu. Turns off when you close this tab.</span></span><input type="checkbox" class="switch" id="admin-mode"${Store.adminMode() ? " checked" : ""}></label>
    </section>
    <section class="panel mt" id="appearance">` : `
    <section class="panel" id="appearance">`}
      <h2>Appearance</h2>
      <p class="small muted mb0">Pick a look. It changes colors, corners and fonts, and follows your account to every device.</p>
      <div class="theme-picker" role="radiogroup" aria-label="Theme">
        ${themes.map((id) => `<label class="theme-opt">
          <input type="radio" name="theme" value="${id}" data-k="theme"${id === currentTheme ? " checked" : ""}>
          <span class="theme-frame"><span class="theme-swatch" data-theme="${id}" aria-hidden="true">
            <span class="ts-aa">Aa</span><span class="ts-hero"></span>
            <span class="ts-row"><span class="ts-dot"></span><span class="ts-line"></span></span><span class="ts-btn"></span>
          </span></span>
          <span class="theme-name">${esc(window.Theme ? Theme.name(id) : id)}</span>
        </label>`).join("")}
      </div>
    </section>
    <section class="panel mt">
      <h2>Privacy</h2>
      ${sel("activityVisibility", "Activities", "Default for new activities", vis)}
    </section>
    <section class="panel mt" id="blocked-users-section">
      <h2>Blocked users</h2>
      <p class="small muted">People you block can't message you and aren't notified.</p>
      ${blockedList.length
        ? blockedList.map((b) => {
            const name = Store.isFriend(b.id) ? Store.fullName(b.id) : Store.profile(b.id).first;
            return `<div class="setting-row" data-blocked-id="${b.id}"><div class="person grow">${UI.avatar(b.id, "sm", true)}<span><a href="profile.html?id=${b.id}" style="text-decoration:none"><b>${esc(name)}</b></a></span></div><button type="button" class="btn btn-sm" data-unblock="${b.id}">Unblock</button></div>`;
          }).join("")
        : `<p class="muted small mb0">You haven't blocked anyone from messaging you.</p>`}
    </section>
    <section class="panel mt">
      <h2>Notifications</h2>
      <p class="small muted">These show in the Notifications panel on Home. Cancelled activities always show.</p>
      ${sw("notifyActivity", "Activity reminders", "Your next activities, and a heads-up 30 minutes before")}
      ${sw("notifyFriends", "Friend requests and +1 invites")}
      ${sw("notifyMessages", "New messages")}
    </section>
    <section class="panel mt">
      <h2>Account</h2>
      <p class="small muted">Signed in as ${esc(p.email || "")}. Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.</p>
      <form id="pw-form" class="mt" novalidate>
        <p class="label">Change password</p>
        <div class="field" data-f="current"><label for="pw-current">Current password</label><input id="pw-current" type="password" autocomplete="current-password"><div class="err" hidden></div></div>
        <div class="field" data-f="next"><label for="pw-next">New password</label><input id="pw-next" type="password" autocomplete="new-password" minlength="8"><div class="hint">--> Minimum 8 characters. Use upper and lowercase letters, a number, and a symbol.</div><div class="err" hidden></div></div>
        <div class="field" data-f="again"><label for="pw-again">New password again</label><input id="pw-again" type="password" autocomplete="new-password"><div class="err" hidden></div></div>
        <button class="btn" id="pw-save" disabled>Change password</button>
      </form>
      <div class="stack mt-lg">
        <a class="btn btn-block" href="index.html" id="sign-out">Sign out</a>
      </div>
      <div class="danger-zone mt-lg">
        <p class="label">Delete account</p>
        <p class="small muted">Permanently deletes your profile, habits, Momentum, posts, messages and commitments. This can't be undone.</p>
        <button type="button" class="btn btn-danger" id="delete-account">Delete my account</button>
      </div>
    </section>`
    : `
    <form class="panel" id="profile-form" novalidate>
      <div class="profile-head">
        ${UI.avatar(Store.ME, "lg")}
        <div>
          <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp" style="display:none">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-sm btn-primary" id="btn-change-photo">${icon("camera", "sm")}Change photo</button>
            ${p.avatarUrl ? `<button type="button" class="btn btn-sm" id="btn-remove-photo">Remove photo</button>` : ""}
          </div>
          <p class="small muted mt mb0" id="avatar-status">JPG, PNG, or WebP. Automatically resized to 300×300.</p>
          ${p.memberSince ? `<p class="small muted mt mb0">Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. This can't be changed.</p>` : ""}
        </div>
      </div>
      <div class="alert mt" id="pf-msg" hidden></div>
      <p class="label mt">Public: other members see these</p>
      <div class="field" data-f="first"><label for="first">First name</label><input id="first" type="text" maxlength="40" value="${esc(p.first)}"><div class="err" hidden></div></div>
      <div class="field"><label for="bio">Bio <span class="opt">(optional)</span></label><textarea id="bio" maxlength="160" style="min-height:80px">${esc(p.bio || "")}</textarea><div class="hint">Don't include your last name, address, or schedule.</div></div>
      <div class="field"><span class="flabel" id="int-label">Interests</span>${INTERESTS.length ? `<div class="picker" id="int-picker"><div class="chips picker-tags" id="int-tags"></div><input type="text" id="int-search" enterkeyhint="done" placeholder="Search or pick interests" autocomplete="off" role="combobox" aria-labelledby="int-label" aria-expanded="false" aria-controls="int-list"><ul class="picker-list" id="int-list" role="listbox" hidden></ul></div>` : '<p class="hint mb0">Interests couldn\'t be loaded. If this keeps happening, migration 005 may not have been run.</p>'}<div class="hint">Used to filter and suggest activities.</div></div>
      <p class="label mt">${icon("lock", "sm")} Private: only you see these</p>
      <div class="field" data-f="last"><label for="last">Last name</label><input id="last" type="text" maxlength="60" value="${esc(p.last || "")}"><div class="err" hidden></div></div>
      <div class="field"><label for="email">Email</label><input id="email" type="email" value="${esc(p.email || "")}" disabled><div class="hint">Your sign-in email. Changing it comes in a later update.</div></div>
      ${p.ageConfirmedAt ? `<p class="small muted">${icon("check", "sm")} You confirmed you're 18 or older on ${new Date(p.ageConfirmedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.</p>` : ""}
      <div class="field" data-f="sex"><label for="sex">Sex</label><select id="sex"><option value="">Choose</option>${[["male", "Male"], ["female", "Female"], ["prefer_not_to_say", "Prefer not to say"]].map(([val, l]) => `<option value="${val}"${p.sex === val ? " selected" : ""}>${l}</option>`).join("")}</select><div class="err" hidden></div></div>
      <button class="btn btn-primary btn-block" id="pf-save">Save changes</button>
    </form>`}
  </div>`;

  // Settings save to Supabase (user_settings) as soon as they change
  // Admin mode: only drawn for admins (the database decides who's an admin, migration 032)
  const adminSwitch = document.getElementById("admin-mode");
  if (adminSwitch) adminSwitch.onchange = () => {
    Store.setAdminMode(adminSwitch.checked);
    UI.renderHeader(); // redraw the menu with or without Admin
    UI.toast(adminSwitch.checked ? "Admin mode on. Admin is in the menu." : "Admin mode off");
  };
  document.querySelectorAll("[data-k]").forEach((el) => (el.onchange = async () => {
    const r = await Store.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value);
    if (r.ok) UI.toast(r.localOnly ? "Saved on this device" : "Saved"); else { UI.toast("Couldn't save: " + r.message); render(); }
  }));

  // Change password: current one first (proves it's you), then the new one twice
  const pw = document.getElementById("pw-form");
  if (pw) {
    const val = (id) => pw.querySelector("#" + id).value;
    const clear = () => pw.querySelectorAll(".invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    const bad = (k, m) => { const f = pw.querySelector(`[data-f="${k}"]`); f.classList.add("invalid"); const e = f.querySelector(".err"); e.textContent = m; e.hidden = false; };
    const btn = pw.querySelector("#pw-save");
    const ids = ["pw-current", "pw-next", "pw-again"];
    const refreshBtn = () => { btn.disabled = !ids.every((id) => val(id)); };
    if (pwDraft) ids.forEach((id) => { pw.querySelector("#" + id).value = pwDraft[id] || ""; }); // survive re-renders
    Object.entries(pwErrors).forEach(([k, m]) => bad(k, m));
    refreshBtn();
    pw.addEventListener("input", () => { pwDraft = Object.fromEntries(ids.map((id) => [id, val(id)])); refreshBtn(); });
    pw.onsubmit = async (e) => {
      e.preventDefault(); clear(); pwErrors = {};
      if (val("pw-next") !== val("pw-again")) { pwErrors = { again: "The new passwords don't match." }; return bad("again", pwErrors.again); }
      btn.disabled = true; btn.textContent = "Changing…";
      const r = await Store.changePassword(val("pw-current"), val("pw-next"));
      btn.textContent = "Change password";
      if (!r.ok) { pwErrors = { [r.field || "next"]: r.message }; bad(r.field || "next", r.message); btn.disabled = false; return; }
      pwDraft = null; pwErrors = {}; pw.reset(); btn.disabled = true; UI.toast("Password changed");
    };
  }

  // Delete account: hosts clean up first, then type DELETE to confirm
  const del = document.getElementById("delete-account");
  if (del) del.onclick = () => {
    const blocking = Store.blockingHostedActivities();
    if (blocking.length) {
      return UI.modal(`<h2 style="color:var(--danger)">Cancel your activities first</h2>
        <p>People are going to ${blocking.length === 1 ? "an activity" : "activities"} you're hosting. Cancel ${blocking.length === 1 ? "it" : "them"} first so they're told:</p>
        <ul>${blocking.map((a) => `<li><a href="activity.html?id=${a.id}">${esc(a.title)}</a> · ${esc(UI.fmtDay(a.startsAt))}</li>`).join("")}</ul>
        <div class="modal-actions"><button class="btn btn-primary" data-close>OK</button></div>`);
    }
    UI.modal(`<h2>Delete your account?</h2>
      <p>This permanently deletes your profile, habits, Momentum, posts, messages and commitments. Activities you host with nobody going are deleted too. <b>This can't be undone.</b></p>
      <div class="field"><label for="del-confirm">Type <b>DELETE</b> to confirm</label><input id="del-confirm" type="text" autocomplete="off" autocapitalize="characters"></div>
      <div class="alert" id="del-msg" hidden></div>
      <div class="modal-actions"><button class="btn" data-close>Keep my account</button><button class="btn btn-danger solid" id="del-go" disabled>Delete my account</button></div>`,
      { onMount: (m) => {
        const input = m.querySelector("#del-confirm"), go = m.querySelector("#del-go"), msg = m.querySelector("#del-msg");
        input.oninput = () => { go.disabled = input.value.trim() !== "DELETE"; };
        input.focus();
        go.onclick = async () => {
          go.disabled = true; go.textContent = "Deleting…"; msg.hidden = true;
          const r = await Store.deleteAccount();
          if (!r.ok) { msg.textContent = r.message; msg.hidden = false; go.textContent = "Delete my account"; go.disabled = false; return; }
          location.href = "index.html";
        };
      } });
  };
  document.querySelectorAll("[data-unblock]").forEach((b) => (b.onclick = () => UI.confirmUnblock(b.dataset.unblock)));
  const so = document.getElementById("sign-out"); if (so) so.onclick = async (e) => { e.preventDefault(); await Store.auth.signOut(); location.href = "index.html"; };
  interestPicker(INTERESTS, picked, esc, icon, () => refreshSave());

  const fileInp = document.getElementById("avatar-input");
  const changeBtn = document.getElementById("btn-change-photo");
  const removeBtn = document.getElementById("btn-remove-photo");
  const statusEl = document.getElementById("avatar-status");
  if (changeBtn && fileInp) {
    changeBtn.onclick = () => fileInp.click();
    fileInp.onchange = async () => {
      const file = fileInp.files && fileInp.files[0];
      if (!file) return;
      changeBtn.disabled = true;
      changeBtn.textContent = "Processing…";
      if (statusEl) statusEl.textContent = "Resizing and uploading to Supabase Storage…";
      try {
        const res = await Store.uploadAvatar(file);
        if (!res.ok) {
          UI.toast("Upload failed: " + res.message);
          if (statusEl) statusEl.textContent = "Upload failed: " + res.message;
        } else {
          UI.toast("Profile picture updated");
          render();
        }
      } catch (err) {
        UI.toast("Upload error: " + (err.message || err));
        if (statusEl) statusEl.textContent = "Upload error: " + (err.message || err);
      } finally {
        changeBtn.disabled = false;
        changeBtn.innerHTML = `${icon("camera", "sm")}Change photo`;
        fileInp.value = "";
      }
    };
  }
  if (removeBtn) {
    removeBtn.onclick = async () => {
      removeBtn.disabled = true;
      removeBtn.textContent = "Removing…";
      try {
        const res = await Store.deleteAvatar();
        if (!res.ok) {
          UI.toast("Failed to remove: " + res.message);
        } else {
          UI.toast("Profile picture removed");
          render();
        }
      } catch (err) {
        UI.toast("Error: " + (err.message || err));
      } finally {
        removeBtn.disabled = false;
      }
    };
  }

  const pf = document.getElementById("profile-form");
  // Save button: grey and unclickable until something differs from what's saved.
  const saveBtn = pf && pf.querySelector("#pf-save");
  const fval = (id) => { const el = pf && pf.querySelector("#" + id); return el ? el.value.trim() : ""; };
  const snapshot = () => JSON.stringify([fval("first"), fval("bio"), fval("last"), fval("sex"), picked.slice().sort()]);
  let baseline = JSON.stringify([(p.first || "").trim(), (p.bio || "").trim(), (p.last || "").trim(), p.sex || "", (p.interests || []).slice().sort()]);
  const refreshSave = () => { if (saveBtn) saveBtn.disabled = snapshot() === baseline; };
  if (pf) { pf.addEventListener("input", refreshSave); pf.addEventListener("change", refreshSave); }
  refreshSave();
  if (pf) pf.onsubmit = async (e) => {
    e.preventDefault();
    const v = (id) => pf.querySelector("#" + id).value.trim();
    pf.querySelectorAll(".invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    const msg = pf.querySelector("#pf-msg"); msg.hidden = true;
    const bad = (k, m) => { const f = pf.querySelector(`[data-f="${k}"]`); f.classList.add("invalid"); const el = f.querySelector(".err"); el.textContent = m; el.hidden = false; };
    // Same rules the database enforces
    ["first", "last", "sex"].forEach((k) => { if (!v(k)) bad(k, "Required."); });
    if (pf.querySelector(".invalid")) { msg.textContent = "Fix the highlighted fields."; msg.hidden = false; return; }
    const btn = pf.querySelector("#pf-save"); btn.disabled = true; btn.textContent = "Saving…";
    const r = await Store.updateProfile({ first: v("first"), bio: v("bio"), last: v("last"), sex: v("sex"), interests: picked.slice() });
    btn.textContent = "Save changes";
    if (!r.ok) { msg.textContent = "Couldn't save: " + r.message; msg.hidden = false; refreshSave(); return; }
    interestPicks = null; // next render reloads from the saved profile
    baseline = snapshot(); refreshSave(); // saved: grey again until the next change
    UI.toast("Profile saved");
  };

}, { live: true });
// Interests picker: picks show as tags; type to narrow the alphabetical list.
function interestPicker(options, picked, esc, icon, onChange = () => {}) {
  const box = document.getElementById("int-picker");
  if (!box) return;
  const tags = box.querySelector("#int-tags"), input = box.querySelector("#int-search"), list = box.querySelector("#int-list");
  let shown = [], active = -1;
  const drawTags = () => {
    tags.innerHTML = picked.map((n) => `<span class="chip picked">${esc(n)}<button type="button" class="chip-x" data-remove="${esc(n)}" aria-label="Remove ${esc(n)}">${icon("x", "sm")}</button></span>`).join("");
    tags.hidden = !picked.length;
  };
  const drawList = () => {
    const q = input.value.trim().toLowerCase();
    shown = options.filter((n) => !picked.includes(n) && n.toLowerCase().includes(q));
    if (active >= shown.length) active = shown.length - 1;
    list.innerHTML = shown.length
      ? shown.map((n, i) => `<li role="option" id="int-opt-${i}" data-i="${i}"${i === active ? ' class="active" aria-selected="true"' : ""}>${esc(n)}</li>`).join("")
      : `<li class="none">${q ? "No matches" : "You've picked them all"}</li>`;
    input.setAttribute("aria-activedescendant", active >= 0 ? "int-opt-" + active : "");
    const a = list.querySelector(".active"); // keep the highlighted option visible (scrolls the list only, not the page)
    if (a && a.offsetTop < list.scrollTop) list.scrollTop = a.offsetTop;
    else if (a && a.offsetTop + a.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = a.offsetTop + a.offsetHeight - list.clientHeight;
  };
  const place = () => { // open upward when there isn't room below (phone tab bar, keyboard)
    const r = input.getBoundingClientRect(), bar = document.querySelector(".tabbar");
    const bottom = Math.min(window.visualViewport ? visualViewport.height : innerHeight, bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().top : Infinity);
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 60;
    const below = bottom - r.bottom - 8, above = r.top - top - 8, up = below < 180 && above > below;
    list.classList.toggle("up", up);
    list.style.maxHeight = Math.max(120, Math.min(240, up ? above : below)) + "px";
  };
  const open = () => { list.hidden = false; input.setAttribute("aria-expanded", "true"); drawList(); place(); };
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const add = (n) => { picked.push(n); input.value = ""; active = -1; drawTags(); drawList(); place(); input.focus(); onChange(); };

  input.onfocus = open;
  input.onclick = open;
  input.oninput = () => { active = input.value.trim() ? 0 : -1; open(); };
  input.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.hidden) open(); active = Math.min(active + 1, shown.length - 1); drawList(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); drawList(); }
    else if (e.key === "Enter") { e.preventDefault(); if (!list.hidden && shown[active]) add(shown[active]); } // never submits the form
    else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); close(); } }
    else if (e.key === "Backspace" && !input.value && picked.length) { picked.pop(); drawTags(); drawList(); onChange(); }
  };
  list.onmousedown = (e) => e.preventDefault(); // keep focus in the box while clicking
  list.onclick = (e) => { const li = e.target.closest("[data-i]"); if (li) add(shown[+li.dataset.i]); };
  tags.onclick = (e) => {
    const b = e.target.closest("[data-remove]"); if (!b) return;
    picked.splice(picked.indexOf(b.dataset.remove), 1); drawTags(); if (!list.hidden) drawList(); onChange();
  };
  input.onblur = close;
  drawTags();
}
window.addEventListener("hashchange", () => location.reload());