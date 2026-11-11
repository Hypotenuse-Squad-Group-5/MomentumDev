/* Settings: General (privacy, notifications) + Profile. Changes save instantly. */
let interestPicks = null; // interests picked on the Profile tab, until saved
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
  document.getElementById("main").innerHTML = `
  <div style="max-width:720px">
    <h1>Settings</h1>
    <nav class="subnav" aria-label="Settings sections"><a href="#general"${tab === "general" ? ' class="active"' : ""}>General</a><a href="#profile"${tab === "profile" ? ' class="active"' : ""}>Profile</a></nav>
    ${tab === "general" ? `
    <section class="panel">
      <h2>Privacy</h2>
      ${sel("postVisibility", "Posts", "Default for new posts", vis)}
      ${sel("activityVisibility", "Activities", "Default for new activities", vis)}
      ${sel("friendsListVisibility", "Friends list", "Who can see your friends", vis)}
      ${sel("attendeeDisplay", "On \"Who's going\" lists", "How people who aren't your friends see you", [["first_name", "Show my first name"], ["hidden", "Hide me from non-friends"]])}
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
      ${sw("notifyActivity", "Activity reminders", "30 minutes before anything you've committed to")}
      ${sw("notifyHabits", "Habit and streak reminders")}
      <label class="setting-row"><span class="grow">Daily check-in time</span><input type="time" data-k="checkinTime" value="${esc(s.checkinTime)}"></label>
      ${sw("notifyFriends", "Friend requests and +1 invites")}
      ${sw("notifyMessages", "New messages")}
      ${sw("remindersByEmail", "Send reminders by email instead of push")}
    </section>
    <section class="panel mt">
      <h2>Mindful use</h2>
      ${sw("pauseBeforeOpen", "Pause before opening", "A short check-in screen before the app opens")}
      ${sw("weeklySummary", "Weekly progress summary")}
    </section>
    <section class="panel mt">
      <h2>Account</h2>
      <div class="stack">
        <a class="btn btn-block" href="index.html" id="sign-out">Sign out</a>
      </div>
      <p class="hint mt mb0">Signed in as ${esc(p.email || "")}. Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.</p>
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

  document.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => { Store.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value); UI.toast("Saved"); }));
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