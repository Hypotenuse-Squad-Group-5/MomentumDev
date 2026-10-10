/* Calendar: only activities you've committed to (or are hosting). */
(function () {
  const now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1);
  let addedShown = false;

  UI.mount("calendar", function render() {
    const { icon, esc } = UI;
    const mine = Store.myCommitments().concat(Store.hosting().filter((a) => !Store.isGoing(a.id))).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const upcoming = mine.filter((a) => !Store.isPast(a));
    const past = mine.filter((a) => Store.isPast(a)).reverse();

    // Month grid
    const y = month.getFullYear(), m = month.getMonth();
    const firstDow = new Date(y, m, 1).getDay(), daysIn = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<div class="day out"></div>');
    for (let d = 1; d <= daysIn; d++) {
      const key = Store.dayKey(new Date(y, m, d));
      const evs = mine.filter((a) => Store.dayKey(a.startsAt) === key);
      cells.push(`<div class="day${key === Store.today() ? " today" : ""}"><span class="d">${d}</span>${evs.map((a) => `<a class="ev${Store.isPast(a) ? " past" : ""}" href="#ev-${a.id}" title="${esc(a.title)}">${UI.fmtTime(a.startsAt).replace(":00", "")}<span class="t"> ${esc(a.title)}</span></a>`).join("")}</div>`);
    }

    const card = (a) => {
      const isPast = Store.isPast(a), r = Store.myRsvp(a.id), host = a.hostId === Store.ME;
      const myReport = Store.report(a.id, Store.ME);
      return `<details class="event" id="ev-${a.id}">
        <summary>${UI.dateBadge(a.startsAt, isPast)}<div class="grow"><b>${esc(a.title)}</b><div class="small muted">${esc(UI.fmtTime(a.startsAt))} – ${esc(UI.fmtTime(a.endsAt))}</div></div>
          ${host ? '<span class="tag flame">Hosting</span>' : isPast ? (r && r.attended === true ? '<span class="tag ok">Went</span>' : r && r.attended === false ? '<span class="tag grey">Missed</span>' : '<span class="tag warn">Check in</span>') : `<span class="tag ok">${icon("check", "sm")}Committed</span>`}</summary>
        <div class="event-body">
          <dl class="kv">
            <dt>Host</dt><dd>${UI.nameLink(a.hostId)}</dd>
            <dt>Address</dt><dd><b>${esc(Store.address(a.id) || a.location)}</b></dd>
            <dt>Group</dt><dd>${Store.spotsTaken(a.id)} ${isPast ? "went" : "going"} (min ${a.min}, max ${a.max})</dd>
            ${a.bring ? `<dt>Bring</dt><dd>${esc(a.bring)}</dd>` : ""}
          </dl>
          ${!isPast ? `<p class="small mt">${icon("clock", "sm")} You'll get a reminder 30 minutes before the start.</p>` : ""}
          <div class="row mt">
            <a class="btn btn-sm" href="activity.html?id=${a.id}">Full details</a>
            ${!isPast ? `<button class="btn btn-sm" data-cal="${a.id}">${icon("calendar", "sm")}Add to calendar</button>` : ""}
            ${isPast && r && r.attended === null ? `<button class="btn btn-sm btn-primary" data-went="${a.id}">I went (+${Store.POINTS.attended})</button><button class="btn btn-sm" data-missed="${a.id}">I didn't make it</button>` : ""}
          </div>
          ${isPast && (host || (r && r.attended)) ? `<form class="mt" data-report="${a.id}"><label class="flabel small" for="rep-${a.id}"><b>Activity report</b> <span class="opt">(optional, shows on your profile)</span></label><textarea id="rep-${a.id}" maxlength="1000" style="min-height:80px" placeholder="How did it go?">${esc(myReport ? myReport.body : "")}</textarea><button class="btn btn-sm mt">Save report</button></form>` : ""}
        </div></details>`;
    };

    document.getElementById("main").innerHTML = `
      <div class="page-head"><div><h1>Calendar</h1><p class="muted mb0">Only activities you've committed to.</p></div><a class="btn" href="activities.html">Find more activities</a></div>
      <div class="cal-layout">
        <section class="panel">
          <div class="row-between"><button class="icon-btn" id="prev" aria-label="Previous month">${icon("left")}</button><h2 class="mb0">${month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><button class="icon-btn" id="next" aria-label="Next month">${icon("right")}</button></div>
          <div class="cal">${["S", "M", "T", "W", "T", "F", "S"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div>
        </section>
        <section>
          <p class="label">Upcoming</p>
          <div class="stack">${upcoming.map(card).join("") || '<div class="panel tight"><p class="mb0 muted">Nothing upcoming. <a href="activities.html">Find something to do.</a></p></div>'}</div>
          <p class="label mt-lg">Past</p>
          <div class="stack">${past.map(card).join("") || '<p class="muted small">No past activities yet.</p>'}</div>
        </section>
      </div>`;

    document.getElementById("prev").onclick = () => { month = new Date(y, m - 1, 1); render(); };
    document.getElementById("next").onclick = () => { month = new Date(y, m + 1, 1); render(); };
    document.querySelectorAll(".cal .ev").forEach((l) => (l.onclick = () => { const d = document.querySelector(l.getAttribute("href")); if (d) d.open = true; }));
    document.querySelectorAll("[data-cal]").forEach((b) => (b.onclick = () => UI.addToCalendarModal(Store.activity(b.dataset.cal))));
    document.querySelectorAll("[data-went]").forEach((b) => (b.onclick = () => UI.toast("Nice. That counts.", Store.checkIn(b.dataset.went, true).points)));
    document.querySelectorAll("[data-missed]").forEach((b) => (b.onclick = () => { Store.checkIn(b.dataset.missed, false); UI.toast("Thanks for being honest."); }));
    document.querySelectorAll("[data-report]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const t = f.querySelector("textarea").value.trim(); if (!t) return; Store.saveReport(f.dataset.report, t); UI.toast("Report saved"); }));

    // Just committed? Show the "add it to your calendar" pop-up once.
    const added = UI.qs("added");
    if (added && !addedShown) {
      addedShown = true;
      const a = Store.activity(added);
      if (a) {
        const el = document.getElementById("ev-" + a.id); if (el) { el.open = true; el.scrollIntoView({ block: "center" }); }
        UI.addToCalendarModal(a, `<div class="alert ok">${icon("check", "sm")}<span>You're committed. The exact address is now unlocked.</span></div><br>`);
      }
    }
  });
})();
