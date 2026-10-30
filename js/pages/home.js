/* Home: streak front and center, today's habits, next activity, quick actions */

// Manage mode for the Daily practice card (wrench button): edit, archive, reorder.
let habitManage = false;
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
  const next = Store.myCommitments().find((a) => !Store.isPast(a));
  const invites = Store.plusOneInvites();
  const checkIns = Store.needsCheckIn();
  const lessonN = Store.currentLesson();

  const streakMsg = s.doneToday ? "Today's done. See you tomorrow." : s.streak ? "Check off a habit today to keep it going." : "Check off a habit to start a streak.";

  document.getElementById("main").innerHTML = `
    <p class="muted small mb0">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
    <h1>${greet}, ${esc(me.first)}</h1>

    <div class="home-grid mt">
      <div class="stack">
        <a class="streak-hero" href="streak.html" aria-label="Streak details">
          <span class="flame-badge">${icon("flame")}</span>
          <span class="grow">
            <span class="streak-num">${s.streak}</span> <b>day streak</b>
            <span style="display:block;opacity:.85;font-size:.88rem">${s.points} points · ${streakMsg}</span>
            <span class="week-dots">${days.map((d, i) => `<span class="${d.count ? "on" : ""}${i === 6 ? " today" : ""}" title="${d.date}">${"SMTWTFS"[new Date(d.date + "T12:00").getDay()]}</span>`).join("")}</span>
          </span>
          ${icon("right")}
        </a>

        <div class="quick-actions">
          <a class="btn btn-primary" href="activity-new.html">${icon("plus")}Post an activity</a>
          <a class="btn" href="profile.html?compose=1">${icon("camera")}Share a post</a>
        </div>

        ${invites.map(({ guest, rsvp, activity: a }) => `
          <section class="panel tight">
            <p class="label">+1 invite</p>
            <p class="mb0"><b>${esc(UI.displayName(rsvp.profileId))}</b> wants to bring you to <a href="activity.html?id=${a.id}"><b>${esc(a.title)}</b></a>.</p>
            <p class="small muted">${esc(UI.fmtRange(a))}</p>
            <div class="row"><button class="btn btn-sm btn-primary" data-invite="${guest.id}" data-yes>Accept</button><button class="btn btn-sm" data-invite="${guest.id}">Decline</button></div>
          </section>`).join("")}

        ${checkIns.map((a) => `
          <section class="panel tight">
            <p class="label">Did you go?</p>
            <p class="mb0"><b>${esc(a.title)}</b> · ${esc(UI.fmtDay(a.startsAt))}</p>
            <p class="small muted">Showing up is the whole point. Checking in earns ${Store.POINTS.attended} points.</p>
            <div class="row"><button class="btn btn-sm btn-primary" data-checkin="${a.id}" data-yes>Yes, I went</button><button class="btn btn-sm" data-checkin="${a.id}">I didn't make it</button></div>
          </section>`).join("")}

        <section class="panel" id="practice">
          <div class="row-between">
            <div><p class="label">${habitManage ? '<s>Daily practice</s> Under construction!' : "Daily practice"}</p><h2 class="mb0">Goals & habits</h2></div>
            <div class="row">
              ${habitManage ? "" : `<span class="tag">${doneCount} of ${habits.length} today</span>`}
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
                <span class="tiny muted">+${Store.POINTS.habit}</span></button>`;
            }).join("") || (habitManage
              ? '<p class="muted small">No habits yet. Add one below, or finish a lesson to get one.</p>'
              : `<div class="center"><p class="muted small">No habits yet. Add one, or finish a lesson to get one.</p><button class="btn btn-sm" id="habit-start">${icon("plus", "sm")}Add a habit</button></div>`)}
          </div>
          ${habitManage && Store.archivedHabits().length ? `
            <p class="label mt-lg">Archived</p>
            <div class="stack">${Store.archivedHabits().map((h) => `<div class="row-between soft"><span class="muted">${esc(h.title)}</span><button class="btn btn-sm" data-restore="${h.id}">Restore</button></div>`).join("")}</div>
            <p class="hint">Archived habits keep their history, so your streak and points stay accurate.</p>` : ""}
          ${habitManage ? `<form class="row mt" id="add-habit"><input type="text" class="grow" style="flex:1" placeholder="Add a habit, e.g. Read 10 pages before bed" maxlength="80" aria-label="New habit"><button class="btn">${icon("plus", "sm")}Add</button></form>` : ""}
        </section>
      </div>

      <aside class="stack">
        <section>
          <p class="label">Your next activity</p>
          ${next ? `<a class="panel tight" href="activity.html?id=${next.id}">
              <div class="row" style="flex-wrap:nowrap;gap:12px">${UI.dateBadge(next.startsAt)}
                <div class="grow"><h3 class="mb0">${esc(next.title)}</h3><p class="small muted mb0">${esc(UI.fmtRange(next))}</p><span class="tag ok">${icon("check", "sm")}Committed</span></div>${icon("right")}</div></a>`
            : `<div class="panel tight"><p class="mb0">Nothing on the calendar yet.</p><a class="btn btn-sm mt" href="activities.html">Find an activity</a></div>`}
        </section>
        <section class="panel tight">
          <p class="label">Explore</p>
          <a class="tile" href="activities.html"><span class="ico">${icon("activity")}</span><span class="grow"><b>Activities</b><br><span class="small muted">Find something to do nearby</span></span>${icon("right", "sm")}</a>
          <a class="tile" href="${lessonN ? "lesson.html?n=" + lessonN : "lessons.html"}"><span class="ico">${icon("book")}</span><span class="grow"><b>${lessonN ? "Lesson " + lessonN : "Lessons"}</b><br><span class="small muted">${lessonN ? "Pick up where you left off" : "All lessons complete"}</span></span>${icon("right", "sm")}</a>
          <a class="tile" href="social.html"><span class="ico">${icon("users")}</span><span class="grow"><b>Social</b><br><span class="small muted">See what friends have been doing</span></span>${icon("right", "sm")}</a>
          <a class="tile" href="calendar.html"><span class="ico">${icon("calendar")}</span><span class="grow"><b>Calendar</b><br><span class="small muted">${s.upcoming} upcoming commitment${s.upcoming === 1 ? "" : "s"}</span></span>${icon("right", "sm")}</a>
        </section>
      </aside>
    </div>`;

  // ---- Manage mode ----
  document.getElementById("habit-manage").onclick = () => { habitManage = !habitManage; render(); };
  document.querySelectorAll("[data-restore]").forEach((b) => (b.onclick = () => { Store.restoreHabit(b.dataset.restore); UI.toast("Habit restored"); }));
  document.querySelectorAll("[data-tools]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openHabitMenu(b); }));
  enableHabitDrag(document.getElementById("habits"));

  document.querySelectorAll("[data-habit]").forEach((b) => (b.onclick = () => {
    const r = Store.toggleHabit(b.dataset.habit);
    if (r.done) UI.toast(r.streakUp ? "Streak extended to " + Store.streak().current + " days" : "Habit checked", r.points);
  }));
  const start = document.getElementById("habit-start");
  if (start) start.onclick = () => { habitManage = true; render(); document.querySelector("#add-habit input").focus(); };
  const addForm = document.getElementById("add-habit");
  if (addForm) addForm.onsubmit = (e) => {
    e.preventDefault(); const inp = e.target.querySelector("input");
    if (!inp.value.trim()) { inp.classList.add("invalid"); inp.focus(); return; }
    Store.addHabit(inp.value); UI.toast("Habit added");
  };
  document.querySelectorAll("[data-invite]").forEach((b) => (b.onclick = () => {
    const r = Store.respondPlusOne(b.dataset.invite, b.hasAttribute("data-yes"));
    if (!r.ok && r.message) UI.alertModal("Couldn't accept", UI.esc(r.message), { error: true });
    else if (b.hasAttribute("data-yes")) UI.toast("You're going. It's on your calendar.", r.points);
  }));
  document.querySelectorAll("[data-checkin]").forEach((b) => (b.onclick = () => {
    const went = b.hasAttribute("data-yes"); const r = Store.checkIn(b.dataset.checkin, went);
    UI.toast(went ? "Nice. That counts." : "Thanks for being honest.", r.points);
  }));
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
    Store.archiveHabit(id);
    undoToast(`Archived "${h ? h.title : "habit"}"`, () => Store.restoreHabit(id, { keepPlace: true }));
  };
}

function editHabitModal(id) {
  const h = Store.habits().find((x) => x.id === id); if (!h) return;
  UI.modal(`<h2>Edit habit</h2>
    <form id="edit-habit" novalidate>
      <div class="field"><label for="edit-title">Habit</label><input id="edit-title" type="text" maxlength="80" value="${UI.esc(h.title)}"><div class="err" hidden></div></div>
      ${h.goalText ? `<div class="goal-box small"><b>Lesson ${h.lessonNumber} goal</b><br>${UI.esc(h.goalText)}</div><p class="hint">The lesson goal itself can't be edited here.</p>` : ""}
      <p class="hint">Renaming keeps this habit's streak and points.</p>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>`, {
    onMount(m, close) {
      const inp = m.querySelector("#edit-title"); inp.focus(); inp.select();
      m.querySelector("#edit-habit").onsubmit = (e) => {
        e.preventDefault();
        const r = Store.editHabit(id, inp.value);
        if (!r.ok) { const er = m.querySelector(".err"); er.textContent = r.message; er.hidden = false; inp.classList.add("invalid"); return; }
        close(); UI.toast("Habit renamed");
      };
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
        if (order().join() !== before) { Store.reorderHabits(order()); UI.toast("Order saved"); }
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
