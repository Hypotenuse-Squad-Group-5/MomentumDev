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

    // Non-friends see public hosted activities and public posts
    let history = Store.historyFor(id);
    if (!own && !friend) {
      history = history.filter((h) =>
        (h.kind === "activity" && h.hosting && h.activity.visibility === "public") ||
        (h.kind === "post" && h.post.visibility === "public")
      );
    }
    const attended = own ? Store.stats().attended : Store.state.rsvps.filter((r) => r.profileId === id && r.status === "committed").length;
    const linkable = Store.myCommitments().concat(Store.hosting());

    document.getElementById("main").innerHTML = `
      <div style="max-width:680px">
        ${own ? Social.subnav("me") : `<a class="small" href="friends.html">‹ Friends</a>`}
        <section class="panel${own ? "" : " mt"}">
          <div class="profile-head">${UI.avatar(id, "lg")}
            <div class="grow"><h1 class="mb0">${esc(own || friend ? Store.fullName(id) : p.first)}</h1>
              <p class="muted small mb0">${esc([p.city, p.state].filter(Boolean).join(", "))}${metA ? " · Met at " + esc(metA.title) : ""}</p>
              ${p.memberSince ? `<p class="muted small mb0">Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>` : ""}</div></div>
          ${own || friend ? `${p.bio ? `<p class="mt">${esc(p.bio)}</p>` : ""}<div class="chips mt">${(p.interests || []).map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : `<p class="muted small mt">You'll see more once you're friends.</p>`}
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
          <p class="small muted">Text posts save to your profile and Supabase database. Your first post each day earns ${Store.POINTS.post} points.</p>
          <div class="field"><span class="flabel">Photos</span>
            <div class="photo-picker">${Array.from({ length: 5 }, (_, i) => `<button type="button" class="photo" disabled aria-label="Photo placeholder">${icon("image")}</button>`).join("")}</div>
            <p class="hint">Photos coming soon. Posts are text-only for now.</p></div>
          <div class="field"><label for="caption">Caption</label><textarea id="caption" maxlength="500" placeholder="What did you do?">${esc(compose.caption)}</textarea><div class="hint"><span id="cc">${compose.caption.length}</span> / 500</div></div>
          <div class="grid-2">
            <div class="field"><label for="link">Link an activity <span class="opt">(optional)</span></label><select id="link"><option value="">None</option>${linkable.map((a) => `<option value="${a.id}"${a.id === compose.activityId ? " selected" : ""}>${esc(a.title)}</option>`).join("")}</select></div>
            <div class="field"><label for="vis">Who can see this?</label>
              <select id="vis" disabled>
                <option value="public" selected>Public (All posts are currently public)</option>
              </select>
              <p class="hint">All posts made are currently public right now.</p>
            </div>
          </div>
          ${compose.error ? `<div class="alert">${icon("alert", "sm")}<span>${esc(compose.error)}</span></div>` : ""}
          <button class="btn btn-primary btn-block mt" id="post-submit-btn">Post</button>
        </form>` : ""}

        <p class="label mt-lg">${own ? "Your posts and activities" : "Posts and activities"}</p>
        <div class="stack">${history.map((h) => (h.kind === "post" ? Social.postCard(h.post, { own }) : Social.activityCard(h.activity))).join("") || (own
          ? `<div class="panel center"><p><b>Nothing here yet.</b></p><p class="muted small">Your posts and the activities you commit to will show up here.</p><button class="btn btn-primary" id="empty-compose">${icon("camera", "sm")}Share your first post</button></div>`
          : '<p class="muted small">Nothing here yet.</p>')}</div>
      </div>`;

    Social.bind();
    const $ = (s) => document.getElementById(s);
    if ($("msg")) $("msg").onclick = () => UI.Messages.openChat(id);
    if ($("add")) $("add").onclick = () => { Store.sendFriendRequest(id); UI.toast("Friend request sent"); };
    if ($("empty-compose")) $("empty-compose").onclick = () => { compose.open = true; render(); $("caption").focus(); };
    if ($("open-compose")) $("open-compose").onclick = () => { compose.open = true; render(); $("caption").focus(); };
    const form = $("composer");
    if (!form) return;
    $("close-compose").onclick = () => { compose.open = false; render(); };
    $("caption").oninput = (e) => { compose.caption = e.target.value; $("cc").textContent = compose.caption.length; };
    $("link").onchange = (e) => (compose.activityId = e.target.value);
    $("vis").onchange = (e) => (compose.visibility = e.target.value);
    form.querySelectorAll("[data-photo]").forEach((b) => (b.onclick = () => { const i = Number(b.dataset.photo); compose.photos = i < compose.photos ? i : i + 1; render(); }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = $("post-submit-btn");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Posting..."; }
      const r = await Store.createPost({ caption: compose.caption, photos: 0, activityId: compose.activityId, visibility: "public" });
      if (!r.ok) {
        compose.error = r.message;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Post"; }
        render();
        return;
      }
      Object.assign(compose, { open: false, photos: 0, caption: "", activityId: "", error: "" });
      render();
      UI.toast(r.points ? "Posted" : "Posted (post points already earned today)", r.points);
    };
  });
})();
