/* Home: streak front and center, today's habits, next activity, quick actions */
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

        <section class="panel">
          <div class="row-between"><div><p class="label">Daily practice</p><h2 class="mb0">Goals & habits</h2></div><span class="tag">${doneCount} of ${habits.length} today</span></div>
          <div class="stack mt" id="habits">
            ${habits.map((h) => {
              const done = Store.isHabitDone(h.id);
              return `<button class="habit${done ? " done" : ""}" data-habit="${h.id}" aria-pressed="${done}">
                <span class="box">${done ? icon("check", "sm") : ""}</span>
                <span class="grow"><span class="title">${esc(h.title)}</span>${h.lessonNumber ? `<br><span class="tag grey">From Lesson ${h.lessonNumber}</span>` : ""}</span>
                <span class="tiny muted">+${Store.POINTS.habit}</span></button>`;
            }).join("") || '<p class="muted small">No habits yet. Add one below, or finish a lesson to get one.</p>'}
          </div>
          <form class="row mt" id="add-habit"><input type="text" class="grow" style="flex:1" placeholder="Add a habit, e.g. Read 10 pages before bed" maxlength="80" aria-label="New habit"><button class="btn">${icon("plus", "sm")}Add</button></form>
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

  document.querySelectorAll("[data-habit]").forEach((b) => (b.onclick = () => {
    const r = Store.toggleHabit(b.dataset.habit);
    if (r.done) UI.toast(r.streakUp ? "Streak extended to " + Store.streak().current + " days" : "Habit checked", r.points);
  }));
  document.getElementById("add-habit").onsubmit = (e) => {
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
