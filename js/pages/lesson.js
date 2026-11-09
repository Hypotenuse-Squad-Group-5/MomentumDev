/* A single lesson page + a short reflection that becomes a daily habit. */
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
  const habit = Store.lessonHabit(n);

  main.innerHTML = `
  <div style="max-width:720px">
    <a class="small" href="lessons.html">‹ All lessons</a>
    <article class="lesson-body">
      <p class="label mt">Lesson ${n} of ${window.LESSONS.length} · ${l.minutes} min</p>
      <h1>${esc(l.title)}</h1>
      <p class="lesson-intro muted">${esc(l.summary)}</p>
      <p class="small"><a href="#practice-title">Jump to practice</a> · <a href="#lesson-sources">Research & sources</a></p>
      ${l.stats.length ? `<div class="stat-cards">${l.stats.map(([v, c]) => `<div class="stat-card"><b>${esc(v)}</b><span>${esc(c)}</span></div>`).join("")}</div>` : ""}
      ${l.html}
      <div id="lesson-interactions"></div>
    </article>

    ${done ? `<section class="panel mt-lg"><p class="label">Lesson complete</p><h2>Your goal</h2><div class="goal-box">${esc(Store.lessonGoal(n))}</div>
        ${habit ? `<h3 class="mt">Your daily habit</h3><div class="goal-box">${esc(habit.title)}</div><p class="small muted mt mb0">${habit.active ? "This is the same habit shown on Home." : "This habit is archived. You can restore it on Home."} <a href="home.html">Manage habit</a></p>` : `<p class="small muted mt mb0">Your linked habit is unavailable. Check your habits on <a href="home.html">Home</a>.</p>`}
        ${n < window.LESSONS.length ? `<a class="btn btn-primary mt" href="lesson.html?n=${n + 1}">Next lesson</a>` : ""}</section>`
    : `<form autocomplete="off" class="panel mt-lg" id="goal-form" novalidate>
        <p class="label">Set your goal</p>
        <div class="field" data-f="goal"><label for="goal">${esc(l.prompt)}</label>
          <textarea maxlength="1000" autocomplete="off" id="goal" placeholder="${esc(l.placeholder)}" style="min-height:140px"></textarea>
          <div class="hint"><span id="wc">0</span> / 1,000 characters maximum</div><div class="err" hidden></div></div>
        <div class="field" data-f="habit"><label for="habit">Your daily habit</label>
          <input autocomplete="off" id="habit" type="text" maxlength="80" placeholder="${esc(l.habitPlaceholder)}" aria-describedby="habit-hint habit-error">
          <div class="hint" id="habit-hint">Name a small habit to practice. Finishing this lesson adds it to your habits on Home.</div><div class="err" id="habit-error" hidden></div></div>
        <button class="btn btn-primary btn-block">Finish lesson (+${Store.POINTS.lesson})</button>
      </form>`}
  </div>`;

  LessonInteractions.mount(l, document.getElementById("lesson-interactions"));
  const form = document.getElementById("goal-form");
  if (!form) return;
  const goal = form.querySelector("#goal"), wc = form.querySelector("#wc");
  goal.oninput = () => { const count = goal.value.length; wc.textContent = count; wc.style.color = count >= 1000 ? "var(--warn)" : ""; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fields = { goal: form.querySelector('[data-f="goal"]'), habit: form.querySelector('[data-f="habit"]') };
    Object.values(fields).forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    const empty = !goal.value.trim(), h = form.querySelector("#habit").value.trim();
    const bad = (k, msg) => { fields[k].classList.add("invalid"); const el = fields[k].querySelector(".err"); el.textContent = msg; el.hidden = false; };
    if (goal.value.length > 1000) bad("goal", "Keep your reflection within 1,000 characters.");
    if (empty) bad("goal", "Add a brief reflection before finishing this lesson.");
    if (!h) bad("habit", "Give your daily habit a short name.");
    if (empty || goal.value.length > 1000 || !h) { fields[!h ? "habit" : "goal"].querySelector("input, textarea").focus(); return; }
    const button = form.querySelector('button[type="submit"], button');
    button.disabled = true;
    let r;
    try { r = await Store.completeLesson(n, goal.value, h); }
    catch (_) { r = { ok: false, message: "Your lesson could not be saved. Your reflection is still here; please try again." }; }
    finally { button.disabled = false; }
    if (!r.ok) return UI.alertModal("Couldn't finish", esc(r.message), { error: true });
    UI.flash("Lesson " + n + " complete. New habit added to Home.", r.points);
    location.href = "lessons.html";
  };
}, { live: false });
