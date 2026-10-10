/* Lessons: Duolingo-style path. Lessons unlock in order. */
UI.mount("lessons", function render() {
  const { icon, esc } = UI;
  const done = window.LESSONS.filter((l) => Store.isLessonDone(l.n)).length;
  const offsets = [0, 70, 0, -70, 0, 70, 0]; // zig-zag (px)

  document.getElementById("main").innerHTML = `
    <div style="max-width:720px">
      <div class="page-head"><div><h1>Lessons</h1><p class="muted mb0">Short reads on how your phone works on your brain, and what to do about it.</p></div></div>
      <div class="panel tight"><div class="row-between small"><b>Your progress</b><span>${done} of ${window.LESSONS.length} complete · +${Store.POINTS.lesson} points each</span></div>
        <div class="capacity" style="height:10px"><i style="width:${(done / window.LESSONS.length) * 100}%"></i></div></div>
      <div class="lesson-path" id="path">
        <svg class="trail" id="trail"></svg>
        ${window.LESSONS.map((l, i) => {
          const st = Store.isLessonDone(l.n) ? "done" : Store.isLessonUnlocked(l.n) ? "current" : "locked";
          return `<a class="lesson-node ${st}" href="lesson.html?n=${l.n}" data-n="${l.n}" style="transform:translateX(${offsets[i % offsets.length]}px)" ${st === "locked" ? 'aria-disabled="true"' : ""}>
            ${st === "current" ? '<span class="start">START</span>' : ""}
            <span class="orb">${st === "done" ? icon("check", "lg") : st === "locked" ? icon("lock") : l.n}</span>
            <span class="t">${l.n}. ${esc(l.title)}<br><span class="tiny muted">${st === "done" ? "Completed" : l.minutes + " min"}</span></span></a>`;
        }).join("")}
      </div>
    </div>`;

  // Dotted trail connecting the orbs
  requestAnimationFrame(() => {
    const path = document.getElementById("path"), svg = document.getElementById("trail"); if (!path) return;
    const box = path.getBoundingClientRect();
    const pts = [...path.querySelectorAll(".orb")].map((o) => { const r = o.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; });
    svg.innerHTML = pts.slice(1).map((p, i) => `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${p[0]}" y2="${p[1]}" stroke="oklch(0.82 0.03 200)" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 14"/>`).join("");
  });

  document.querySelectorAll(".lesson-node.locked").forEach((n) => (n.onclick = (e) => {
    e.preventDefault();
    const cur = Store.currentLesson();
    UI.alertModal("This lesson is locked", "Finish the lessons before it first. They unlock in order so each one builds on the last.", { actions: `<button class="btn" data-close>Close</button><a class="btn btn-primary" href="lesson.html?n=${cur}">Go to Lesson ${cur}</a>` });
  }));
});
