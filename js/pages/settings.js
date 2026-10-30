/* Settings: General (privacy, notifications) + Profile. Changes save instantly. */
UI.mount("settings", function render() {
  const { icon, esc } = UI;
  const s = Store.state.settings, p = Store.profile(Store.ME);
  const tab = location.hash === "#profile" ? "profile" : "general";
  const sw = (k, title, sub) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><input type="checkbox" class="switch" data-k="${k}"${s[k] ? " checked" : ""}></label>`;
  const sel = (k, title, sub, opts) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${s[k] === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const vis = Object.entries(UI.VIS);
  const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  const INTERESTS = ["Pickleball", "Reading", "Hiking", "Board games", "Cooking", "Music", "Climbing", "Art", "Volleyball", "Puzzles"];

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
      ${sel("messageRequestsFrom", "Message requests from", "Friends can always message you", [["anyone", "Anyone"], ["shared_activities", "People from shared activities"], ["nobody", "Nobody"]])}
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
      <p class="small"><span class="mode-badge${Store.live ? " live" : ""}">Activities saved to: ${Store.live ? "Supabase" : "this browser"}</span></p>
      <div class="stack">
        <a class="btn btn-block" href="index.html" id="sign-out">Sign out</a>
        ${Store.live ? "" : `<button class="btn btn-block" id="reset">Reset demo data</button>
        <button class="btn btn-block" id="clear">Start empty (remove all demo data)</button>`}
      </div>
      ${Store.live ? `<p class="hint mt mb0">Signed in as ${esc(p.email || "")}. Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}.</p>`
        : `<p class="hint mt mb0">Both only affect this browser. "Start empty" keeps just your account so you can see every page's empty state. "Reset" brings the demo content back.</p>`}
    </section>`
    : `
    <form class="panel" id="profile-form" novalidate>
      <div class="profile-head">${UI.avatar(Store.ME, "lg")}<div><button type="button" class="btn btn-sm" disabled>${icon("camera", "sm")}Change photo (later slice)</button>
        ${p.memberSince ? `<p class="small muted mt mb0">Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. This can't be changed.</p>` : ""}</div></div>
      <div class="alert mt" id="pf-msg" hidden></div>
      <p class="label mt">Public: other members see these</p>
      <div class="field" data-f="first"><label for="first">First name</label><input id="first" type="text" maxlength="40" value="${esc(p.first)}"><div class="err" hidden></div></div>
      <div class="grid-2">
        <div class="field" data-f="city"><label for="city">City</label><input id="city" type="text" maxlength="60" value="${esc(p.city || "")}"><div class="err" hidden></div></div>
        <div class="field" data-f="state"><label for="state">State</label><select id="state"><option value="">Choose</option>${STATES.map((x) => `<option${p.state === x ? " selected" : ""}>${x}</option>`).join("")}</select><div class="err" hidden></div></div>
      </div>
      <div class="field"><label for="bio">Bio <span class="opt">(optional)</span></label><textarea id="bio" maxlength="160" style="min-height:80px">${esc(p.bio || "")}</textarea><div class="hint">Don't include your last name, address, or schedule.</div></div>
      <p class="label mt">${icon("lock", "sm")} Private: only you see these</p>
      <div class="field" data-f="last"><label for="last">Last name</label><input id="last" type="text" maxlength="60" value="${esc(p.last || "")}"><div class="err" hidden></div></div>
      <div class="field"><label for="email">Email</label><input id="email" type="email" value="${esc(p.email || "")}" disabled><div class="hint">Your sign-in email. Changing it comes in a later update.</div></div>
      <div class="field" data-f="phone"><label for="phone">Phone</label><input id="phone" type="tel" value="${esc(p.phone || "")}"><div class="err" hidden></div></div>
      <div class="field" data-f="address"><label for="address">Home address</label><input id="address" type="text" value="${esc(p.address || "")}"><div class="hint">Never shown to anyone.</div><div class="err" hidden></div></div>
      <div class="grid-2">
        <div class="field" data-f="zip"><label for="zip">Zip code</label><input id="zip" type="text" inputmode="numeric" maxlength="5" value="${esc(p.zip || "")}"><div class="err" hidden></div></div>
        <div class="field" data-f="birthday"><label for="birthday">Birthdate</label><input id="birthday" type="date" value="${esc(p.birthday || "")}"><div class="err" hidden></div></div>
      </div>
      <div class="field" data-f="sex"><label for="sex">Sex</label><select id="sex"><option value="">Choose</option>${[["male", "Male"], ["female", "Female"], ["prefer_not_to_say", "Prefer not to say"]].map(([val, l]) => `<option value="${val}"${p.sex === val ? " selected" : ""}>${l}</option>`).join("")}</select><div class="err" hidden></div></div>
      <div class="field"><span class="flabel">Interests</span><div class="chips">${INTERESTS.map((i) => `<label class="chip"><input type="checkbox" value="${i}"${(p.interests || []).includes(i) ? " checked" : ""}>${i}</label>`).join("")}</div><div class="hint">Used to filter and suggest activities. Saved on this device for now.</div></div>
      <button class="btn btn-primary btn-block" id="pf-save">Save changes</button>
    </form>`}
  </div>`;

  document.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => { Store.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value); UI.toast("Saved"); }));
  const so = document.getElementById("sign-out"); if (so) so.onclick = async (e) => { e.preventDefault(); await Store.auth.signOut(); Store.signOut(); location.href = "index.html"; };
  const rs = document.getElementById("reset");
  if (rs) rs.onclick = () => UI.modal(`<h2>Reset demo data?</h2><p>This clears everything you've done in this browser and restores the demo content.</p><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-danger" id="do-reset">Reset</button></div>`,
    { onMount: (m, close) => (m.querySelector("#do-reset").onclick = () => { Store.reset(); Store.signIn(); close(); UI.toast("Demo data reset"); }) });
  const cl = document.getElementById("clear");
  if (cl) cl.onclick = () => UI.modal(`<h2>Remove all demo data?</h2><p>This clears every demo habit, friend, message, post, RSVP${Store.live ? "" : ", and activity"} in this browser, leaving only your account. You can bring it all back with "Reset demo data".</p><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-danger" id="do-clear">Remove demo data</button></div>`,
    { onMount: (m, close) => (m.querySelector("#do-clear").onclick = () => { Store.clearDemo(); close(); UI.toast("Demo data removed"); }) });
  const pf = document.getElementById("profile-form");
  if (pf) pf.onsubmit = async (e) => {
    e.preventDefault();
    const v = (id) => pf.querySelector("#" + id).value.trim();
    pf.querySelectorAll(".invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    const msg = pf.querySelector("#pf-msg"); msg.hidden = true;
    const bad = (k, m) => { const f = pf.querySelector(`[data-f="${k}"]`); f.classList.add("invalid"); const el = f.querySelector(".err"); el.textContent = m; el.hidden = false; };
    // Same rules the database enforces
    ["first", "city", "state", "last", "phone", "address", "zip", "birthday", "sex"].forEach((k) => { if (!v(k)) bad(k, "Required."); });
    const digits = v("phone").replace(/\D/g, "");
    if (v("phone") && (digits.length < 10 || digits.length > 15)) bad("phone", "Enter a full phone number.");
    if (v("address") && v("address").length < 5) bad("address", "Enter your full street address.");
    if (v("zip") && !/^[0-9]{5}$/.test(v("zip"))) bad("zip", "Use a 5-digit zip code.");
    if (v("birthday")) { const adult = new Date(); adult.setFullYear(adult.getFullYear() - 18); if (new Date(v("birthday") + "T00:00") > adult) bad("birthday", "You must be 18 or older."); }
    if (pf.querySelector(".invalid")) { msg.textContent = "Fix the highlighted fields."; msg.hidden = false; return; }
    const btn = pf.querySelector("#pf-save"); btn.disabled = true; btn.textContent = "Saving…";
    const r = await Store.updateProfile({ first: v("first"), city: v("city"), state: v("state"), bio: v("bio"), last: v("last"), phone: v("phone"), address: v("address"), zip: v("zip"), birthday: v("birthday"), sex: v("sex"), interests: [...pf.querySelectorAll(".chip input:checked")].map((x) => x.value) });
    btn.disabled = false; btn.textContent = "Save changes";
    if (!r.ok) { msg.textContent = "Couldn't save: " + r.message; msg.hidden = false; return; }
    UI.toast("Profile saved");
  };

}, { live: true });
window.addEventListener("hashchange", () => location.reload());
