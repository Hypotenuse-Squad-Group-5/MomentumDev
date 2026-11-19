/* Lessons: Duolingo-style path. Lessons unlock in order. */
UI.mount("lessons", function render() {
  const { icon, esc } = UI;
  const done = window.LESSONS.filter((l) => Store.isLessonDone(l.n)).length;
  const percent = window.LESSONS.length ? Math.round(done / window.LESSONS.length * 100) : 0;
  const offsets = [0, 70, 0, -70, 0, 70, 0]; // zig-zag (px)

  document.getElementById("main").innerHTML = `
    <div style="max-width:720px">
      <div class="page-head"><div><h1>Lessons</h1><p class="muted mb0">Practical lessons to build intentional phone habits and make more room for life offline.</p></div></div>
      <div class="panel tight"><div class="row-between small"><b>Your progress</b><span>${percent}% complete</span></div>
        <div class="capacity" style="height:10px"><i style="width:${percent}%"></i></div></div>
      ${window.LESSONS.length ? "" : '<p class="panel">No lessons are published yet.</p>'}
      <div class="lesson-path" id="path">
        <svg class="trail" id="trail"></svg>
        ${window.LESSONS.map((l, i) => {
          const st = Store.isLessonDone(l.n) ? "done" : Store.isLessonUnlocked(l.n) ? "current" : "locked";
          // Label beside the circle, on the side with more room (left when the path swings right)
          const side = offsets[i % offsets.length] > 0 ? "label-left" : "label-right";
          return `<a class="lesson-node ${st} ${side}" href="lesson.html?n=${l.n}" data-n="${l.n}" style="transform:translateX(${offsets[i % offsets.length]}px)" ${st === "locked" ? 'aria-disabled="true"' : ""}>
            ${st === "current" ? '<span class="start">START</span>' : ""}
            <span class="orb">${st === "done" ? icon("check", "lg") : st === "locked" ? icon("lock") : i + 1}</span>
            <span class="t">${i + 1}. ${esc(l.title)}<br><span class="tiny muted">${st === "done" ? "Completed" : l.minutes + " min · Read & practice"}</span></span></a>`;
        }).join("")}
      </div>
    </div>`;

  // Dotted trail connecting the orbs
  requestAnimationFrame(() => {
    const path = document.getElementById("path"), svg = document.getElementById("trail"); if (!path) return;
    const box = path.getBoundingClientRect();
    const pts = [...path.querySelectorAll(".orb")].map((o) => { const r = o.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2]; });
    svg.innerHTML = pts.slice(1).map((p, i) => `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${p[0]}" y2="${p[1]}" style="stroke:var(--trail)" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 14"/>`).join("");
  });

  // Finishing a lesson adds a habit, so a NEW lesson needs a free habit slot (5 max). Point them to Home.
  document.querySelectorAll(".lesson-node.current").forEach((node) => (node.onclick = (e) => {
    if (Store.canStartLesson(Number(node.dataset.n))) return;
    e.preventDefault(); UI.toast(Store.LESSON_BLOCKED_MSG); UI.attention(UI.HOME_TABS);
  }));
  document.querySelectorAll(".lesson-node.locked").forEach((n) => (n.onclick = (e) => {
    e.preventDefault();
    const cur = Store.currentLesson();
    const position = window.LESSONS.findIndex(lesson => lesson.n === cur) + 1;
    UI.alertModal("This lesson is locked", "Finish the lessons before it first. They unlock in order so each one builds on the last.", { actions: `<button class="btn" data-close>Close</button><a class="btn btn-primary" href="lesson.html?n=${cur}">Go to Lesson ${position}</a>` });
  }));
});
