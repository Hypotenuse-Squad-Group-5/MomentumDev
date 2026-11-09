/* Friends: requests, your list (with "met at"), find people, remove. */
(function () {
  let inputVal = "";
  let submittedQ = "";
  let searchResults = null;
  let searchError = "";
  let searching = false;

  const fmtSince = (p) => (p && p.memberSince
    ? "Member since " + new Date(p.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "");

  UI.mount("social", function render() {
    const { icon, esc } = UI;
    const reqs = Store.incomingRequests(), sent = Store.sentRequests();
    const list = Store.friends();
    const found = searchResults !== null ? searchResults : [];
    const metAt = (id) => { const a = id && Store.activity(id); return a ? "Met at " + a.title : "Friends"; };

    document.getElementById("main").innerHTML = `
      <div style="max-width:680px">
        ${Social.subnav("friends")}
        <h1>Friends</h1>
        <form class="row" id="search">
          <input type="search" style="flex:1" placeholder="Find someone by name" value="${esc(inputVal)}" aria-label="Find people">
          <button class="btn"${searching ? " disabled" : ""}>${icon("search", "sm")}${searching ? "Searching…" : "Search"}</button>
        </form>
        ${searchError ? `<div class="alert mt">${icon("alert", "sm")}<span>${esc(searchError)}</span></div>` : ""}
        ${!searching && submittedQ && searchResults !== null ? `<p class="label mt">Search Results</p><div class="stack">${found.map((id) => {
          const isFriend = Store.isFriend(id);
          const f = Store.friendshipWith(id);
          const p = Store.profile(id);
          const since = fmtSince(p);
          const isReqFromMe = f && f.requesterId === Store.ME && f.status === "pending";
          const isReqToMe = f && f.addresseeId === Store.ME && f.status === "pending";
          let actionHtml = "";
          if (isFriend) {
            actionHtml = '<span class="tag ok">Friends</span>';
          } else if (isReqFromMe) {
            actionHtml = '<span class="tag grey">Requested</span><button class="btn btn-sm btn-ghost" data-cancel="' + f.id + '">Cancel</button>';
          } else if (isReqToMe) {
            actionHtml = '<button class="btn btn-sm btn-primary" data-accept="' + f.id + '">Accept</button><button class="btn btn-sm btn-ghost" data-decline="' + f.id + '">Decline</button>';
          } else {
            actionHtml = '<button class="btn btn-sm" data-add="' + id + '">' + icon("userPlus", "sm") + 'Add friend</button>';
          }
          return `<div class="panel tight person">${UI.avatar(id, "", true)}
            <span class="grow"><a href="profile.html?id=${id}"><b>${esc(isFriend ? Store.fullName(id) : p.first)}</b></a>${since ? `<br><span class="small muted">${esc(since)}</span>` : ""}</span>
            ${actionHtml}</div>`;
        }).join("") || '<p class="muted small">No one found with that name.</p>'}</div>` : ""}

        ${reqs.length ? `<p class="label mt-lg">Friend requests (${reqs.length})</p><div class="stack">${reqs.map((f) => {
          const shared = Store.sharedActivityId(f.requesterId); const sa = shared && Store.activity(shared);
          return `<div class="panel tight person">${UI.avatar(f.requesterId, "", true)}
            <span class="grow"><a href="profile.html?id=${f.requesterId}"><b>${esc(Store.profile(f.requesterId).first)}</b></a><br><span class="small muted">${sa ? "You're both going to " + esc(sa.title) : "Wants to be friends"}</span></span>
            <button class="btn btn-sm btn-primary" data-accept="${f.id}">Accept</button>
            <button class="btn btn-sm btn-ghost" data-decline="${f.id}">Decline</button></div>`;
        }).join("")}</div>` : ""}

        <div class="row-between mt-lg"><p class="label mb0">Your friends (${list.length})</p>
          <label class="small row">Visible to ${UI.visSelect(Store.state.settings.friendsListVisibility, 'id="list-vis" style="width:auto;min-height:32px;padding:3px 8px"')}</label></div>
        <div class="stack mt">${list.map((f) => `
          <div class="panel tight person">${UI.avatar(f.id, "", true)}
            <span class="grow"><a href="profile.html?id=${f.id}"><b>${esc(Store.fullName(f.id))}</b></a><br><span class="small muted">${esc(metAt(f.metAt))}</span></span>
            <button class="btn btn-sm btn-ghost" data-msg="${f.id}" aria-label="Message ${esc(Store.profile(f.id).first)}">${icon("message", "sm")}</button>
            <button class="btn btn-sm btn-danger" data-remove="${f.id}">Remove</button></div>`).join("") || '<p class="muted small">No friends yet. Search for people above or meet them at activities!</p>'}</div>

        ${sent.length ? `<p class="label mt-lg">Sent requests (${sent.length})</p><div class="stack">${sent.map((f) => `
          <div class="panel tight person">${UI.avatar(f.addresseeId, "", true)}
            <span class="grow"><a href="profile.html?id=${f.addresseeId}"><b>${esc(Store.profile(f.addresseeId).first)}</b></a><br><span class="small muted">Request pending</span></span>
            <button class="btn btn-sm btn-ghost" data-cancel="${f.id}">Cancel request</button>
          </div>`).join("")}</div>` : ""}

        <p class="hint mt">Removing a friend doesn't need their permission. Adding one does.</p>
      </div>`;

    const searchForm = document.getElementById("search");
    const searchInput = searchForm.querySelector("input");
    searchInput.oninput = (e) => {
      inputVal = e.target.value;
      if (!inputVal.trim() && (submittedQ || searchResults !== null || searchError)) {
        submittedQ = "";
        searchResults = null;
        searchError = "";
        render();
        const inp = document.querySelector("#search input");
        if (inp) inp.focus();
      }
    };
    searchForm.onsubmit = async (e) => {
      e.preventDefault();
      inputVal = searchInput.value;
      const nextQ = inputVal.trim();
      if (!nextQ) {
        submittedQ = "";
        searchResults = null;
        searchError = "";
        render();
        return;
      }
      submittedQ = nextQ;
      searchError = "";
      searching = true;
      render();
      const res = await Store.searchProfiles(nextQ);
      searching = false;
      if (res.ok) {
        searchResults = res.ids;
        searchError = "";
      } else {
        searchResults = null;
        searchError = res.message || "Could not search profiles.";
      }
      render();
    };
    document.getElementById("list-vis").onchange = (e) => Store.setSetting("friendsListVisibility", e.target.value);
    document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const res = await Store.sendFriendRequest(b.dataset.add);
      if (res.ok) UI.toast("Friend request sent");
      else { UI.toast(res.message || "Could not send request"); render(); }
    }));
    document.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const res = await Store.cancelFriendRequest(b.dataset.cancel);
      if (res.ok) UI.toast("Request cancelled");
      else { UI.toast(res.message || "Could not cancel request"); render(); }
    }));
    document.querySelectorAll("[data-accept]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const res = await Store.acceptFriend(b.dataset.accept);
      if (res.ok) UI.toast("You're now friends");
      else { UI.toast(res.message || "Could not accept request"); render(); }
    }));
    document.querySelectorAll("[data-decline]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const res = await Store.declineFriend(b.dataset.decline);
      if (res.ok) UI.toast("Request declined");
      else { UI.toast(res.message || "Could not decline request"); render(); }
    }));
    document.querySelectorAll("[data-msg]").forEach((b) => (b.onclick = () => UI.Messages.openChat(b.dataset.msg)));
    document.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.remove;
      UI.modal(`<h2>Remove ${esc(Store.fullName(id))}?</h2><p>They won't be notified. You'll stop seeing each other's friends-only posts, and you'll need to send a new request to reconnect.</p>
        <div class="modal-actions"><button class="btn" data-close>Keep friend</button><button class="btn btn-danger" id="do-remove">Remove friend</button></div>`,
        { onMount: (m, close) => (m.querySelector("#do-remove").onclick = async () => {
          const btn = m.querySelector("#do-remove");
          btn.disabled = true;
          const res = await Store.removeFriend(id);
          close();
          if (res.ok) UI.toast("Friend removed");
          else UI.toast(res.message || "Could not remove friend");
        }) });
    }));
  }, { live: true });
})();
