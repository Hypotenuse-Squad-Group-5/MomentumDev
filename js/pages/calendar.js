/* Calendar: only activities you've committed to (or are hosting). */
(function () {
  const now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1);
  let addedShown = false;

  /* ---- Holiday emoji lookup ---- */
  const HOLIDAYS_FIXED = {
    '1-1': ['🎆', '🍾', '🎈', '🥳', '🕛'],
    '2-14': ['❤️', '💖','💝', '💕', '🌹', '💐', '🍫', '🎁'],
    '3-17': ['☘️', '🍀', '🎩', '🌈', '🪙'],
    '6-19': ['🖤','🗽', '✨'],
    '7-4': ['🎆', '🎖️', '🗽', '🦅'],
    '10-31': ['🎃', '👻', '🧛', '🍬', '🕸️'],
    '11-11': ['🎆', '🎖️', '🗽', '🦅'],
    '12-25': ['🎄', '🎅', '🤶', '🎁', '❄️'],
    '12-31': ['🎆','🍾', '🎈', '🥳', '🕛']
  };

  function nthDow(year, month, dow, n) {
    var first = new Date(year, month, 1).getDay();
    var d = 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
    return d;
  }
  function lastMonday(year, month) {
    var last = new Date(year, month + 1, 0);
    return last.getDate() - ((last.getDay() + 6) % 7);
  }
  function easterDay(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100,
      d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31) - 1,
      day = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: month, d: day };
  }

  function holidayEmojis(year, month, day) {
    var key = (month + 1) + '-' + day;
    if (HOLIDAYS_FIXED[key]) return HOLIDAYS_FIXED[key];
    if (month === 0 && day === nthDow(year, 0, 1, 3)) return ['🕊️', '🤝', '📜'];
    if (month === 1 && day === nthDow(year, 1, 1, 3)) return ['🦅', '🏛️', '🎩'];
    var e = easterDay(year);
    if (month === e.m && day === e.d) return ['🐰', '🥚', '🐣', '✝️', '🌸'];
    if (month === 4 && day === nthDow(year, 4, 0, 2)) return ['💐', '💝', '👩', '🌸'];
    if (month === 4 && day === lastMonday(year, 4)) return ['🎆', '🎖️', '🗽', '🦅'];
    if (month === 5 && day === nthDow(year, 5, 0, 3)) return ['👨', '👑', '👔', '🎁'];
    if (month === 8 && day === nthDow(year, 8, 1, 1)) return ['🛠️', '👷', '🍔'];
    if (month === 9 && day === nthDow(year, 9, 1, 2)) return ['⛵', '🌎', '🪵', '🏹'];
    if (month === 10 && day === nthDow(year, 10, 4, 4)) return ['🦃', '🍂', '🥧', '🍁', '🍗'];
    return null;
  }

  function pickEmoji(arr, y, m, d) {
    return arr[(y * 366 + m * 31 + d) % arr.length];
  }
  /* ---- end holiday emoji ---- */

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
      const hArr = holidayEmojis(y, m, d);
      const hE = hArr ? pickEmoji(hArr, y, m, d) : '';
      cells.push(`<div class="day${key === Store.today() ? " today" : ""}"><div class="d-row"><span class="d">${d}</span>${hE ? `<span class="h-emoji" title="${key}">${hE}</span>` : ''}</div>${evs.map((a) => `<a class="ev${Store.isPast(a) ? " past" : ""}" href="#ev-${a.id}" title="${esc(a.title)}">${UI.fmtTime(a.startsAt).replace(":00", "")}<span class="t"> ${esc(a.title)}</span></a>`).join("")}</div>`);
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
            <dt>Group</dt><dd>${Store.spotsTaken(a.id)} ${isPast ? "signed up" : "going"} (min ${a.min}, max ${a.max})</dd>
            ${a.bring ? `<dt>Bring</dt><dd>${esc(a.bring)}</dd>` : ""}
          </dl>
          ${!isPast ? `<p class="small mt">${icon("clock", "sm")} You'll get a reminder 30 minutes before the start.</p>` : ""}
          <div class="row mt">
            <a class="btn btn-sm" href="activity.html?id=${a.id}">Full details</a>
            ${!isPast ? `<button class="btn btn-sm" data-cal="${a.id}">${icon("calendar", "sm")}Add to calendar</button>` : ""}
            ${isPast && r && r.attended === null ? `<button class="btn btn-sm btn-primary" data-went="${a.id}">I went</button><button class="btn btn-sm" data-missed="${a.id}">I didn't make it</button>` : ""}
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
    const checkIn = async (b, id, went) => {
      b.closest(".row").querySelectorAll("button").forEach((x) => (x.disabled = true));
      const r = await Store.checkIn(id, went);
      if (!r.ok) return UI.alertModal("Couldn't save", esc(r.message || "Please try again."), { error: true });
      UI.toast(!went ? "Thanks for being honest." : r.gainedNow ? "You gained Momentum!" : "Attendance saved.");
    };
    document.querySelectorAll("[data-went]").forEach((b) => (b.onclick = () => checkIn(b, b.dataset.went, true)));
    document.querySelectorAll("[data-missed]").forEach((b) => (b.onclick = () => checkIn(b, b.dataset.missed, false)));
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
