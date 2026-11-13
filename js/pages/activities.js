/* Activities: filterable feed of upcoming activities (PL-7, PL-8, PL-9) */
(function () {
  const f = { open: false, distance: "25", types: [], name: "", min: "", max: "", sort: "distance" };

  UI.mount("activities", function render() {
    const { icon, esc } = UI;
    const upcoming = Store.allActivities().filter((a) => !Store.isPast(a)).map((a) => ({ ...a, dist: UI.distanceMi(a) }));
    let list = upcoming.filter((a) =>
      (f.distance === "any" || a.dist == null || a.dist <= Number(f.distance)) &&
      (!f.types.length || f.types.includes(a.type)) &&
      (!f.name || (a.activityName + " " + a.title).toLowerCase().includes(f.name.toLowerCase())) &&
      (!f.min || a.min >= Number(f.min)) &&
      (!f.max || a.max <= Number(f.max)));
    list.sort(f.sort === "soonest" ? (a, b) => new Date(a.startsAt) - new Date(b.startsAt) : (a, b) => (a.dist ?? 999) - (b.dist ?? 999));
    const activeCount = (f.distance !== "25" ? 1 : 0) + f.types.length + (f.name ? 1 : 0) + (f.min ? 1 : 0) + (f.max ? 1 : 0);

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
            <div class="field"><label for="f-dist">Distance</label>
              <select id="f-dist">${[["1", "Within 1 mile"], ["5", "Within 5 miles"], ["10", "Within 10 miles"], ["25", "Within 25 miles"], ["any", "Any distance"]].map(([v, l]) => `<option value="${v}"${f.distance === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
            <div class="field"><label for="f-name">Activity</label><input id="f-name" type="search" value="${esc(f.name)}" placeholder="e.g. board games, hiking"></div>
            <div class="field"><label for="f-min">Min. group size</label><input id="f-min" type="number" min="3" max="20" value="${esc(f.min)}" placeholder="Any"></div>
            <div class="field"><label for="f-max">Max. group size</label><input id="f-max" type="number" min="3" max="20" value="${esc(f.max)}" placeholder="Any"></div>
          </div>
          <div class="field"><span class="flabel">Activity category</span><div class="chips">${types.map((t) => `<label class="chip"><input type="checkbox" value="${esc(t)}"${f.types.includes(t) ? " checked" : ""}>${esc(t)}</label>`).join("")}</div></div>
          <div class="row"><button class="btn btn-primary">Show activities</button><button type="button" class="btn btn-ghost" id="clear">Clear filters</button></div>
        </form>

        <div class="row-between">
          <span class="small muted">${list.length} activit${list.length === 1 ? "y" : "ies"}</span>
          <label class="small row">Sort <select id="sort" style="width:auto;min-height:34px;padding:4px 8px"><option value="distance"${f.sort === "distance" ? " selected" : ""}>Closest</option><option value="soonest"${f.sort === "soonest" ? " selected" : ""}>Soonest</option></select></label>
        </div>

        ${list.map((a, i) => {
          const taken = Store.spotsTaken(a.id), need = Math.max(0, a.min - taken);
          return `<a class="panel tight act-card" href="activity.html?id=${a.id}">
            <span class="num">${i + 1}</span>
            <div class="grow">
              <div class="row-between"><span class="tag">${esc(a.type)}</span>
                ${Store.isGoing(a.id) ? `<span class="tag ok">${icon("check", "sm")}Going</span>` : a.hostId === Store.ME ? '<span class="tag flame">Hosting</span>' : need ? `<span class="tag warn">Needs ${need} more</span>` : taken >= a.max ? '<span class="tag grey">Full</span>' : ""}</div>
              <h3 style="margin-top:6px">${esc(a.title)}</h3>
              <div class="meta"><span>${icon("clock", "sm")}${esc(UI.fmtRange(a))}</span><span>${icon("activity", "sm")}${esc(a.city)}${a.dist != null ? " · " + UI.fmtMi(a.dist) : ""}</span></div>
              <div class="row-between small"><span>${taken} of ${a.max} going</span><span class="muted">Host: ${esc(UI.displayName(a.hostId))}</span></div>
              <div class="capacity"><i style="width:${Math.min(100, (taken / a.max) * 100)}%"></i></div>
            </div></a>`;
        }).join("") || `<div class="panel center"><p><b>Nothing matches those filters.</b></p><p class="muted small">Try widening the distance, or post your own.</p><a class="btn btn-primary" href="activity-new.html">Post an activity</a></div>`}
      </section>`;

    document.getElementById("toggle-filter").onclick = () => { f.open = !f.open; render(); };
    document.getElementById("sort").onchange = (e) => { f.sort = e.target.value; render(); };
    const form = document.getElementById("filters");
    form.onsubmit = (e) => {
      e.preventDefault();
      f.distance = form.querySelector("#f-dist").value; f.name = form.querySelector("#f-name").value.trim();
      f.min = form.querySelector("#f-min").value; f.max = form.querySelector("#f-max").value;
      f.types = [...form.querySelectorAll(".chip input:checked")].map((x) => x.value);
      render();
    };
    document.getElementById("clear").onclick = () => { Object.assign(f, { distance: "25", types: [], name: "", min: "", max: "" }); render(); };
  });
})();
