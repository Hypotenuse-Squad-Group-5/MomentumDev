/* Page-only practice. Persistence stays behind Store.completeLesson(n, goal, habit). */
(function () {
  function mount(lesson, container) {
    if (!container) return;
    const { esc } = UI;
    container.innerHTML = `<section class="lesson-practice" aria-labelledby="practice-title">
      <p class="label">Put it into practice</p><h2 id="practice-title">Make this lesson yours</h2>
      <p class="muted small">Practice answers stay on this page. Add a plan to your final reflection if you want to keep it when you finish the lesson.</p>
      ${lesson.activities.map((a, i) => a.type === "quiz" ? quiz(a, i) : planner(a, i)).join("")}
    </section>
    <details class="lesson-sources" id="lesson-sources"><summary>Research & sources</summary>
      <p class="small muted">Research informs the reading. The practice activities are learning tools, not diagnostic tests or guarantees of a health outcome.</p>
      <ul>${lesson.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a><p class="small muted">${esc(s.note)}</p></li>`).join("")}</ul>
    </details>`;

    function quiz(a, i) {
      return `<form class="panel lesson-exercise" data-exercise="${i}" data-kind="quiz"><p class="label">Knowledge check</p>
        <fieldset><legend>${esc(a.question)}</legend><div class="lesson-options">${a.options.map((o, j) => `<label class="lesson-option"><input type="radio" name="answer-${i}" value="${j}" required><span>${esc(o)}</span></label>`).join("")}</div></fieldset>
        <button class="btn btn-primary btn-sm" type="submit">Check my answer</button><p class="lesson-feedback" role="status" aria-live="polite" hidden></p></form>`;
    }
    function planner(a, i) {
      return `<form class="panel lesson-exercise" data-exercise="${i}" data-kind="planner"><h3>${esc(a.title)}</h3><p class="muted small">${esc(a.intro)}</p>
        <div class="lesson-fields">${a.fields.map(f => `<div class="field"><label for="practice-${i}-${f.id}">${esc(f.label)}</label>${f.options ? `<select id="practice-${i}-${f.id}" name="${f.id}" required><option value="">Choose an option</option>${f.options.map(o => `<option>${esc(o)}</option>`).join("")}</select>` : `<input id="practice-${i}-${f.id}" name="${f.id}" type="${f.type}" maxlength="240" placeholder="${esc(f.placeholder)}" required>`}</div>`).join("")}</div>
        ${a.kind === "needs" ? '<p class="lesson-suggestion callout small" aria-live="polite">Choose a need to explore possible alternatives.</p>' : ""}
        <button class="btn btn-primary btn-sm" type="submit">${a.kind === "hangout" ? "Build my invitation" : "Build my plan"}</button>
        <div class="lesson-plan" hidden><p class="label">Your draft</p><p class="lesson-plan-text" tabindex="-1"></p><p class="lesson-plan-note small"></p>
          <div class="lesson-plan-actions"><button class="btn btn-sm" type="button" data-use-plan>Add plan to my reflection</button>${a.kind === "hangout" ? '<button class="btn btn-sm" type="button" data-copy>Copy invitation</button>' : ""}</div>
          <p class="small muted" role="status" data-plan-status></p></div></form>`;
    }

    container.querySelectorAll('[data-kind="quiz"]').forEach(form => {
      const a = lesson.activities[Number(form.dataset.exercise)];
      form.addEventListener("submit", e => {
        e.preventDefault();
        const selected = form.querySelector("input:checked");
        if (!selected) return;
        const correct = Number(selected.value) === a.answer;
        const feedback = form.querySelector(".lesson-feedback");
        feedback.hidden = false;
        feedback.classList.toggle("correct", correct);
        feedback.textContent = (correct ? "You’ve got it. " : "Try another approach. ") + a.explanation;
      });
      form.addEventListener("change", () => { form.querySelector(".lesson-feedback").hidden = true; });
    });
    container.querySelectorAll('[data-kind="planner"]').forEach(form => {
      const a = lesson.activities[Number(form.dataset.exercise)];
      const output = form.querySelector(".lesson-plan");
      const status = form.querySelector("[data-plan-status]");
      let plan = "", invitation = "";
      if (a.kind === "needs") {
        const ideas = {
          Connection: "Try a short conversation, a walk with someone, or asking a classmate a question.",
          Rest: "Try sitting somewhere quiet, gentle stretching, or a pause without another task.",
          Movement: "Try a short walk, seated movement, or a stretch that suits your body.",
          Curiosity: "Try a page of a book, a small sketch, or noticing something new outside.",
          "A sense of progress": "Try a two-minute task: clear one surface or prepare one thing for tomorrow."
        };
        form.elements.need.addEventListener("change", () => { form.querySelector(".lesson-suggestion").textContent = ideas[form.elements.need.value] || "Choose a need to explore possible alternatives."; });
      }
      form.addEventListener("input", () => { output.hidden = true; });
      form.addEventListener("change", () => { output.hidden = true; });
      form.addEventListener("submit", e => {
        e.preventDefault();
        const values = Object.fromEntries(a.fields.map(f => [f.id, form.elements[f.id].value.trim()]));
        // Native required validation accepts whitespace; the plan should not.
        for (const f of a.fields) {
          const input = form.elements[f.id];
          input.setCustomValidity(values[f.id] ? "" : "Please add a specific detail.");
          input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
          if (!input.reportValidity()) return;
        }
        plan = a.template.replace(/\{(\w+)\}/g, (_, key) => values[key]);
        const note = form.querySelector(".lesson-plan-note");
        note.textContent = "You can edit this plan in your reflection before finishing.";
        if (a.kind === "sleep") {
          const minutes = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
          const bed = minutes(values.bedtime), wake = minutes(values.wake);
          const duration = (wake - bed + 1440) % 1440;
          const start = (bed - 30 + 1440) % 1440;
          const time = String(Math.floor(start / 60)).padStart(2, "0") + ":" + String(start % 60).padStart(2, "0");
          note.textContent = `Start your wind-down by ${time}. This schedule allows ${Math.floor(duration / 60)}h ${duration % 60}m in bed, not measured sleep. ` + (duration === 0 ? "These times are the same; choose your intended sleep window." : duration < 420 ? "That is below CDC’s general recommendation of at least seven hours for adults ages 18–60. Consider an earlier bedtime or later wake time." : "Allow time to fall asleep and adjust to your own sleep needs.");
        }
        invitation = a.kind === "hangout" ? `Hi ${values.who}! Want to ${values.activity} at ${values.where}, ${values.when}? Would this phone agreement work for you: ${values.boundary}? Necessary calls and access are welcome. Backup: ${values.backup}. No pressure if you can’t make it—another time works too.` : "";
        form.querySelector(".lesson-plan-text").textContent = invitation || plan;
        status.textContent = "";
        const use = form.querySelector("[data-use-plan]");
        use.disabled = !document.getElementById("goal-form");
        if (use.disabled) status.textContent = "You have completed this lesson. You can still practice here; your saved reflection stays as it is.";
        output.hidden = false;
        form.querySelector(".lesson-plan-text").focus();
      });
      form.querySelector("[data-use-plan]").addEventListener("click", () => {
        const goal = document.getElementById("goal"), habit = document.getElementById("habit");
        if (!goal || !habit || !plan) return;
        if (!goal.value.includes(plan)) goal.value = [goal.value.trim(), plan].filter(Boolean).join("\n\n");
        if (!habit.value.trim()) habit.value = a.habit;
        goal.dispatchEvent(new Event("input", { bubbles: true }));
        status.textContent = "Added to your reflection below. Review and personalize it, then finish the lesson when you are ready.";
        goal.focus();
      });
      const copy = form.querySelector("[data-copy]");
      if (copy) copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(invitation); status.textContent = "Invitation copied. You choose where and whether to send it."; }
        catch (_) {
          const range = document.createRange(); range.selectNodeContents(form.querySelector(".lesson-plan-text"));
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
          status.textContent = "Copy is unavailable here. The invitation is selected; use your device’s Copy command.";
        }
      });
    });
  }
  window.LessonInteractions = { mount };
})();
