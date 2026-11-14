/* Activities: filterable feed of upcoming activities (PL-7, PL-8, PL-9) */
(function () {
  const f = { open: true, timeOfDay: "any", dateRange: "upcoming", commitment: "any", visibility: "all", types: [], name: "", min: "3", max: "" };

  const inDateRange = (activity, range) => {
    const start = new Date(activity.startsAt);
    if (Number.isNaN(start.getTime())) return false;

    if (range === "past") return Store.isPast(activity);
    if (Store.isPast(activity)) return false;
    if (range === "upcoming") return true;

    const now = new Date();
    if (range === "week") {
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const nextWeek = new Date(weekStart);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return start >= weekStart && start < nextWeek;
    }
    if (range === "month") {
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    }
    if (range === "year") {
      return start.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const inTimeOfDay = (activity, timeOfDay) => {
    if (timeOfDay === "any") return true;
    const start = new Date(activity.startsAt);
    if (Number.isNaN(start.getTime())) return false;
    const hour = start.getHours();
    if (timeOfDay === "morning") return hour >= 5 && hour < 12;
    if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
    return hour >= 17 || hour < 5;
  };

  UI.mount("activities", function render() {
    const { icon, esc } = UI;
    const activities = Store.allActivities().map((a) => ({ ...a, dist: UI.distanceMi(a) }));
    let list = activities.filter((a) =>
      inDateRange(a, f.dateRange) &&
      inTimeOfDay(a, f.timeOfDay) &&
      (f.visibility === "all" || (f.visibility === "friends" ? a.visibility === "friends" : a.visibility === "public")) &&
      (f.commitment === "any" || (f.commitment === "committed" ? Store.isGoing(a.id) : !Store.isGoing(a.id))) &&
      (!f.types.length || f.types.includes(a.type)) &&
      (!f.name || (a.activityName + " " + a.title).toLowerCase().includes(f.name.toLowerCase())) &&
      (!f.min || a.min >= Number(f.min)) &&
      (!f.max || a.max <= Number(f.max)));
    const activeCount = (f.timeOfDay !== "any" ? 1 : 0) + (f.dateRange !== "upcoming" ? 1 : 0) + (f.visibility !== "all" ? 1 : 0) + (f.commitment !== "any" ? 1 : 0) + f.types.length + (f.name ? 1 : 0) + (f.min ? 1 : 0) + (f.max ? 1 : 0);

    const types = Store.types().map((t) => t.name); // from the activity_types table

    document.getElementById("main").innerHTML = `
      <div class="page-head">
        <div><h1>Activities</h1><p class="muted mb0">Things happening near you. Commit, then show up.</p></div>
        <div class="row"><button class="btn" id="toggle-filter" aria-expanded="${f.open}">${icon("filter", "sm")}Filter${activeCount ? " (" + activeCount + ")" : ""}</button><a class="btn btn-primary" href="activity-new.html">${icon("plus", "sm")}Post an activity</a></div>
      </div>
      ${Store.loadError ? `<div class="alert">${icon("alert", "sm")}<span>Couldn't load activities from Supabase: ${esc(Store.loadError)}</span></div>` : ""}

      <section class="stack">
        <form class="panel" id="filters" ${f.open ? "" : "hidden"}>
          <div class="filter-panel">
            <div class="field"><label for="f-time">Time of day</label>
              <select id="f-time">
                <option value="any"${f.timeOfDay === "any" ? " selected" : ""}>Any time</option>
                <option value="morning"${f.timeOfDay === "morning" ? " selected" : ""}>Morning (5 AM–12 PM)</option>
                <option value="afternoon"${f.timeOfDay === "afternoon" ? " selected" : ""}>Afternoon (12–5 PM)</option>
                <option value="evening"${f.timeOfDay === "evening" ? " selected" : ""}>Evening (5 PM–5 AM)</option>
              </select></div>
            <div class="field"><label for="f-date">Date range</label>
              <select id="f-date">
                <option value="upcoming"${f.dateRange === "upcoming" ? " selected" : ""}>All upcoming</option>
                <option value="week"${f.dateRange === "week" ? " selected" : ""}>This week</option>
                <option value="month"${f.dateRange === "month" ? " selected" : ""}>This month</option>
                <option value="year"${f.dateRange === "year" ? " selected" : ""}>This year</option>
                <option value="past"${f.dateRange === "past" ? " selected" : ""}>Past events</option>
              </select></div>
            <div class="field"><label for="f-vis">Visibility</label>
              <select id="f-vis">
                <option value="all"${f.visibility === "all" ? " selected" : ""}>All</option>
                <option value="friends"${f.visibility === "friends" ? " selected" : ""}>Friends Only</option>
                <option value="public"${f.visibility === "public" ? " selected" : ""}>Public</option>
              </select></div>
            <div class="field"><label for="f-name">Activity title</label><input id="f-name" type="search" maxlength="50" value="${esc(f.name)}" placeholder="e.g. board games, hiking"></div>
            <div class="field"><label for="f-commitment">Commitment</label>
              <select id="f-commitment">
                <option value="any"${f.commitment === "any" ? " selected" : ""}>Any</option>
                <option value="committed"${f.commitment === "committed" ? " selected" : ""}>Committed to</option>
                <option value="not-committed"${f.commitment === "not-committed" ? " selected" : ""}>Not committed to</option>
              </select></div>
            <div class="field"><label for="f-min">Min. group size</label><input id="f-min" type="number" min="3" max="20" value="${esc(f.min)}" placeholder="Any"></div>
            <div class="field"><label for="f-max">Max. group size</label><input id="f-max" type="number" min="3" max="20" value="${esc(f.max)}" placeholder="Any"></div>
          </div>
          <div class="field"><span class="flabel">Activity category</span><div class="chips">${types.map((t) => `<label class="chip"><input type="checkbox" value="${esc(t)}"${f.types.includes(t) ? " checked" : ""}>${esc(t)}</label>`).join("")}</div></div>
          <div class="row"><button class="btn btn-primary">Show activities</button><button type="button" class="btn btn-ghost" id="clear">Clear filters</button></div>
        </form>

        <div class="row-between">
          <span class="small muted">${list.length} activit${list.length === 1 ? "y" : "ies"}</span>
        </div>

        ${list.map((a, i) => {
          const taken = Store.spotsTaken(a.id), need = Math.max(0, a.min - taken);
          return `<a class="panel tight act-card" href="activity.html?id=${a.id}">
            <span class="num">${i + 1}</span>
            <div class="grow">
              <div class="row-between"><div class="row" style="gap:6px"><span class="tag">${esc(a.type)}</span>${a.visibility === "friends" ? '<span class="tag grey">Friends Only</span>' : ""}</div>
                ${Store.isGoing(a.id) ? `<span class="tag ok">${icon("check", "sm")}Going</span>` : a.hostId === Store.ME ? '<span class="tag flame">Hosting</span>' : need ? `<span class="tag warn">Needs ${need} more</span>` : taken >= a.max ? '<span class="tag grey">Full</span>' : ""}</div>
              <h3 style="margin-top:6px">${esc(a.title)}</h3>
              <div class="meta"><span>${icon("clock", "sm")}${esc(UI.fmtRange(a))}</span><span>${icon("activity", "sm")}${esc(a.city)}${a.dist != null ? " · " + UI.fmtMi(a.dist) : ""}</span></div>
              <div class="row-between small"><span>${taken} of ${a.max} going</span><span class="muted">Host: ${esc(UI.displayName(a.hostId))}</span></div>
              <div class="capacity"><i style="width:${Math.min(100, (taken / a.max) * 100)}%"></i></div>
            </div></a>`;
        }).join("") || `<div class="panel center"><p><b>Nothing matches those filters.</b></p><p class="muted small">Try adjusting your filters, or post your own.</p><a class="btn btn-primary" href="activity-new.html">Post an activity</a></div>`}
      </section>`;

    document.getElementById("toggle-filter").onclick = () => { f.open = !f.open; render(); };
    const form = document.getElementById("filters");
    form.onsubmit = (e) => {
      e.preventDefault();
      f.timeOfDay = form.querySelector("#f-time").value;
      f.dateRange = form.querySelector("#f-date").value;
      f.visibility = form.querySelector("#f-vis").value;
      f.commitment = form.querySelector("#f-commitment").value;
      f.name = form.querySelector("#f-name").value.trim();
      f.min = form.querySelector("#f-min").value; f.max = form.querySelector("#f-max").value;
      f.types = [...form.querySelectorAll(".chip input:checked")].map((x) => x.value);
      render();
    };
    document.getElementById("clear").onclick = () => {
      Object.assign(f, { timeOfDay: "any", dateRange: "upcoming", commitment: "any", visibility: "all", types: [], name: "", min: "3", max: "" });
      render();
    };
  });
})();
