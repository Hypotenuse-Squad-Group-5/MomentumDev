/* Activity details: who's going, message host, commit (+1), cancel, add to calendar */
UI.mount("activities", function render() {
  const { icon, esc } = UI;
  const main = document.getElementById("main");
  const a = Store.activity(UI.qs("id"));
  if (!a) { main.innerHTML = `<a class="small" href="activities.html">‹ Back to activities</a><div class="panel mt center"><h2>Activity not found</h2><p class="muted">It may have been removed, or it isn't visible to you.</p></div>`; return; }

  const past = Store.isPast(a), mine = a.hostId === Store.ME, going = Store.isGoing(a.id);
  const rsvp = Store.myRsvp(a.id), invite = Store.myGuestInvite(a.id);
  const myGuest = rsvp && rsvp.status === "committed" ? Store.state.guests.find((g) => g.rsvpId === rsvp.id) : null;
  const people = Store.attendees(a.id);
  const taken = Store.spotsTaken(a.id), need = Math.max(0, a.min - taken), full = taken >= a.max;
  const addr = going || mine ? Store.address(a.id) : null;

  // Who's going: friends = full profile, non-friends = first name, hidden = counted only
  let hidden = 0;
  const rows = people.map((p) => {
    const via = p.plusOneOf ? `<span class="tag grey">${esc(p.plusOneOf === Store.ME ? "Your" : UI.displayName(p.plusOneOf) + "'s")} +1</span>` : "";
    if (p.kind === "guest") return `<div class="attendee"><span class="avatar sm anon">${esc(p.name[0])}</span><span class="grow">${esc(p.name)}</span>${via}</div>`;
    const id = p.profileId;
    if (id !== Store.ME && !Store.isFriend(id) && Store.profile(id).attendeeDisplay === "hidden") { hidden++; return ""; }
    return `<div class="attendee">${UI.avatar(id, "sm", Store.isFriend(id))}<span class="grow">${UI.nameLink(id)}${Store.isFriend(id) ? ' <span class="tag ok">Friend</span>' : ""}</span>${via}</div>`;
  }).join("");

  const reports = Store.state.reports.filter((r) => r.activityId === a.id);

  main.innerHTML = `
    <div class="narrow" style="max-width:720px">
    <a class="small" href="activities.html">‹ Back to activities</a>
    <article class="stack mt">
      <div class="photo cover">${icon("camera", "lg")}</div>
      <div>
        <div class="row"><span class="tag">${esc(a.type)}</span><span class="tag grey">${UI.VIS[a.visibility] || "Public"}</span>
          ${past ? '<span class="tag grey">Ended</span>' : going ? `<span class="tag ok">${icon("check", "sm")}You're going</span>` : mine ? '<span class="tag flame">You\'re hosting</span>' : need ? `<span class="tag warn">Needs ${need} more to happen</span>` : full ? '<span class="tag grey">Full</span>' : ""}</div>
        <h1 class="mt">${esc(a.title)}</h1>
        <div class="row-between">
          <div class="person">${UI.avatar(a.hostId, "", Store.isFriend(a.hostId) || mine)}<div><b>${UI.nameLink(a.hostId)}</b><div class="small muted">Host</div></div></div>
          ${mine ? "" : `<button class="btn btn-sm" id="msg-host">${icon("message", "sm")}Message host</button>`}
        </div>
      </div>

      <div class="panel">
        <dl class="kv">
          <dt>${icon("clock", "sm")}When</dt><dd>${esc(UI.fmtRange(a))}</dd>
          <dt>${icon("activity", "sm")}Where</dt><dd>${esc(a.location)}${UI.distanceMi(a) != null ? ` <span class="muted">· ${UI.fmtMi(UI.distanceMi(a))} away</span>` : ""}<br>
            ${addr ? `<span class="tag ok">${icon("lock", "sm")}Address unlocked</span> <b>${esc(addr)}</b>` : `<span class="small muted">${icon("lock", "sm")} The exact address appears after you commit.</span>`}</dd>
          <dt>${icon("users", "sm")}Group</dt><dd>${taken} going · needs at least ${a.min} · max ${a.max}</dd>
          <dt>${icon("target", "sm")}Activity</dt><dd>${esc(a.activityName)}</dd>
          ${a.bring ? `<dt>${icon("check", "sm")}Bring</dt><dd>${esc(a.bring)}</dd>` : ""}
        </dl>
      </div>

      <section><h2>About</h2><p>${esc(a.description)}</p></section>

      <section class="panel">
        <div class="row-between"><h2 class="mb0">Who's going</h2><span class="small muted">${taken} of ${a.max}</span></div>
        <div class="attendee">${UI.avatar(a.hostId, "sm", Store.isFriend(a.hostId))}<span class="grow">${UI.nameLink(a.hostId)}</span><span class="tag flame">Host</span></div>
        ${rows}
        ${hidden ? `<div class="attendee"><span class="avatar sm anon">+${hidden}</span><span class="grow muted">${hidden} more ${hidden === 1 ? "person keeps their" : "people keep their"} name private</span></div>` : ""}
        <p class="hint mt mb0">Friends show with their full profile. Everyone else shows by first name only.</p>
      </section>

      ${reports.length ? `<section><h2>Activity reports</h2>${reports.map((r) => `<div class="goal-box"><b>${UI.nameLink(r.authorId)}</b><p class="mb0">${esc(r.body)}</p></div>`).join("")}</section>` : ""}
    </article>

    ${past ? "" : `<div class="cta-bar">${
      invite && invite.status === "pending" ? `<p class="mb0 small"><b>${esc(UI.displayName(Store.state.rsvps.find((r) => r.id === invite.rsvpId).profileId))}</b> invited you as their +1.</p><div class="row mt"><button class="btn btn-primary grow" id="accept-invite">Accept and commit</button><button class="btn" id="decline-invite">Decline</button></div>`
      : mine ? `<p class="mb0"><b>You're hosting.</b> ${need ? `${need} more ${need === 1 ? "person needs" : "people need"} to commit for this to happen.` : "You've hit the minimum. It's happening."}</p>`
      : going ? `<div class="row-between"><span><b>You're committed.</b>${myGuest ? ` <span class="small muted">+1: ${myGuest.guestFirstName ? esc(myGuest.guestFirstName) : esc(UI.displayName(myGuest.guestProfileId))} (${myGuest.status === "pending" ? "waiting for them to accept" : myGuest.status})</span>` : ""}</span>
          <div class="row"><button class="btn btn-sm" id="add-cal">${icon("calendar", "sm")}Add to calendar</button>${rsvp ? `<button class="btn btn-sm btn-danger" id="cancel">Cancel</button>` : ""}</div></div>`
      : full ? `<button class="btn btn-block" disabled>This activity is full</button>`
      : `<button class="btn btn-primary btn-block" id="commit">Commit to this activity</button><p class="hint center mb0">Commitments count. You get ${Store.CANCELS_PER_MONTH} cancellations a month.</p>`
    }</div>`}
    </div>`;

  const $ = (id) => document.getElementById(id);
  if ($("msg-host")) $("msg-host").onclick = () => UI.Messages.openChat(a.hostId, a.id);
  if ($("add-cal")) $("add-cal").onclick = () => UI.addToCalendarModal(a);
  if ($("accept-invite")) $("accept-invite").onclick = () => {
    const r = Store.respondPlusOne(invite.id, true);
    if (!r.ok) return UI.alertModal("Couldn't accept", esc(r.message), { error: true });
    UI.flash("You're going. It's on your calendar.", r.points); location.href = "calendar.html?added=" + a.id;
  };
  if ($("decline-invite")) $("decline-invite").onclick = () => { Store.respondPlusOne(invite.id, false); UI.toast("Invite declined"); };
  if ($("cancel")) $("cancel").onclick = () => {
    const c = Store.canCancel(a.id), left = Store.cancellationsLeft();
    if (!c.ok) return UI.alertModal("You can't cancel this one", esc(c.reason) + " You're still committed.", { error: true });
    UI.modal(`<h2>Cancel your commitment?</h2>
      <p>People are counting on you, and it may drop the group below the minimum.</p>
      <div class="alert warn">${icon("alert", "sm")}<span>This uses 1 of your ${left} remaining cancellation${left === 1 ? "" : "s"} this month and removes the ${Store.POINTS.rsvp} points you earned for committing.${myGuest ? " Your +1 is removed too." : ""}</span></div>
      <div class="modal-actions"><button class="btn" data-close>Keep my spot</button><button class="btn btn-danger" id="confirm-cancel">Cancel commitment</button></div>`,
      { onMount: (m, close) => (m.querySelector("#confirm-cancel").onclick = () => { const r = Store.cancel(a.id); close(); if (r.ok) UI.toast("Commitment cancelled. " + r.left + " left this month.", r.points); else UI.alertModal("Couldn't cancel", esc(r.message), { error: true }); }) });
  };
  if ($("commit")) $("commit").onclick = () => openCommit(a);
});

function openCommit(a) {
  const { icon, esc } = UI;
  const friendOptions = Store.friends().map((f) => f.id).filter((id) => !Store.attendees(a.id).some((p) => p.profileId === id) && id !== a.hostId);
  const left = Store.cancellationsLeft();
  UI.modal(`
    <h2>Commit to ${esc(a.title)}?</h2>
    <p class="muted">${esc(UI.fmtRange(a))}</p>
    <div class="alert warn">${icon("alert", "sm")}<span><b>Commitments count.</b> You have ${left} cancellation${left === 1 ? "" : "s"} left this month, and you can't cancel within 24 hours of the start.</span></div>
    <fieldset class="choice-list mt" style="border:0;padding:0;margin-top:16px">
      <legend class="flabel" style="font-weight:600;margin-bottom:6px">Bring a +1?</legend>
      <label><input type="radio" name="plus" value="none" checked><span>Just me</span></label>
      <label><input type="radio" name="plus" value="friend"${friendOptions.length ? "" : " disabled"}><span>A friend on Momentum<br><span class="small muted">They have to accept. Until they do, they don't hold a spot.</span></span></label>
      <div id="friend-pick" hidden style="margin:0 0 8px 28px"><select id="friend-id">${friendOptions.map((id) => `<option value="${id}">${esc(Store.fullName(id))}</option>`).join("")}</select></div>
      <label><input type="radio" name="plus" value="guest"><span>A guest who isn't on Momentum<br><span class="small muted">Just their first name. They count right away.</span></span></label>
      <div id="guest-pick" hidden style="margin:0 0 8px 28px"><input type="text" id="guest-name" placeholder="Guest's first name" maxlength="40"><div class="err" id="guest-err" hidden>Add your guest's first name.</div></div>
    </fieldset>
    <label class="check mt"><input type="checkbox" id="ack"> <span>I'll show up. I understand cancelling is limited.</span></label>
    <div class="err" id="ack-err" hidden>Check the box to commit.</div>
    <div class="alert mt" id="commit-err" hidden></div>
    <div class="modal-actions"><button class="btn" data-close>Not yet</button><button class="btn btn-primary" id="do-commit">Commit</button></div>`,
    {
      onMount(m, close) {
        const sel = () => m.querySelector("input[name=plus]:checked").value;
        m.querySelectorAll("input[name=plus]").forEach((r) => (r.onchange = () => { m.querySelector("#friend-pick").hidden = sel() !== "friend"; m.querySelector("#guest-pick").hidden = sel() !== "guest"; }));
        m.querySelector("#do-commit").onclick = () => {
          const ack = m.querySelector("#ack").checked; m.querySelector("#ack-err").hidden = ack;
          let plus = null;
          if (sel() === "friend") plus = { type: "friend", profileId: m.querySelector("#friend-id").value };
          if (sel() === "guest") {
            const n = m.querySelector("#guest-name").value.trim(); m.querySelector("#guest-err").hidden = !!n;
            if (!n) return; plus = { type: "guest", name: n };
          }
          if (!ack) return;
          const r = Store.commit(a.id, plus);
          if (r.ok) { UI.flash("You're committed to " + a.title, r.points); location.href = "calendar.html?added=" + a.id; return; }
          close();
          if (r.code === "login") return UI.alertModal("Sign in to commit", "You need to be signed in to commit to an activity.", { error: true, actions: '<button class="btn" data-close>Back to activity</button><a class="btn btn-primary" href="index.html">Sign in</a>' });
          if (r.code === "conflict") return UI.alertModal("You can't commit to this one", `It overlaps or starts within 30 minutes of something you're already committed to:</p><div class="soft"><b>${esc(r.conflict.title)}</b><br><span class="small">${esc(UI.fmtRange(r.conflict))}</span></div><p class="hint mt">Committed activities need at least 30 minutes between one ending and the next starting.`, { error: true, actions: '<button class="btn btn-primary" data-close>Back to activity</button>' });
          UI.alertModal("Couldn't commit", esc(r.message), { error: true });
        };
      },
    });
}
