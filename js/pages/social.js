/* Social. Shared pieces + the Feed page.
   Feed = the 10 most recent posts and activities from friends. Newest first, no reshuffling. */
window.Social = {
  subnav(active) {
    return `<nav class="subnav" aria-label="Social">${[["feed", "social.html", "Feed"], ["friends", "friends.html", "Friends"], ["me", "profile.html", "My profile"]]
      .map(([k, h, l]) => `<a href="${h}"${k === active ? ' class="active" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  },
  postCard(p, { own } = {}) {
    const { icon, esc } = UI;
    const a = p.activityId ? Store.activity(p.activityId) : null;
    const n = Math.min(p.photos, 5);
    return `<article class="panel">
      <div class="post-head">${UI.avatar(p.authorId, "", true)}<div class="who"><a class="name" href="profile.html?id=${p.authorId}">${esc(p.authorId === Store.ME ? Store.fullName(Store.ME) : UI.displayName(p.authorId))}</a><div class="tiny muted">${UI.fmtAgo(p.createdAt)} · Post</div></div>
        ${own ? UI.visSelect(p.visibility, `data-vis="${p.id}" aria-label="Who can see this post"`) : `<span class="tag grey">${UI.VIS[p.visibility]}</span>`}</div>
      <div class="photo-grid n${n}">${Array.from({ length: n }, () => `<div class="photo">${icon("image")}</div>`).join("")}</div>
      <p class="mt mb0">${esc(p.caption)}</p>
      ${a ? `<a class="linked-activity" href="activity.html?id=${a.id}">${icon("activity")}<span class="grow"><span class="tiny muted">Activity</span><br><b>${esc(a.title)}</b> · <span class="small">${esc(UI.fmtDay(a.startsAt))}</span></span>${icon("right", "sm")}</a>` : ""}
      ${own ? "" : `<div class="post-actions"><button class="btn btn-sm btn-ghost encourage${Store.encouraged(p.id) ? " on" : ""}" data-enc="${p.id}" aria-pressed="${Store.encouraged(p.id)}">${icon("heart", "sm")}${Store.encouraged(p.id) ? "Encouraged" : "Encourage"}</button>
        <button class="btn btn-sm btn-ghost" data-msg="${p.authorId}">${icon("message", "sm")}Message ${esc(Store.profile(p.authorId).first)}</button></div>`}
    </article>`;
  },
  activityCard(a, { compactPast } = {}) {
    const { icon, esc } = UI;
    const past = Store.isPast(a);
    if (past) {
      const rep = Store.report(a.id, a.hostId) || Store.state.reports.find((r) => r.activityId === a.id);
      // Inactive: basic details only (no location or participants), plus the optional report
      return `<article class="panel" style="opacity:.92">
        <div class="post-head">${UI.avatar(a.hostId, "", true)}<div class="who"><span class="name">${UI.nameLink(a.hostId)}</span><div class="tiny muted">Activity · ${esc(UI.fmtDay(a.startsAt))}</div></div><span class="tag grey">Inactive</span></div>
        <h3>${esc(a.title)}</h3><p class="small muted">${esc(a.type)}</p>
        ${rep ? `<div class="goal-box"><span class="tiny muted">Activity report</span><p class="mb0">${esc(rep.body)}</p></div>` : ""}
      </article>`;
    }
    return `<article class="panel">
      <div class="post-head">${UI.avatar(a.hostId, "", true)}<div class="who"><span class="name">${UI.nameLink(a.hostId)}</span><div class="tiny muted">${UI.fmtAgo(a.createdAt)} · Posted an activity</div></div><span class="tag ok">Active</span></div>
      <div class="photo cover">${icon("camera", "lg")}</div>
      <h3 class="mt">${esc(a.title)}</h3>
      <div class="meta"><span>${icon("clock", "sm")}${esc(UI.fmtRange(a))}</span><span>${icon("activity", "sm")}${esc(a.location)}</span><span>${icon("users", "sm")}${Store.spotsTaken(a.id)} of ${a.max} going</span></div>
      <p class="mb0">${esc(a.description)}</p>
      <div class="post-actions"><a class="btn btn-sm btn-primary" href="activity.html?id=${a.id}">${Store.isGoing(a.id) ? "You're going" : "View & commit"}</a>${a.hostId !== Store.ME ? `<button class="btn btn-sm btn-ghost" data-msg="${a.hostId}" data-act="${a.id}">${icon("message", "sm")}Message host</button>` : ""}</div>
    </article>`;
  },
  bind() {
    document.querySelectorAll("[data-enc]").forEach((b) => (b.onclick = () => Store.toggleEncourage(b.dataset.enc)));
    document.querySelectorAll("[data-msg]").forEach((b) => (b.onclick = () => UI.Messages.openChat(b.dataset.msg, b.dataset.act || null)));
    document.querySelectorAll("[data-vis]").forEach((s) => (s.onchange = () => { Store.setPostVisibility(s.dataset.vis, s.value); UI.toast("Visibility updated"); }));
  },
};

if (document.body.dataset.page === "feed") {
  let shown = null; // ids shown at load; "Check for new posts" only adds newer items
  UI.mount("social", function render() {
    const items = Store.feed();
    shown = new Set(items.map((i) => (i.post ? i.post.id : i.activity.id)));
    document.getElementById("main").innerHTML = `
      <div style="max-width:680px">
        ${Social.subnav("feed")}
        <div class="row-between"><h1 class="mb0">Feed</h1><button class="btn btn-sm" id="refresh">Check for new posts</button></div>
        <p class="small muted">The 10 most recent posts and activities from your friends. When something new arrives, the oldest one drops off.</p>
        <div class="stack">${items.map((i) => (i.kind === "post" ? Social.postCard(i.post) : Social.activityCard(i.activity))).join("") || '<div class="panel center"><p>Your feed is empty. Add some friends!</p></div>'}</div>
        <div class="feed-end mt"><h3>You're all caught up.</h3><p class="muted small">No infinite scroll here. Maybe go find something to do?</p><a class="btn btn-primary" href="activities.html">Browse activities</a></div>
      </div>`;
    Social.bind();
    document.getElementById("refresh").onclick = async () => {
      const before = shown; await Store.loadActivities(true); render();
      const fresh = [...shown].filter((id) => !before.has(id)).length;
      UI.toast(fresh ? fresh + " new" : "Nothing new yet");
    };
  });
}
