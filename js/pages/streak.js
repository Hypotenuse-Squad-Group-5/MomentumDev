/* Momentum: how it works, top speed, and the last 4 weeks. */
UI.mount("home", function render() {
  const { icon } = UI;
  const s = Store.stats();
  // Last 4 weeks as a calendar: Sunday-first rows, this week at the bottom
  const recent = Store.lastDays(1) || [];
  const now = new Date();
  const todayKey = recent.length ? recent[recent.length - 1].date
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dow = new Date(todayKey + "T12:00:00").getDay();
  const past = (Store.lastDays(22 + dow) || []).slice(-(22 + dow)); // from Sunday three weeks ago through today
  const dayAt = (i) => past[i - (22 + dow - past.length)] || { date: (() => { const d = new Date(todayKey + "T12:00:00"); d.setDate(d.getDate() - (21 + dow - i)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })(), gained: false };
  const cells = Array.from({ length: 22 + dow }, (_, i) => dayAt(i)).concat(Array.from({ length: 6 - dow }, () => null)); // later this week
  const weeks = [0, 1, 2, 3].map((w) => cells.slice(w * 7, w * 7 + 7));
  const short = (d) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const long = (d) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const weekLabel = (i) => (i === 3 ? "This week" : i === 2 ? "Last week" : short(weeks[i][0].date));
  const gainedIn4 = (Store.lastDays(28) || []).filter((d) => d.gained).length;
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
      <div class="row-between"><h2 class="mb0">Last 4 weeks</h2><span class="small muted">${gainedIn4} of the last 28 days</span></div>
      <div class="week-grid mt" role="table" aria-label="Days you gained Momentum, last 4 weeks">
        <div class="wk-row wk-head" role="row"><span></span>${["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="dow" role="columnheader">${d}</span>`).join("")}</div>
        ${weeks.map((wk, i) => `<div class="wk-row" role="row"><span class="wk-label">${weekLabel(i)}</span>${wk.map((d) => !d
          ? `<span class="day future" aria-hidden="true"></span>`
          : `<span class="day${d.gained ? " on" : ""}${d.date === todayKey ? " today" : ""}" role="cell" title="${long(d.date)}: ${d.gained ? "gained Momentum" : "no Momentum"}"></span>`).join("")}</div>`).join("")}
      </div>
      <div class="week-key small muted mt"><span class="day on"></span> Gained Momentum <span class="day"></span> Didn't <span class="day today"></span> Today</div>
    </section>

    <section class="panel mt">
      <h2>How Momentum works</h2>
      <p class="mb0">You gain Momentum on a day you do any one of these:</p>
      <ul>
        <li>Check off at least half of your habits (rounded up: 1 of 2, 2 of 3, 3 of 5)</li>
        <li>Finish a lesson</li>
        <li>Show up to an activity</li>
      </ul>
      <p class="mb0">Each day you gain it, your Momentum goes <b>up 1</b>. Each day you miss, it slows <b>down 1</b>, but it never drops below zero, and today never counts against you until it's over. Your top speed is the highest it's ever been.</p>
    </section>
  </div>`;
});
