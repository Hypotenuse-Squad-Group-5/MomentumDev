/* Profile: yours (with "Share a post") or someone else's. History is newest first. */
(function () {
  const compose = { open: UI.qs("compose") === "1", caption: "", activityId: "", visibility: null, error: "" };
  let fetchedId = null;
  let loadingProfile = false;
  let missingProfile = false;
  let profileLoadError = "";

  UI.mount("profile", function render() {
    const { icon, esc } = UI;
    const id = UI.qs("id") || Store.ME;
    const own = id === Store.ME, friend = Store.isFriend(id);

    if (!own && fetchedId !== id) {
      fetchedId = id;
      loadingProfile = true;
      missingProfile = false;
      profileLoadError = "";
      Store.loadProfile(id).then((res) => {
        if ((UI.qs("id") || Store.ME) !== id) return;
        loadingProfile = false;
        if (!res.ok) {
          profileLoadError = res.message || "Could not load this profile.";
        } else if (!res.profile) {
          missingProfile = true;
        }
        render();
      });
    }

    if (!own && loadingProfile) {
      document.getElementById("main").innerHTML = `
        <div style="max-width:680px">
          <a class="small" href="friends.html">‹ Friends</a>
          <p class="muted mt">Loading profile…</p>
        </div>`;
      return;
    }

    if (!own && ((false) || missingProfile)) {
      document.getElementById("main").innerHTML = `
        <div style="max-width:680px">
          <a class="small" href="friends.html">‹ Friends</a>
          <div class="panel mt">
            <h1>Profile not found</h1>
            <p class="muted small mb0">This account doesn't exist or isn't available.</p>
          </div>
        </div>`;
      return;
    }

    const p = Store.profile(id);
    Store.loadInterestsFor(id); // interests are readable by signed-in members (migration 012)
    if (!own && profileLoadError && !p.memberSince && p.first === "Someone") {
      document.getElementById("main").innerHTML = `
        <div style="max-width:680px">
          <a class="small" href="friends.html">‹ Friends</a>
          <div class="panel mt">
            <h1>Couldn't load profile</h1>
            <p class="muted small mb0">${esc(profileLoadError)}</p>
          </div>
        </div>`;
      return;
    }

    const f = Store.friends().find((x) => x.id === id);
    const metA = f && f.metAt && Store.activity(f.metAt);
    const pending = !own && !friend && Store.friendshipWith(id);
    const blockedByMe = !own && Store.hasBlocked && Store.hasBlocked(id);
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
              ${metA ? `<p class="muted small mb0">Met at ${esc(metA.title)}</p>` : ""}
              ${p.memberSince ? `<p class="muted small mb0">Member since ${new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>` : ""}</div></div>
          ${(own || friend) && p.bio ? `<p class="mt">${esc(p.bio)}</p>` : ""}
          ${(p.interests || []).length ? `<div class="chips mt">${p.interests.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>` : ""}
          ${own || friend ? "" : `<p class="muted small mt">You'll see more once you're friends.</p>`}
          <div class="profile-stats">
            <div><b>${attended}</b><span>Activities</span></div>
            <div><b>${own ? Store.friends().length : friend ? "Friend" : "-"}</b><span>${own ? "Friends" : "Status"}</span></div>
            <div><b>${own ? Store.stats().streak : history.filter((h) => h.kind === "post").length}</b><span>${own ? "Day streak" : "Posts"}</span></div>
          </div>
          <div class="row mt">${own
            ? `<button class="btn btn-primary" id="open-compose">${icon("post", "sm")}Share a post</button><a class="btn" href="activity-new.html">${icon("plus", "sm")}Post an activity</a><a class="btn btn-ghost" href="settings.html#profile">${icon("edit", "sm")}Edit profile</a>`
            : friend
              ? (blockedByMe
                  ? `<span class="tag grey">Blocked</span><button class="btn btn-sm" id="unblock-user">Unblock</button><button class="btn btn-danger btn-sm" id="remove-friend">Remove friend</button>`
                  : `<button class="btn btn-primary" id="msg">${icon("message", "sm")}Message</button><button class="btn btn-danger btn-sm" id="remove-friend">Remove friend</button>`)
            : pending && pending.requesterId === Store.ME ? `<span class="tag grey">Request sent</span><button class="btn btn-ghost btn-sm" id="cancel-req">Cancel request</button>${blockedByMe ? `<span class="tag grey">Blocked</span><button class="btn btn-sm" id="unblock-user">Unblock</button>` : ""}`
            : pending && pending.addresseeId === Store.ME ? `<button class="btn btn-primary btn-sm" id="accept-req">Accept friend request</button><button class="btn btn-ghost btn-sm" id="decline-req">Decline</button>${blockedByMe ? `<span class="tag grey">Blocked</span><button class="btn btn-sm" id="unblock-user">Unblock</button>` : ""}`
            : blockedByMe ? `<button class="btn" id="add">${icon("userPlus", "sm")}Add friend</button><span class="tag grey">Blocked</span><button class="btn btn-sm" id="unblock-user">Unblock</button>`
            : `<button class="btn" id="add">${icon("userPlus", "sm")}Add friend</button><button class="btn btn-ghost" id="msg">${icon("message", "sm")}${Store.requestStatusFor && Store.requestStatusFor(id).kind === "active" ? "Message" : "Message request"}</button>`}</div>
        </section>

        ${own && compose.open ? `
        <form class="panel mt" id="composer" novalidate>
          <div class="row-between"><h2 class="mb0">Share a post</h2><button type="button" class="icon-btn" id="close-compose" aria-label="Close">${icon("x")}</button></div>
          <p class="small muted">Text posts save to your profile and Supabase database.</p>
          <div class="field"><label for="caption">Post</label><textarea id="caption" maxlength="500" placeholder="What did you do?">${esc(compose.caption)}</textarea><div class="hint"><span id="cc">${compose.caption.length}</span> / 500</div></div>
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
          ? `<div class="panel center"><p><b>Nothing here yet.</b></p><p class="muted small">Your posts and the activities you commit to will show up here.</p><button class="btn btn-primary" id="empty-compose">${icon("post", "sm")}Share your first post</button></div>`
          : '<p class="muted small">Nothing here yet.</p>')}</div>
      </div>`;

    Social.bind();
    const $ = (s) => document.getElementById(s);
    if ($("msg")) $("msg").onclick = () => UI.Messages.openChat(id);
    if ($("unblock-user")) $("unblock-user").onclick = () => UI.confirmUnblock(id);
    if ($("add")) $("add").onclick = async () => {
      $("add").disabled = true;
      const res = await Store.sendFriendRequest(id);
      if (res.ok) UI.toast("Friend request sent");
      else { UI.toast(res.message || "Could not send friend request"); render(); }
    };
    if ($("cancel-req")) $("cancel-req").onclick = async () => {
      $("cancel-req").disabled = true;
      const res = await Store.cancelFriendRequest(id);
      if (res.ok) UI.toast("Request cancelled");
      else { UI.toast(res.message || "Could not cancel request"); render(); }
    };
    if ($("accept-req")) $("accept-req").onclick = async () => {
      $("accept-req").disabled = true;
      const fRow = Store.friendshipWith(id);
      if (fRow) {
        const res = await Store.acceptFriend(fRow.id);
        if (res.ok) UI.toast("You're now friends");
        else { UI.toast(res.message || "Could not accept request"); render(); }
      } else {
        render();
      }
    };
    if ($("decline-req")) $("decline-req").onclick = async () => {
      $("decline-req").disabled = true;
      const fRow = Store.friendshipWith(id);
      if (fRow) {
        const res = await Store.declineFriend(fRow.id);
        if (res.ok) UI.toast("Request declined");
        else { UI.toast(res.message || "Could not decline request"); render(); }
      } else {
        render();
      }
    };
    if ($("remove-friend")) $("remove-friend").onclick = () => {
      UI.modal(`<h2>Remove ${esc(Store.fullName(id))}?</h2><p>You will stop seeing each other's friends-only posts and activities.</p><div class="modal-actions"><button class="btn" data-close>Keep friend</button><button class="btn btn-danger" id="do-remove">Remove friend</button></div>`, {
        onMount: (m, close) => (m.querySelector("#do-remove").onclick = async () => {
          const btn = m.querySelector("#do-remove");
          btn.disabled = true;
          const res = await Store.removeFriend(id);
          close();
          if (res.ok) UI.toast("Friend removed");
          else UI.toast(res.message || "Could not remove friend");
        })
      });
    };
    if ($("empty-compose")) $("empty-compose").onclick = () => { compose.open = true; render(); $("caption").focus(); };
    if ($("open-compose")) $("open-compose").onclick = () => { compose.open = true; render(); $("caption").focus(); };
    const form = $("composer");
    if (!form) return;
    $("close-compose").onclick = () => { compose.open = false; render(); };
    $("caption").oninput = (e) => { compose.caption = e.target.value; $("cc").textContent = compose.caption.length; };
    $("link").onchange = (e) => (compose.activityId = e.target.value);
    $("vis").onchange = (e) => (compose.visibility = e.target.value);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = $("post-submit-btn");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Posting..."; }
      const r = await Store.createPost({ caption: compose.caption, activityId: compose.activityId, visibility: "public" });
      if (!r.ok) {
        compose.error = r.message;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Post"; }
        render();
        return;
      }
      Object.assign(compose, { open: false, caption: "", activityId: "", error: "" });
      render();
      UI.toast("Posted");
    };
  });
})();
