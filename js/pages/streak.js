/* Momentum: how it works, top speed, and the last 4 weeks. */
UI.mount("home", function render() {
  const { icon } = UI;
  const s = Store.stats();
  const days = Store.lastDays(28);
  const trend = s.trend || "flat";
  const word = { up: "gaining", flat: "coasting", down: "slowing" }[trend];
  const msg = s.doneToday ? "Momentum gained today. Keep rolling tomorrow."
    : trend === "down" ? "You slowed down yesterday. Gain Momentum today to speed back up."
    : "Nothing yet today. One Momentum action keeps you rolling.";

  document.getElementById("main").innerHTML = `
  <div style="max-width:820px">
    <a class="small" href="home.html">‹ Home</a>
    <div class="streak-hero mt" style="cursor:default" aria-label="Momentum ${s.streak}, ${word}">
      <span class="flame-badge mo-badge">${icon("mo_" + trend, "mo-icon mo-" + trend)}</span>
      <span class="grow"><span class="streak-num">${s.streak}</span> <b>Momentum</b>
        <span style="display:block;opacity:.85;font-size:.9rem">${msg} Top speed: ${s.longest}.</span></span>
    </div>

    <div class="big-stats mt">
      <div class="big-stat"><b>${s.longest}</b><span>Top speed</span></div>
      <div class="big-stat"><b>${s.gainedDays ?? 0}</b><span>Days you gained Momentum</span></div>
      <div class="big-stat"><b>${s.attended}</b><span>Activities attended</span></div>
      <div class="big-stat"><b>${s.upcoming}</b><span>Upcoming commitments</span></div>
      <div class="big-stat"><b>${s.habitsChecked}</b><span>Habits checked off</span></div>
      <div class="big-stat"><b>${s.lessonPercent}%</b><span>Lessons complete</span></div>
    </div>

    <section class="panel mt">
      <div class="row-between"><h2 class="mb0">Last 4 weeks</h2><span class="small muted">Filled = gained Momentum</span></div>
      <div class="heat mt">${days.map((d) => `<span class="${d.gained ? "l3" : ""}" title="${d.date}${d.gained ? ": gained Momentum" : ""}"></span>`).join("")}</div>
    </section>

    <section class="panel mt">
      <h2>How Momentum works</h2>
      <p class="mb0">You gain Momentum on a day you do any one of these:</p>
      <ul>
        <li>Check off at least half of your habits (rounded up: 1 of 2, 2 of 3, 3 of 5)</li>
        <li>Finish a lesson</li>
        <li>Show up to an activity</li>
      </ul>
      <p class="mb0">Each day you gain it, your Momentum goes <b>up 1</b>. Each day you miss, it slows <b>down 2</b>, but it never drops below zero, and today never counts against you until it's over. Your top speed is the highest it's ever been.</p>
    </section>
  </div>`;
});
