/* A single lesson page + a short reflection that becomes a daily habit. */
let redoingLesson = false;
UI.mount("lessons", function render() {
  const { icon, esc } = UI;
  const main = document.getElementById("main");
  const n = Number(UI.qs("n")) || 1;
  const l = window.LESSONS.find((x) => x.n === n);
  if (!l) { main.innerHTML = `<a class="small" href="lessons.html">‹ All lessons</a><div class="panel mt"><h2>Lesson not found</h2></div>`; return; }
  const index = window.LESSONS.indexOf(l);
  if (!Store.isLessonUnlocked(n)) {
    const current = Store.currentLesson();
    const currentPosition = window.LESSONS.findIndex(lesson => lesson.n === current) + 1;
    main.innerHTML = `<a class="small" href="lessons.html">‹ All lessons</a><div class="panel mt center">${icon("lock", "lg")}<h2 class="mt">Lesson ${index + 1} is locked</h2><p class="muted">Finish Lesson ${currentPosition} first. Lessons unlock in order.</p><a class="btn btn-primary" href="lesson.html?n=${current}">Go to Lesson ${currentPosition}</a></div>`;
    return;
  }
  const next = window.LESSONS[index + 1];
  const done = Store.isLessonDone(n);
  const habit = Store.lessonHabit(n);

  main.innerHTML = `
  <div style="max-width:720px">
    <a class="small" href="lessons.html">‹ All lessons</a>
    <article class="lesson-body">
      <p class="label mt">Lesson ${index + 1} of ${window.LESSONS.length} · ${l.minutes} min</p>
      <h1>${esc(l.title)}</h1>
      <p class="lesson-intro muted">${esc(l.summary)}</p>
      <p class="small"><a href="#practice-title">Jump to practice</a> · <a href="#lesson-sources">Research & sources</a></p>
      ${l.stats.length ? `<div class="stat-cards">${l.stats.map(([v, c]) => `<div class="stat-card"><b>${esc(v)}</b><span>${esc(c)}</span></div>`).join("")}</div>` : ""}
      ${LessonInteractions.content(l.html)}
      <div id="lesson-interactions"></div>
    </article>

    ${done && !redoingLesson ? `<section class="panel mt-lg"><p class="label">Lesson complete</p><h2>Your goal</h2><div class="goal-box">${esc(Store.lessonGoal(n))}</div>
        ${habit ? `<h3 class="mt">Your daily habit</h3><div class="goal-box">${esc(habit.title)}</div><p class="small muted mt mb0">${habit.active ? "This is the same habit shown on Home." : "This habit is archived. You can restore it on Home."} <a href="home.html">Manage habit</a></p>` : `<p class="small muted mt mb0">Your linked habit is unavailable. Check your habits on <a href="home.html">Home</a>.</p>`}
        <button type="button" class="btn mt" id="redo-lesson">Redo lesson</button>
        ${next ? `<a class="btn btn-primary mt" href="lesson.html?n=${next.n}">Next lesson</a>` : ""}</section>`
    : `<form autocomplete="off" class="panel mt-lg" id="goal-form" novalidate>
        <p class="label">${redoingLesson ? "Redo lesson" : "Set your goal"}</p>
        ${redoingLesson ? '<p class="small muted">Your existing habit stays on Home. Finishing again adds a new habit.</p>' : ""}
        ${Store.canAddHabit() ? "" : `<div class="alert warn" style="margin-bottom:12px">${icon("alert", "sm")}<span>${esc(Store.LESSON_BLOCKED_MSG)} Archive one on <a href="home.html">Home</a>.</span></div>`}
        <div class="field" data-f="goal"><label for="goal">${esc(l.prompt)}</label>
          <textarea maxlength="1000" autocomplete="off" id="goal" placeholder="${esc(l.placeholder)}" style="min-height:140px"></textarea>
          <div class="hint"><span id="wc">0</span> / 1,000 characters maximum</div><div class="err" hidden></div></div>
        <div class="field" data-f="habit"><label for="habit">Your daily habit</label>
          <input autocomplete="off" id="habit" type="text" maxlength="80" placeholder="${esc(l.habitPlaceholder)}" aria-describedby="habit-hint habit-error">
          <div class="hint" id="habit-hint">Name a small habit to practice. Finishing this lesson adds it to My habits on Home.</div><div class="err" id="habit-error" hidden></div></div>
        <div class="habit-ai">
          <p class="small muted" id="ai-notice">Optional: get three habit ideas from Gemini. Your reflection will be sent to Google, which may use it to improve its products, including human review. Do not include names, contact details, or personal, sensitive, or confidential information. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google’s terms</a></p>
          <label class="check small"><input type="checkbox" id="ai-consent" aria-describedby="ai-notice"> <span>My reflection contains no personal or sensitive information, and I want to send it for AI suggestions.</span></label>
          <button type="button" class="btn mt" id="suggest-habits" aria-describedby="ai-notice ai-status">Suggest habits with AI</button>
          <p class="hint" id="ai-status" role="status" aria-live="polite"></p>
          <div id="habit-suggestions" class="habit-suggestions" role="group" aria-label="Suggested daily habits"></div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Finish lesson</button>
        ${redoingLesson ? '<button type="button" class="btn mt" id="cancel-redo">Cancel redo</button>' : ""}
      </form>`}
  </div>`;

  LessonInteractions.mount(l, document.getElementById("lesson-interactions"));
  const form = document.getElementById("goal-form");
  if (!form) {
    document.getElementById("redo-lesson").onclick = () => {
      redoingLesson = true;
      render();
      document.getElementById("goal").focus();
    };
    return;
  }
  const cancelRedo = document.getElementById("cancel-redo");
  if (cancelRedo) cancelRedo.onclick = () => {
    redoingLesson = false;
    render();
    document.getElementById("redo-lesson").focus();
  };
  HabitSuggestions.mount(form, n);
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
    if (!Store.canAddHabit()) { UI.toast(Store.LESSON_BLOCKED_MSG); UI.attention(UI.HOME_TABS); return; }
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    if (cancelRedo) cancelRedo.disabled = true;
    form.querySelector('#suggest-habits').disabled = true;
    let r;
    try { r = await Store.completeLesson(n, goal.value, h, { redo: redoingLesson }); }
    catch (_) { r = { ok: false, message: "Your lesson could not be saved. Your reflection is still here; please try again." }; }
    finally {
      button.disabled = false;
      if (cancelRedo) cancelRedo.disabled = false;
      form.querySelector('#suggest-habits').disabled = false;
    }
    if (!r.ok && r.code === "max_active") { UI.toast(r.message); UI.attention(UI.HOME_TABS); return; }
    if (!r.ok) return UI.alertModal("Couldn't finish", esc(r.message), { error: true });
    UI.flash(r.gainedNow ? "You gained Momentum!" : "Lesson " + (index + 1) + " complete. New habit added to My habits.");
    location.href = "lessons.html";
  };
}, { live: false });
