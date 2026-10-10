/* Streak details: everything that feeds the single tracking unit (points ledger). */
UI.mount("home", function render() {
  const { icon, esc } = UI;
  const s = Store.stats();
  const days = Store.lastDays(28);
  const LABEL = { habit: "Habit checked", lesson: "Lesson finished", rsvp: "Committed to an activity", attended: "Went to an activity", post: "First post of the day", rsvp_cancelled: "Cancelled a commitment" };
  const history = Store.pointHistory(12);
  const kinds = ["habit", "lesson", "rsvp", "attended", "post", "rsvp_cancelled"];

  document.getElementById("main").innerHTML = `
  <div style="max-width:820px">
    <a class="small" href="home.html">‹ Home</a>
    <div class="streak-hero mt" style="cursor:default">
      <span class="flame-badge">${icon("flame")}</span>
      <span class="grow"><span class="streak-num">${s.streak}</span> <b>day streak</b>
        <span style="display:block;opacity:.85;font-size:.9rem">${s.doneToday ? "Today's done." : "Check off a habit today to keep it going."} Longest ever: ${s.longest} days.</span></span>
    </div>

    <div class="big-stats mt">
      <div class="big-stat"><b>${s.points}</b><span>Total points</span></div>
      <div class="big-stat"><b>${s.weekPoints}</b><span>Points this week</span></div>
      <div class="big-stat"><b>${s.longest}</b><span>Longest streak (days)</span></div>
      <div class="big-stat"><b>${s.goalsMetDays}</b><span>Days all habits done</span></div>
      <div class="big-stat"><b>${s.attended}</b><span>Activities attended</span></div>
      <div class="big-stat"><b>${s.upcoming}</b><span>Upcoming commitments</span></div>
      <div class="big-stat"><b>${s.habitsChecked}</b><span>Habits checked off</span></div>
      <div class="big-stat"><b>${s.lessonsDone} / ${window.LESSONS ? window.LESSONS.length : 5}</b><span>Lessons complete</span></div>
    </div>

    <section class="panel mt">
      <div class="row-between"><h2 class="mb0">Last 4 weeks</h2><span class="small muted">Darker = more habits done</span></div>
      <div class="heat mt">${days.map((d) => `<span class="${d.count >= 3 ? "l3" : d.count === 2 ? "l2" : d.count === 1 ? "l1" : ""}" title="${d.date}: ${d.count} habit${d.count === 1 ? "" : "s"}"></span>`).join("")}</div>
    </section>

    <div class="grid-2 mt" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <section class="panel">
        <h2>How you earn points</h2>
        ${kinds.map((k) => `<div class="ledger-row"><span>${LABEL[k]}</span><span class="p${Store.POINTS[k] < 0 ? " neg" : ""}">${Store.POINTS[k] > 0 ? "+" : ""}${Store.POINTS[k]}</span></div>`).join("")}
        <p class="hint mt mb0">Your streak counts the days you check off at least one habit. Posting only earns points once a day, so there's no reason to post more than you want to.</p>
      </section>
      <section class="panel">
        <h2>Where your points came from</h2>
        ${kinds.filter((k) => s.byKind[k]).map((k) => `<div class="ledger-row"><span>${LABEL[k]} <span class="muted">×${s.byKind[k].count}</span></span><span class="p${s.byKind[k].points < 0 ? " neg" : ""}">${s.byKind[k].points}</span></div>`).join("")}
        <p class="label mt">Recent</p>
        ${history.map((p) => `<div class="ledger-row"><span>${LABEL[p.kind]}<br><span class="tiny muted">${UI.fmtAgo(p.at)}</span></span><span class="p${p.points < 0 ? " neg" : ""}">${p.points > 0 ? "+" : ""}${p.points}</span></div>`).join("")}
      </section>
    </div>
  </div>`;
});
