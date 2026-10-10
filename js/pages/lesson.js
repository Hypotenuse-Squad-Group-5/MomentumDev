/* A single lesson page + the 30-word goal that becomes a daily habit. */
UI.mount("lessons", function render() {
  const { icon, esc } = UI;
  const main = document.getElementById("main");
  const n = Number(UI.qs("n")) || 1;
  const l = window.LESSONS.find((x) => x.n === n);
  if (!l) { main.innerHTML = `<a class="small" href="lessons.html">‹ All lessons</a><div class="panel mt"><h2>Lesson not found</h2></div>`; return; }
  if (!Store.isLessonUnlocked(n)) {
    main.innerHTML = `<a class="small" href="lessons.html">‹ All lessons</a><div class="panel mt center">${icon("lock", "lg")}<h2 class="mt">Lesson ${n} is locked</h2><p class="muted">Finish Lesson ${Store.currentLesson()} first. Lessons unlock in order.</p><a class="btn btn-primary" href="lesson.html?n=${Store.currentLesson()}">Go to Lesson ${Store.currentLesson()}</a></div>`;
    return;
  }
  const done = Store.isLessonDone(n);

  main.innerHTML = `
  <div style="max-width:720px">
    <a class="small" href="lessons.html">‹ All lessons</a>
    <article class="lesson-body">
      <p class="label mt">Lesson ${n} of ${window.LESSONS.length} · ${l.minutes} min</p>
      <h1>${esc(l.title)}</h1>
      ${l.stats.length ? `<div class="stat-cards">${l.stats.map(([v, c]) => `<div class="stat-card"><b>${esc(v)}</b><span>${esc(c)}</span></div>`).join("")}</div>` : ""}
      ${l.html}
    </article>

    ${done ? `<section class="panel mt-lg"><p class="label">Lesson complete</p><h2>Your goal</h2><div class="goal-box">${esc(Store.lessonGoal(n))}</div>
        <p class="small muted mt mb0">It's on your Home screen as a daily habit.</p>
        ${n < window.LESSONS.length ? `<a class="btn btn-primary mt" href="lesson.html?n=${n + 1}">Next lesson</a>` : ""}</section>`
    : `<form class="panel mt-lg" id="goal-form" novalidate>
        <p class="label">Set your goal</p>
        <div class="field" data-f="goal"><label for="goal">${esc(l.prompt)}</label>
          <textarea id="goal" placeholder="${esc(l.placeholder)}" style="min-height:140px"></textarea>
          <div class="hint"><span id="wc">0</span> / 30 words minimum</div><div class="err" hidden></div></div>
        <div class="field" data-f="habit"><label for="habit">Name it as a daily habit</label>
          <input id="habit" type="text" maxlength="80" placeholder="${esc(l.habitPlaceholder)}"><div class="hint">It shows up on Home so you can check it off each day.</div><div class="err" hidden></div></div>
        <button class="btn btn-primary btn-block">Finish lesson (+${Store.POINTS.lesson})</button>
      </form>`}
  </div>`;

  const form = document.getElementById("goal-form");
  if (!form) return;
  const goal = form.querySelector("#goal"), wc = form.querySelector("#wc");
  goal.oninput = () => { const w = UI.words(goal.value); wc.textContent = w; wc.style.color = w >= 30 ? "var(--primary)" : ""; };
  form.onsubmit = (e) => {
    e.preventDefault();
    const fields = { goal: form.querySelector('[data-f="goal"]'), habit: form.querySelector('[data-f="habit"]') };
    Object.values(fields).forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    const w = UI.words(goal.value), h = form.querySelector("#habit").value.trim();
    const bad = (k, msg) => { fields[k].classList.add("invalid"); const el = fields[k].querySelector(".err"); el.textContent = msg; el.hidden = false; };
    if (w < 30) bad("goal", "Write at least 30 words to finish this lesson. You're at " + w + ".");
    if (!h) bad("habit", "Give your daily habit a short name.");
    if (w < 30 || !h) return;
    const r = Store.completeLesson(n, goal.value, h);
    if (!r.ok) return UI.alertModal("Couldn't finish", esc(r.message), { error: true });
    UI.flash("Lesson " + n + " complete. New habit added to Home.", r.points);
    location.href = "lessons.html";
  };
}, { live: false });
