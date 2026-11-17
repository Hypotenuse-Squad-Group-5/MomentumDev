/* Home: Momentum front and center, my habits, quick actions, Notifications panel */

// Manage mode for the Daily practice card (wrench button): edit, archive, reorder.
let habitManage = false;
// Notifications panel: shows the top few; "Show all" opens the rest (remembered on this device)
const NOTES_SHOWN = 4;
let notesOpen = false;
try { notesOpen = localStorage.getItem("momentum.notes.open") === "1"; } catch (e) { /* storage blocked */ }
let notesTimer = null;
// Phones stack Home in one column with habits first, so the urgent notifications (starting
// soon, cancelled) move into a slim strip above the habits. Desktop shows everything in the panel.
const WIDE = typeof matchMedia === "function" ? matchMedia("(min-width: 960px)") : null;
const URGENT = ["soon", "cancelled"];
const HABIT_ICONS = {
  wrench: '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  hammer: '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
  grip: '<svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
};

UI.mount("home", function render() {
  const { icon, esc } = UI;
  const me = Store.profile(Store.ME);
  const s = Store.stats();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const days = Store.lastDays(7);
  const habits = Store.habits();
  const doneCount = habits.filter((h) => Store.isHabitDone(h.id)).length;
  const allNotes = Store.notificationsList();
  const phone = WIDE ? !WIDE.matches : false;
  const urgent = phone ? allNotes.filter((n) => URGENT.includes(n.kind)) : [];
  const notes = phone ? allNotes.filter((n) => !URGENT.includes(n.kind)) : allNotes;

  // Momentum card message (no toast for these: the card shows today's state)
  const left = Math.max(0, s.habitsNeeded - s.habitsDone);
  const ways = (s.activeHabits ? `Check off ${left} more habit${left === 1 ? "" : "s"}` : "Add a habit") + ", finish a lesson, or show up to an activity";
  const momentumMsg = s.doneToday ? "Momentum gained. Keep rolling tomorrow."
    : s.trend === "down" ? "You slowed down yesterday. Gain Momentum today to speed back up."
    : ways + " to gain Momentum.";

  // ---- Notifications panel ----
  function noteItem(n) {
    const a = n.activity;
    switch (n.kind) {
      case "soon":
        return `<a class="note warn" href="activity.html?id=${a.id}">${icon("clock", "sm")}<span class="grow"><b>${esc(a.title)}</b> starts in ${n.mins} min<br><span class="small muted">${n.role === "hosting" ? "You're hosting" : "You're going"} · ${esc(a.location)}</span></span>${icon("right", "sm")}</a>`;
      case "upcoming":
        return `<a class="note" href="activity.html?id=${a.id}">${UI.dateBadge(a.startsAt)}<span class="grow"><span class="small muted">Next activity you're ${n.role === "hosting" ? "hosting" : "going to"}</span><br><b>${esc(a.title)}</b><br><span class="small muted">${esc(UI.fmtRange(a))}</span></span>${icon("right", "sm")}</a>`;
      case "checkin":
        return `<div class="note warn">${icon("check", "sm")}<span class="grow">Did you go to <b>${esc(a.title)}</b>?<br><span class="small muted">${esc(UI.fmtDay(a.startsAt))}</span>
          <span class="row mt-sm"><button class="btn btn-sm btn-primary" data-checkin="${a.id}" data-yes>Yes, I went</button><button class="btn btn-sm" data-checkin="${a.id}">I didn't make it</button></span></span></div>`;
      case "cancelled":
        return `<div class="note danger">${icon("alert", "sm")}<span class="grow"><b>${esc(n.note.title)}</b><br><span class="small">${esc(n.note.body)}</span>
          ${a ? `<br><a class="small" href="activity.html?id=${a.id}">View activity</a>` : ""}</span><button class="icon-btn sm" data-dismiss="${n.note.id}" aria-label="Dismiss" title="Dismiss">${icon("x", "sm")}</button></div>`;
      case "plusone":
        return `<div class="note">${UI.avatar(n.rsvp.profileId, "sm")}<span class="grow"><b>${esc(UI.displayName(n.rsvp.profileId))}</b> invited you as their +1 to <a href="activity.html?id=${a.id}"><b>${esc(a.title)}</b></a><br><span class="small muted">${esc(UI.fmtRange(a))}</span>
          <span class="row mt-sm"><button class="btn btn-sm btn-primary" data-invite="${n.guest.id}" data-yes>Accept</button><button class="btn btn-sm" data-invite="${n.guest.id}">Decline</button></span></span></div>`;
      case "friend":
        return `<div class="note">${UI.avatar(n.request.requesterId, "sm")}<span class="grow"><b>${UI.nameLink(n.request.requesterId)}</b> sent you a friend request
          <span class="row mt-sm"><button class="btn btn-sm btn-primary" data-accept-friend="${n.request.id}">Accept</button><button class="btn btn-sm" data-decline-friend="${n.request.id}">Decline</button></span></span></div>`;
      case "message": {
        const other = Store.otherMember(n.convo), msgs = n.convo.messages || [], last = msgs[msgs.length - 1] || {};
        return `<button class="note" data-open-convo="${n.convo.id}">${UI.avatar(other, "sm")}<span class="grow">${n.request ? "Message request from" : "New message from"} <b>${esc(UI.displayName(other))}</b>${last.body ? `<br><span class="small muted note-preview">${esc(last.body)}</span>` : ""}</span>${icon("right", "sm")}</button>`;
      }
    }
    return "";
  }
  function notesPanel() {
    const shown = notesOpen ? notes : notes.slice(0, NOTES_SHOWN);
    return `<aside class="panel home-notes" aria-labelledby="notes-h">
      <div class="row-between"><h2 class="mb0" id="notes-h">Notifications</h2>${notes.length ? `<span class="tag">${notes.length}</span>` : ""}</div>
      ${notes.length
        ? `<div class="notes mt">${shown.map(noteItem).join("")}</div>
           ${notes.length > NOTES_SHOWN ? `<button class="btn btn-sm btn-ghost btn-block mt" id="notes-more" aria-expanded="${notesOpen}">${notesOpen ? "Show less" : `Show all (${notes.length})`}</button>` : ""}`
        : `<p class="muted small mt mb0">${urgent.length ? "Nothing else right now." : "You're all caught up."}</p><a class="btn btn-sm mt" href="activities.html">Find an activity</a>`}
    </aside>`;
  }

  document.getElementById("main").innerHTML = `
    <p class="muted small mb0">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
    <h1>${greet}, ${esc(me.first)}</h1>

    <div class="home-grid mt">
      <div class="stack home-top">
        <a class="streak-hero" href="streak.html" aria-label="Momentum ${s.streak}, ${UI.MOMENTUM_WORD[s.trend]}. Details">
          <span class="flame-badge mo-badge">${UI.momentumIcon(s.trend)}</span>
          <span class="grow">
            <span class="streak-num">${s.streak}</span> <b>Momentum</b>
            <span style="display:block;opacity:.85;font-size:.88rem">${momentumMsg}</span>
            <span class="week-dots">${days.map((d, i) => `<span class="${d.gained ? "on" : ""}${i === 6 ? " today" : ""}" title="${d.date}${d.gained ? ": gained Momentum" : ""}">${"SMTWTFS"[new Date(d.date + "T12:00").getDay()]}</span>`).join("")}</span>
          </span>
          ${icon("right")}
        </a>

        <div class="quick-actions">
          <a class="btn btn-primary" href="activity-new.html">${icon("plus")}Post an activity</a>
          <a class="btn" href="profile.html?compose=1">${icon("post")}Share a post</a>
        </div>

      </div>

      ${urgent.length ? `<div class="notes urgent-strip" role="region" aria-label="Needs your attention">${urgent.map(noteItem).join("")}</div>` : ""}

      ${notesPanel()}

        <section class="panel home-habits" id="practice">
          <div class="row-between">
            <div>${habitManage ? '<p class="label">Trail maintenance</p>' : ""}<h2 class="mb0">My habits</h2></div>
            <div class="row">
              <span class="tag">${habitManage ? `${habits.length} of ${Store.MAX_ACTIVE_HABITS} active` : `${doneCount} of ${habits.length} today`}</span>
              ${habitManage
                ? `<button class="btn btn-sm btn-primary" id="habit-manage">${icon("check", "sm")}Done</button>`
                : `<button class="icon-btn" id="habit-manage" aria-label="Manage habits" title="Manage habits" style="width:32px;height:32px">${HABIT_ICONS.wrench}</button>`}
            </div>
          </div>
          <div class="stack mt" id="habits">
            ${habits.map((h) => {
              if (habitManage) {
                return `<div class="habit manage" data-id="${h.id}">
                  <button class="grip" data-grip aria-label="Reorder ${esc(h.title)}. Drag, or use the arrow keys." title="Hold and drag to reorder">${HABIT_ICONS.grip}</button>
                  <span class="grow"><span class="title">${esc(h.title)}</span>${h.lessonNumber ? `<br><span class="tag grey">From Lesson ${h.lessonNumber}</span>` : ""}</span>
                  <button class="icon-btn" data-tools="${h.id}" aria-label="Options for ${esc(h.title)}" aria-haspopup="menu" style="width:34px;height:34px">${HABIT_ICONS.hammer}</button>
                </div>`;
              }
              const done = Store.isHabitDone(h.id);
              return `<button class="habit${done ? " done" : ""}" data-habit="${h.id}" aria-pressed="${done}">
                <span class="box">${done ? icon("check", "sm") : ""}</span>
                <span class="grow"><span class="title">${esc(h.title)}</span>${h.lessonNumber ? `<br><span class="tag grey">From Lesson ${h.lessonNumber}</span>` : ""}</span>
                </button>`;
            }).join("")}
            ${habitManage
              ? (habits.length ? "" : '<p class="muted small">No habits yet. Add one below, or finish a lesson to get one.</p>')
              : Array.from({ length: Math.max(0, Store.MAX_ACTIVE_HABITS - habits.length) }, () =>
                  `<button class="habit habit-slot" data-slot>${icon("plus", "sm")}<span class="grow">Add a habit</span></button>`).join("")}
          </div>
          ${habitManage && Store.archivedHabits().length ? `
            <p class="label mt-lg">Archived · ${Store.archivedHabits().length} of ${Store.MAX_ARCHIVED_HABITS}</p>
            <div class="stack">${Store.archivedHabits().map((h) => `<div class="row-between soft"><span class="muted grow">${esc(h.title)}</span><div class="row"><button class="btn btn-sm" data-restore="${h.id}">Restore</button><button class="btn btn-sm btn-danger solid" data-delete="${h.id}">Delete</button></div></div>`).join("")}</div>
            <p class="hint">Deleting a habit removes it and its check-ins for good. Your Momentum stays.</p>` : ""}
          ${habitManage ? `<form class="row mt" id="add-habit"><input type="text" class="grow" style="flex:1" placeholder="Add a habit, e.g. Read 10 pages before bed" maxlength="80" aria-label="New habit"><button class="btn">${icon("plus", "sm")}Add</button></form>` : ""}
        </section>
    </div>`;

  // ---- Manage mode ----
  document.getElementById("habit-manage").onclick = () => { habitManage = !habitManage; render(); };
  document.querySelectorAll("[data-restore]").forEach((b) => (b.onclick = () => {
    const r = Store.restoreHabit(b.dataset.restore);
    if (!r.ok && r.code === "max_active") { UI.toast(r.message); UI.attention("[data-tools]"); }
  }));
  document.querySelectorAll("[data-delete]").forEach((b) => (b.onclick = () => deleteHabitModal(b.dataset.delete)));
  document.querySelectorAll("[data-tools]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openHabitMenu(b); }));
  enableHabitDrag(document.getElementById("habits"));

  // Checking/unchecking is visible on its own; only a change in today's Momentum gets a toast.
  document.querySelectorAll("[data-habit]").forEach((b) => (b.onclick = () => {
    const r = Store.toggleHabit(b.dataset.habit);
    if (r.gainedNow) UI.toast("You gained Momentum!");
    else if (r.lostNow) UI.toast("You lost today's Momentum.");
  }));
  document.querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => { habitManage = true; render(); document.querySelector("#add-habit input").focus(); }));
  const addForm = document.getElementById("add-habit");
  if (addForm) addForm.onsubmit = async (e) => {
    e.preventDefault(); const inp = e.target.querySelector("input");
    if (!Store.canAddHabit()) { UI.toast(Store.MAX_ACTIVE_MSG); UI.attention("[data-tools]"); return; }
    if (!inp.value.trim()) { inp.classList.add("invalid"); inp.focus(); return; }
    const button = addForm.querySelector("button");
    if (button.disabled) return;
    button.disabled = true;
    try { await Store.addHabit(inp.value); }
    catch (error) {
      if (error.code === "max_active" || /5 active habits/.test(error.message)) { UI.toast(Store.MAX_ACTIVE_MSG); UI.attention("[data-tools]"); }
      else UI.alertModal("Couldn't add habit", UI.esc(error.message), { error: true });
    }
    finally { button.disabled = false; }
  };
  // These wait for the database (it has the final say on spots and check-ins)
  const busy = (b) => (b.closest(".row") || b.parentElement).querySelectorAll("button").forEach((x) => (x.disabled = true));
  document.querySelectorAll("[data-invite]").forEach((b) => (b.onclick = async () => {
    const yes = b.hasAttribute("data-yes"); busy(b);
    const r = await Store.respondPlusOne(b.dataset.invite, yes);
    if (!r.ok) UI.alertModal(yes ? "Couldn't accept" : "Couldn't decline", UI.esc(r.message || "Please try again."), { error: true });
    else if (yes) UI.toast("You're going. It's on your calendar.");
  }));
  document.querySelectorAll("[data-checkin]").forEach((b) => (b.onclick = async () => {
    const went = b.hasAttribute("data-yes"); busy(b);
    const r = await Store.checkIn(b.dataset.checkin, went);
    if (!r.ok) return UI.alertModal("Couldn't save", UI.esc(r.message || "Please try again."), { error: true });
    UI.toast(!went ? "Thanks for being honest." : r.gainedNow ? "You gained Momentum!" : "Attendance saved.");
  }));
  document.querySelectorAll("[data-accept-friend], [data-decline-friend]").forEach((b) => (b.onclick = async () => {
    const yes = b.hasAttribute("data-accept-friend"); busy(b);
    const r = yes ? await Store.acceptFriend(b.dataset.acceptFriend) : await Store.declineFriend(b.dataset.declineFriend);
    if (!r.ok) { UI.toast(r.message || "Please try again."); render(); }
    else if (yes) UI.toast("You're now friends");
  }));
  document.querySelectorAll("[data-dismiss]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const r = await Store.dismissNotification(b.dataset.dismiss);
    if (!r.ok) { UI.toast("Couldn't dismiss: " + r.message); b.disabled = false; }
  }));
  document.querySelectorAll("[data-open-convo]").forEach((b) => (b.onclick = () => UI.Messages.show("thread", b.dataset.openConvo)));
  const more = document.getElementById("notes-more");
  if (more) more.onclick = () => {
    notesOpen = !notesOpen;
    try { localStorage.setItem("momentum.notes.open", notesOpen ? "1" : "0"); } catch (e) { /* storage blocked */ }
    render();
  };
  // "Starts in N min" stays current while Home is open
  if (WIDE && !WIDE.__home) { WIDE.__home = true; WIDE.addEventListener("change", () => { if (document.getElementById("notes-h")) render(); }); }
  if (!notesTimer && typeof setInterval === "function") notesTimer = setInterval(() => { if (document.getElementById("notes-h")) render(); }, 60000);
});

// Hammer menu: Edit, Archive. Opens upward if there's no room below.
function openHabitMenu(btn) {
  document.querySelectorAll(".habit-menu").forEach((m) => m.remove());
  const id = btn.dataset.tools, row = btn.closest(".habit");
  const menu = document.createElement("div");
  menu.className = "habit-menu"; menu.setAttribute("role", "menu");
  menu.innerHTML = `<button role="menuitem" data-act="edit">${UI.icon("edit", "sm")}Edit</button><button role="menuitem" data-act="archive">${UI.icon("download", "sm")}Archive</button>`;
  row.appendChild(menu);
  if (row.getBoundingClientRect().bottom + menu.offsetHeight + 12 > window.innerHeight) menu.classList.add("up");
  menu.querySelector("button").focus();
  const close = () => { menu.remove(); document.removeEventListener("click", outside); document.removeEventListener("keydown", esc); };
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === "Escape") { close(); btn.focus(); } };
  setTimeout(() => { document.addEventListener("click", outside); document.addEventListener("keydown", esc); });
  menu.querySelector('[data-act="edit"]').onclick = () => { close(); editHabitModal(id); };
  menu.querySelector('[data-act="archive"]').onclick = () => {
    close();
    const h = Store.habits().find((x) => x.id === id);
    const r = Store.archiveHabit(id);
    if (!r.ok && r.code === "archive_full") { UI.toast(r.message); UI.attention("[data-delete]", true); return; }
    undoToast(`Archived "${h ? h.title : "habit"}"`, () => Store.restoreHabit(id, { keepPlace: true }));
  };
}

function editHabitModal(id) {
  const h = Store.habits().find((x) => x.id === id); if (!h) return;
  UI.modal(`<h2>Edit habit</h2>
    <form id="edit-habit" novalidate>
      <div class="field"><label for="edit-title">Habit</label><input id="edit-title" type="text" maxlength="80" value="${UI.esc(h.title)}"><div class="err" hidden></div></div>
      ${h.goalText ? `<div class="goal-box small"><b>Lesson ${h.lessonNumber} goal</b><br>${UI.esc(h.goalText)}</div><p class="hint">The lesson goal itself can't be edited here.</p>` : ""}
      <p class="hint">Renaming keeps this habit's history.</p>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>`, {
    onMount(m, close) {
      const inp = m.querySelector("#edit-title"); inp.focus(); inp.select();
      m.querySelector("#edit-habit").onsubmit = (e) => {
        e.preventDefault();
        const r = Store.editHabit(id, inp.value);
        if (!r.ok) { const er = m.querySelector(".err"); er.textContent = r.message; er.hidden = false; inp.classList.add("invalid"); return; }
        close();
      };
    },
  });
}

// Delete an archived habit for good (asks first).
function deleteHabitModal(id) {
  const h = Store.archivedHabits().find((x) => x.id === id); if (!h) return;
  UI.modal(`<h2>Delete habit?</h2>
    <p>Delete "${UI.esc(h.title)}" forever? Its check-in history goes with it. This can't be undone.</p>
    <p class="hint">Your Momentum stays the same.</p>
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-danger solid" id="confirm-delete">Delete</button></div>`, {
    onMount(m, close) {
      m.querySelector("#confirm-delete").onclick = () => { Store.deleteHabit(id); close(); };
      m.querySelector("[data-close]").focus();
    },
  });
}

// A toast with an Undo button (used after archiving).
function undoToast(text, onUndo) {
  let box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast";
  t.innerHTML = `<span>${UI.esc(text)}</span><button class="btn btn-sm" style="min-height:28px;padding:2px 10px">Undo</button>`;
  t.querySelector("button").onclick = () => { onUndo(); t.remove(); };
  box.appendChild(t); setTimeout(() => t.remove(), 6000);
}

// Hold the grip, drag up or down, release. Arrow keys work on the grip too.
function enableHabitDrag(list) {
  if (!list) return;
  const order = () => [...list.querySelectorAll(".habit[data-id]")].map((r) => r.dataset.id);
  list.querySelectorAll("[data-grip]").forEach((grip) => {
    const row = grip.closest(".habit");
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const before = order().join();
      const rect = row.getBoundingClientRect();
      const grabOffset = e.clientY - (rect.top + rect.height / 2);
      row.classList.add("dragging");
      const move = (ev) => {
        const y = ev.clientY;
        const prev = row.previousElementSibling, next = row.nextElementSibling;
        if (prev && prev.dataset.id && y < prev.getBoundingClientRect().top + prev.offsetHeight / 2) list.insertBefore(row, prev);
        else if (next && next.dataset.id && y > next.getBoundingClientRect().top + next.offsetHeight / 2) list.insertBefore(next, row);
        row.style.transform = "none";
        const natural = row.getBoundingClientRect().top + row.offsetHeight / 2;
        row.style.transform = `translateY(${y - natural - grabOffset}px)`;
      };
      const up = () => {
        grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
        row.classList.remove("dragging"); row.style.transform = "";
        if (order().join() !== before) Store.reorderHabits(order());
      };
      grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
    });
    grip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const ids = order(), i = ids.indexOf(row.dataset.id), j = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      Store.reorderHabits(ids);
      const again = document.querySelector(`.habit[data-id="${row.dataset.id}"] [data-grip]`); if (again) again.focus();
    });
  });
}