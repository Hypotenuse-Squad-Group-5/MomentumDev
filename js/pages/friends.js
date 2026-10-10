/* Friends: requests, your list (with "met at"), find people, remove. */
(function () {
  let q = "";
  UI.mount("social", function render() {
    const { icon, esc } = UI;
    const reqs = Store.incomingRequests(), sent = Store.sentRequests();
    const list = Store.friends();
    const found = q ? Object.keys(Store.state.profiles).filter((id) => id !== Store.ME && !Store.isFriend(id) && Store.fullName(id).toLowerCase().includes(q.toLowerCase())) : [];
    const metAt = (id) => { const a = id && Store.activity(id); return a ? "Met at " + a.title : "Friends"; };

    document.getElementById("main").innerHTML = `
      <div style="max-width:680px">
        ${Social.subnav("friends")}
        <h1>Friends</h1>
        <form class="row" id="search"><input type="search" style="flex:1" placeholder="Find someone by name" value="${esc(q)}" aria-label="Find people"><button class="btn">${icon("search", "sm")}Search</button></form>
        ${q ? `<p class="label mt">Results</p><div class="stack">${found.map((id) => {
          const pending = Store.friendshipWith(id);
          return `<div class="panel tight person">${UI.avatar(id)}<span class="grow"><b>${esc(Store.profile(id).first)}</b><br><span class="small muted">${esc(Store.profile(id).city || "")}</span></span>
            ${pending ? '<span class="tag grey">Requested</span>' : `<button class="btn btn-sm" data-add="${id}">${icon("userPlus", "sm")}Add friend</button>`}</div>`;
        }).join("") || '<p class="muted small">No one found.</p>'}</div>` : ""}

        ${reqs.length ? `<p class="label mt-lg">Friend requests (${reqs.length})</p><div class="stack">${reqs.map((f) => {
          const shared = Store.sharedActivityId(f.requesterId); const sa = shared && Store.activity(shared);
          return `<div class="panel tight person">${UI.avatar(f.requesterId)}<span class="grow"><b>${esc(Store.profile(f.requesterId).first)}</b><br><span class="small muted">${sa ? "You're both going to " + esc(sa.title) : "Wants to be friends"}</span></span>
            <button class="btn btn-sm btn-primary" data-accept="${f.id}">Accept</button><button class="btn btn-sm" data-decline="${f.id}">Decline</button></div>`;
        }).join("")}</div>` : ""}

        <div class="row-between mt-lg"><p class="label mb0">Your friends (${list.length})</p>
          <label class="small row">Visible to ${UI.visSelect(Store.state.settings.friendsListVisibility, 'id="list-vis" style="width:auto;min-height:32px;padding:3px 8px"')}</label></div>
        <div class="stack mt">${list.map((f) => `
          <div class="panel tight person">${UI.avatar(f.id, "", true)}
            <span class="grow"><a href="profile.html?id=${f.id}"><b>${esc(Store.fullName(f.id))}</b></a><br><span class="small muted">${esc(metAt(f.metAt))}</span></span>
            <button class="btn btn-sm btn-ghost" data-msg="${f.id}" aria-label="Message ${esc(Store.profile(f.id).first)}">${icon("message", "sm")}</button>
            <button class="btn btn-sm btn-danger" data-remove="${f.id}">Remove</button></div>`).join("") || '<p class="muted small">No friends yet. Go to an activity and meet some!</p>'}</div>
        ${sent.length ? `<p class="hint mt">Waiting on: ${sent.map((f) => esc(Store.profile(f.addresseeId).first)).join(", ")}</p>` : ""}
        <p class="hint mt">Removing a friend doesn't need their permission. Adding one does.</p>
      </div>`;

    document.getElementById("search").onsubmit = (e) => { e.preventDefault(); q = e.target.querySelector("input").value.trim(); render(); };
    document.getElementById("list-vis").onchange = (e) => Store.setSetting("friendsListVisibility", e.target.value);
    document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { Store.sendFriendRequest(b.dataset.add); UI.toast("Friend request sent"); }));
    document.querySelectorAll("[data-accept]").forEach((b) => (b.onclick = () => { Store.acceptFriend(b.dataset.accept); UI.toast("You're now friends"); }));
    document.querySelectorAll("[data-decline]").forEach((b) => (b.onclick = () => Store.declineFriend(b.dataset.decline)));
    document.querySelectorAll("[data-msg]").forEach((b) => (b.onclick = () => UI.Messages.openChat(b.dataset.msg)));
    document.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.remove;
      UI.modal(`<h2>Remove ${esc(Store.fullName(id))}?</h2><p>They won't be notified. You'll stop seeing each other's friends-only posts, and you'll need to send a new request to reconnect.</p>
        <div class="modal-actions"><button class="btn" data-close>Keep friend</button><button class="btn btn-danger" id="do-remove">Remove friend</button></div>`,
        { onMount: (m, close) => (m.querySelector("#do-remove").onclick = () => { Store.removeFriend(id); close(); UI.toast("Friend removed"); }) });
    }));
  });
})();
