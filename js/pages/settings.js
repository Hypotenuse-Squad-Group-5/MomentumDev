/* Settings: General (privacy, notifications) + Profile. Changes save instantly. */
UI.mount("settings", function render() {
  const { icon, esc } = UI;
  const s = Store.state.settings, p = Store.profile(Store.ME);
  const tab = location.hash === "#profile" ? "profile" : "general";
  const sw = (k, title, sub) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><input type="checkbox" class="switch" data-k="${k}"${s[k] ? " checked" : ""}></label>`;
  const sel = (k, title, sub, opts) => `<label class="setting-row"><span class="grow">${title}${sub ? `<br><span class="small muted">${sub}</span>` : ""}</span><select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${s[k] === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const vis = Object.entries(UI.VIS);
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
        <button class="btn btn-block" id="reset">Reset demo data</button>
      </div>
      <p class="hint mt mb0">Reset puts back the demo habits, friends, messages, and RSVPs in this browser. It doesn't touch Supabase.</p>
    </section>`
    : `
    <form class="panel" id="profile-form">
      <div class="profile-head">${UI.avatar(Store.ME, "lg")}<button type="button" class="btn btn-sm" disabled>${icon("camera", "sm")}Change photo (later slice)</button></div>
      <div class="grid-2 mt">
        <div class="field"><label for="first">First name</label><input id="first" type="text" value="${esc(p.first)}" required></div>
        <div class="field"><label for="last">Last name</label><input id="last" type="text" value="${esc(p.last)}"></div>
      </div>
      <div class="field"><label for="email">Email</label><input id="email" type="email" value="${esc(p.email || "")}"></div>
      <div class="field"><label for="phone">Phone</label><input id="phone" type="tel" value="${esc(p.phone || "")}"></div>
      <div class="field"><label for="address">Home address</label><input id="address" type="text" value="${esc(p.address || "")}"><div class="hint">${icon("lock", "sm")} Private. Only used to sort activities by distance.</div></div>
      <div class="field"><label for="city">City</label><input id="city" type="text" value="${esc(p.city || "")}"></div>
      <div class="grid-2">
        <div class="field"><label for="gender">Gender</label><select id="gender">${["Prefer not to say", "Man", "Woman", "Another option"].map((g) => `<option${p.gender === g ? " selected" : ""}>${g}</option>`).join("")}</select></div>
        <div class="field"><label for="birthday">Birthday</label><input id="birthday" type="date" value="${esc(p.birthday || "")}"></div>
      </div>
      <div class="field"><label for="bio">Bio</label><textarea id="bio" maxlength="160" style="min-height:80px">${esc(p.bio || "")}</textarea></div>
      <div class="field"><span class="flabel">Interests</span><div class="chips">${INTERESTS.map((i) => `<label class="chip"><input type="checkbox" value="${i}"${(p.interests || []).includes(i) ? " checked" : ""}>${i}</label>`).join("")}</div><div class="hint">Used to filter and suggest activities.</div></div>
      <button class="btn btn-primary btn-block">Save changes</button>
    </form>`}
  </div>`;

  document.querySelectorAll("[data-k]").forEach((el) => (el.onchange = () => { Store.setSetting(el.dataset.k, el.type === "checkbox" ? el.checked : el.value); UI.toast("Saved"); }));
  const so = document.getElementById("sign-out"); if (so) so.onclick = () => Store.signOut();
  const rs = document.getElementById("reset");
  if (rs) rs.onclick = () => UI.modal(`<h2>Reset demo data?</h2><p>This clears everything you've done in this browser and restores the demo content.</p><div class="modal-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-danger" id="do-reset">Reset</button></div>`,
    { onMount: (m, close) => (m.querySelector("#do-reset").onclick = () => { Store.reset(); Store.signIn(); close(); UI.toast("Demo data reset"); }) });
  const pf = document.getElementById("profile-form");
  if (pf) pf.onsubmit = (e) => {
    e.preventDefault();
    const v = (id) => pf.querySelector("#" + id).value.trim();
    if (!v("first")) { pf.querySelector("#first").classList.add("invalid"); pf.querySelector("#first").focus(); return; }
    Store.updateProfile({ first: v("first"), last: v("last"), email: v("email"), phone: v("phone"), address: v("address"), city: v("city"), gender: v("gender"), birthday: v("birthday"), bio: v("bio"), interests: [...pf.querySelectorAll(".chip input:checked")].map((x) => x.value) });
    UI.toast("Profile saved");
  };
}, { live: true });
window.addEventListener("hashchange", () => location.reload());
