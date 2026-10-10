/* Profile: yours (with "Share a post") or a friend's. History is newest first. */
(function () {
  const compose = { open: UI.qs("compose") === "1", photos: 0, caption: "", activityId: "", visibility: null, error: "" };

  UI.mount("profile", function render() {
    const { icon, esc } = UI;
    const id = UI.qs("id") || Store.ME;
    const own = id === Store.ME, friend = Store.isFriend(id);
    const p = Store.profile(id);
    const f = Store.friends().find((x) => x.id === id);
    const metA = f && f.metAt && Store.activity(f.metAt);
    const pending = !own && !friend && Store.friendshipWith(id);
    if (compose.visibility === null) compose.visibility = Store.state.settings.postVisibility;

    // Non-friends only see a first name and public hosted activities
    let history = Store.historyFor(id);
    if (!own && !friend) history = history.filter((h) => h.kind === "activity" && h.hosting && h.activity.visibility === "public");
    const attended = own ? Store.stats().attended : Store.state.rsvps.filter((r) => r.profileId === id && r.status === "committed").length;
    const linkable = Store.myCommitments().concat(Store.hosting());

    document.getElementById("main").innerHTML = `
      <div style="max-width:680px">
        ${own ? Social.subnav("me") : `<a class="small" href="friends.html">‹ Friends</a>`}
        <section class="panel${own ? "" : " mt"}">
          <div class="profile-head">${UI.avatar(id, "lg")}
            <div class="grow"><h1 class="mb0">${esc(own || friend ? Store.fullName(id) : p.first)}</h1>
              <p class="muted small mb0">${esc(p.city || "")}${metA ? " · Met at " + esc(metA.title) : ""}</p></div></div>
          ${own || friend ? `${p.bio ? `<p class="mt">${esc(p.bio)}</p>` : ""}<div class="chips">${(p.interests || []).map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : `<p class="muted small mt">You'll see more once you're friends.</p>`}
          <div class="profile-stats">
            <div><b>${attended}</b><span>Activities</span></div>
            <div><b>${own ? Store.friends().length : friend ? "Friend" : "-"}</b><span>${own ? "Friends" : "Status"}</span></div>
            <div><b>${own ? Store.stats().streak : history.filter((h) => h.kind === "post").length}</b><span>${own ? "Day streak" : "Posts"}</span></div>
          </div>
          <div class="row mt">${own
            ? `<button class="btn btn-primary" id="open-compose">${icon("camera", "sm")}Share a post</button><a class="btn" href="activity-new.html">${icon("plus", "sm")}Post an activity</a><a class="btn btn-ghost" href="settings.html#profile">${icon("edit", "sm")}Edit profile</a>`
            : friend ? `<button class="btn btn-primary" id="msg">${icon("message", "sm")}Message</button>`
            : pending ? '<span class="tag grey">Friend request pending</span>' : `<button class="btn" id="add">${icon("userPlus", "sm")}Add friend</button><button class="btn btn-ghost" id="msg">${icon("message", "sm")}Message request</button>`}</div>
        </section>

        ${own && compose.open ? `
        <form class="panel mt" id="composer" novalidate>
          <div class="row-between"><h2 class="mb0">Share a post</h2><button type="button" class="icon-btn" id="close-compose" aria-label="Close">${icon("x")}</button></div>
          <p class="small muted">Photos and text only. Your first post each day earns ${Store.POINTS.post} points.</p>
          <div class="field"><span class="flabel">Photos (1 to 5)</span>
            <div class="photo-picker">${Array.from({ length: 5 }, (_, i) => `<button type="button" class="photo${i < compose.photos ? " filled" : ""}" data-photo="${i}" aria-label="${i < compose.photos ? "Remove photo" : "Add photo"}">${icon(i < compose.photos ? "image" : "plus")}</button>`).join("")}</div>
            <p class="hint">Tap a square to add a placeholder photo. Real uploads come in a later slice.</p></div>
          <div class="field"><label for="caption">Caption</label><textarea id="caption" maxlength="500" placeholder="What did you do?">${esc(compose.caption)}</textarea><div class="hint"><span id="cc">${compose.caption.length}</span> / 500</div></div>
          <div class="grid-2">
            <div class="field"><label for="link">Link an activity <span class="opt">(optional)</span></label><select id="link"><option value="">None</option>${linkable.map((a) => `<option value="${a.id}"${a.id === compose.activityId ? " selected" : ""}>${esc(a.title)}</option>`).join("")}</select></div>
            <div class="field"><label for="vis">Who can see this?</label>${UI.visSelect(compose.visibility, 'id="vis"')}</div>
          </div>
          ${compose.error ? `<div class="alert">${icon("alert", "sm")}<span>${esc(compose.error)}</span></div>` : ""}
          <button class="btn btn-primary btn-block mt">Post</button>
        </form>` : ""}

        <p class="label mt-lg">${own ? "Your posts and activities" : "Posts and activities"}</p>
        <div class="stack">${history.map((h) => (h.kind === "post" ? Social.postCard(h.post, { own }) : Social.activityCard(h.activity))).join("") || '<p class="muted small">Nothing here yet.</p>'}</div>
      </div>`;

    Social.bind();
    const $ = (s) => document.getElementById(s);
    if ($("msg")) $("msg").onclick = () => UI.Messages.openChat(id);
    if ($("add")) $("add").onclick = () => { Store.sendFriendRequest(id); UI.toast("Friend request sent"); };
    if ($("open-compose")) $("open-compose").onclick = () => { compose.open = true; render(); $("caption").focus(); };
    const form = $("composer");
    if (!form) return;
    $("close-compose").onclick = () => { compose.open = false; render(); };
    $("caption").oninput = (e) => { compose.caption = e.target.value; $("cc").textContent = compose.caption.length; };
    $("link").onchange = (e) => (compose.activityId = e.target.value);
    $("vis").onchange = (e) => (compose.visibility = e.target.value);
    form.querySelectorAll("[data-photo]").forEach((b) => (b.onclick = () => { const i = Number(b.dataset.photo); compose.photos = i < compose.photos ? i : i + 1; render(); }));
    form.onsubmit = (e) => {
      e.preventDefault();
      const r = Store.createPost({ caption: compose.caption, photos: compose.photos, activityId: compose.activityId, visibility: compose.visibility });
      if (!r.ok) { compose.error = r.message; render(); return; }
      Object.assign(compose, { open: false, photos: 0, caption: "", activityId: "", error: "" });
      render();
      UI.toast(r.points ? "Posted" : "Posted (post points already earned today)", r.points);
    };
  });
})();
