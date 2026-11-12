/* Habit streaks and activity progress. */
UI.mount("home", function render() {
  const { icon } = UI;
  const s = Store.stats();
  const days = Store.lastDays(28);

  document.getElementById("main").innerHTML = `
  <div style="max-width:820px">
    <a class="small" href="home.html">‹ Home</a>
    <div class="streak-hero mt" style="cursor:default">
      <span class="flame-badge">${icon("flame")}</span>
      <span class="grow"><span class="streak-num">${s.streak}</span> <b>day streak</b>
        <span style="display:block;opacity:.85;font-size:.9rem">${s.doneToday ? "Today's done." : "Check off a habit today to keep it going."} Longest ever: ${s.longest} days.</span></span>
    </div>

    <div class="big-stats mt">
      <div class="big-stat"><b>${s.longest}</b><span>Longest streak (days)</span></div>
      <div class="big-stat"><b>${s.goalsMetDays}</b><span>Days all habits done</span></div>
      <div class="big-stat"><b>${s.attended}</b><span>Activities attended</span></div>
      <div class="big-stat"><b>${s.upcoming}</b><span>Upcoming commitments</span></div>
      <div class="big-stat"><b>${s.habitsChecked}</b><span>Habits checked off</span></div>
      <div class="big-stat"><b>${s.lessonPercent}%</b><span>Lessons complete</span></div>
    </div>

    <section class="panel mt">
      <div class="row-between"><h2 class="mb0">Last 4 weeks</h2><span class="small muted">Darker = more habits done</span></div>
      <div class="heat mt">${days.map((d) => `<span class="${d.count >= 3 ? "l3" : d.count === 2 ? "l2" : d.count === 1 ? "l1" : ""}" title="${d.date}: ${d.count} habit${d.count === 1 ? "" : "s"}"></span>`).join("")}</div>
    </section>

    <p class="hint mt">Your streak counts the days you check off at least one habit.</p>
  </div>`;
});
