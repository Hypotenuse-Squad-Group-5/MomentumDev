/* Admin › Lessons. Saves publish immediately through the admin-checked RPCs. */
(() => {
  const { esc } = AdminUI;
  let nextId = 0;
  function field(key, label, value = "", { type = "text", required = false, max, min } = {}) {
    const id = "lesson-editor-" + ++nextId;
    const attrs = `id="${id}" data-field="${key}" ${required ? "required" : ""} ${max ? (type === "number" ? "max" : "maxlength") + '="' + max + '"' : ""} ${min ? 'min="' + min + '"' : ""}`;
    return `<div class="field"><label for="${id}">${esc(label)}</label>
      ${type === "textarea" ? `<textarea ${attrs} rows="${key === "html" ? 8 : 3}">${esc(value)}</textarea>`
        : `<input ${attrs} type="${type}" value="${esc(value)}">`}</div>`;
  }

  const remove = label => `<button type="button" class="btn btn-ghost btn-sm" data-remove>Remove ${label}</button>`;
  const list = (name, label, values, render) => `
    <div data-list="${name}">${values.map(render).join("")}</div>
    <button type="button" class="btn btn-sm" data-add="${name}">Add ${label}</button>`;

  const option = (value = "", index = 0, answer = 0, group = "answer-" + ++nextId) => `
    <div class="panel tight mt" data-item>
      ${field("option", "Answer choice", value, { required: true })}
      <label class="check small"><input type="radio" name="${group}" data-correct ${index === answer ? "checked" : ""}> Correct answer</label>
      ${remove("choice")}
    </div>`;
  const quiz = (a = {}) => {
    const group = "answer-" + ++nextId;
    return `<fieldset class="panel mt" data-item data-activity="quiz" data-answer-group="${group}">
      <legend>Knowledge check</legend>
      ${field("question", "Question", a.question, { required: true, type: "textarea" })}
      ${list("option", "answer choice", a.options || ["", ""], (value, i) => option(value, i, a.answer ?? 0, group))}
      ${field("explanation", "Feedback after answering", a.explanation, { required: true, type: "textarea" })}
      ${remove("knowledge check")}
    </fieldset>`;
  };
  const plannerField = (f = {}) => `<fieldset class="panel tight mt" data-item>
    <legend>Practice field</legend>
    ${field("label", "Question or label", f.label, { required: true })}
    ${field("id", "Template key", f.id, { required: true, max: 40 })}
    ${field("placeholder", "Example answer", f.placeholder)}
    <label class="check small"><input type="checkbox" data-field="time" ${f.type === "time" ? "checked" : ""}> Time input</label>
    ${field("options", "Dropdown choices (one per line, optional)", f.options?.join("\n"), { type: "textarea" })}
    ${remove("field")}
  </fieldset>`;
  const planner = (a = {}) => `<fieldset class="panel mt" data-item data-activity="planner" data-kind="${esc(a.kind || "")}">
    <legend>Practice planner</legend>
    ${field("title", "Planner title", a.title, { required: true })}
    ${field("intro", "Instructions", a.intro, { type: "textarea" })}
    ${list("plannerField", "practice field", a.fields || [{ id: "action", label: "What will you do?" }], plannerField)}
    <p class="hint">Use field keys in braces, such as {action}, to insert learners’ answers.</p>
    ${field("template", "Plan template", a.template, { required: true, type: "textarea" })}
    ${field("habit", "Suggested daily habit", a.habit, { max: 80 })}
    ${remove("practice planner")}
  </fieldset>`;
  const source = (s = {}) => `<fieldset class="panel tight mt" data-item>
    <legend>Research source</legend>
    ${field("label", "Source title", s.label, { required: true })}
    ${field("url", "HTTPS link", s.url, { type: "url", required: true })}
    ${field("note", "Source note", s.note, { type: "textarea" })}
    ${remove("source")}
  </fieldset>`;
  const stat = ([value, caption] = []) => `<fieldset class="panel tight mt" data-item>
    <legend>Statistic</legend>
    ${field("value", "Value", value, { required: true })}
    ${field("caption", "Caption", caption, { required: true })}
    ${remove("statistic")}
  </fieldset>`;

  const input = (root, key) => root.querySelector(`[data-field="${key}"]`);
  const read = (root, key) => input(root, key).value.trim();
  const items = (root, key) => [...root.querySelector(`[data-list="${key}"]`).children];
  function readActivity(row) {
    if (row.dataset.activity === "quiz") {
      const choices = items(row, "option");
      const options = choices.map(choice => read(choice, "option"));
      const answer = choices.findIndex(choice => choice.querySelector("[data-correct]").checked);
      if (options.length < 2 || options.some(value => !value) || answer < 0) {
        throw new Error("Each knowledge check needs at least two choices and one correct answer.");
      }
      return { type: "quiz", question: read(row, "question"), options, answer, explanation: read(row, "explanation") };
    }
    const fields = items(row, "plannerField").map(fieldRow => {
      const options = read(fieldRow, "options").split("\n").map(value => value.trim()).filter(Boolean);
      return {
        id: read(fieldRow, "id"), label: read(fieldRow, "label"), placeholder: read(fieldRow, "placeholder"),
        type: input(fieldRow, "time").checked ? "time" : "text", options: options.length ? options : null,
      };
    });
    const ids = new Set(fields.map(f => f.id));
    const template = read(row, "template");
    if (!fields.length || ids.size !== fields.length || fields.some(f => !/^[a-zA-Z]\w*$/.test(f.id))
      || [...template.matchAll(/\{(\w+)\}/g)].some(([, key]) => !ids.has(key))) {
      throw new Error("Use unique field keys starting with a letter and match every key in the plan template to a field.");
    }
    const kind = row.dataset.kind;
    const required = { needs: ["need"], sleep: ["bedtime", "wake"], hangout: ["who", "activity", "where", "when", "boundary", "backup"] };
    if (required[kind]?.some(id => !ids.has(id))
      || (kind === "sleep" && fields.some(f => required.sleep.includes(f.id) && (f.type !== "time" || f.options)))) {
      throw new Error("Keep the original field keys for this planner. The bedtime and wake fields must use time inputs.");
    }
    const result = {
      type: "planner", title: read(row, "title"), intro: read(row, "intro"),
      fields, template, habit: read(row, "habit"),
    };
    if (kind) result.kind = kind;
    return result;
  }

  function preview(el, lesson, back) {
    el.innerHTML = `
      <button type="button" class="btn mb0" data-back>Back to lessons</button>
      <article class="lesson-body mt">
        <p class="label">Published preview · ${lesson.minutes} min</p>
        <h2>${esc(lesson.title)}</h2><p class="lesson-intro muted">${esc(lesson.summary)}</p>
        ${lesson.stats.length ? `<div class="stat-cards">${lesson.stats.map(([value, caption]) =>
          `<div class="stat-card"><b>${esc(value)}</b><span>${esc(caption)}</span></div>`).join("")}</div>` : ""}
        ${LessonInteractions.content(lesson.html)}
        <div data-practice></div>
      </article>
      <section class="panel mt"><h3>Final reflection</h3><p>${esc(lesson.prompt)}</p>
        <div class="field"><label for="preview-reflection">Reflection</label><textarea id="preview-reflection" readonly placeholder="${esc(lesson.placeholder)}"></textarea></div>
        <div class="field"><label for="preview-habit">Daily habit</label><input id="preview-habit" readonly placeholder="${esc(lesson.habitPlaceholder)}"></div>
      </section>`;
    el.querySelector("[data-back]").onclick = back;
    LessonInteractions.mount(lesson, el.querySelector("[data-practice]"));
    for (const link of el.querySelectorAll('a[href="#lesson-sources"]')) {
      link.onclick = event => {
        event.preventDefault();
        const sources = el.querySelector("#lesson-sources");
        sources.open = true;
        sources.scrollIntoView();
      };
    }
  }

  function editor(el, lesson, ctx) {
    const l = lesson || {};
    el.innerHTML = `<form class="panel" data-lesson-editor>
      <h2>${lesson ? "Edit lesson" : "Add lesson"}</h2>
      ${field("title", "Lesson title", l.title, { required: true, max: 120 })}
      ${field("summary", "Short description", l.summary, { required: true, type: "textarea" })}
      ${field("minutes", "Estimated minutes", l.minutes ?? 8, { type: "number", required: true, min: 1, max: 180 })}
      <h3>Lesson content</h3>
      <p class="hint">Write in plain text or use basic HTML for headings, lists, links, and callouts.</p>
      ${field("html", "Lesson body", l.html, { required: true, type: "textarea" })}
      ${list("stat", "statistic", l.stats || [], stat)}
      <h3 class="mt">Practice</h3>
      ${list("activity", "knowledge check", l.activities || [], a => a.type === "quiz" ? quiz(a) : planner(a))}
      <button type="button" class="btn btn-sm" data-add="planner">Add practice planner</button>
      <h3 class="mt">Sources</h3>
      ${list("source", "source", l.sources || [], source)}
      <h3 class="mt">Final reflection</h3>
      ${field("prompt", "Reflection question", l.prompt, { required: true, type: "textarea" })}
      ${field("placeholder", "Reflection example", l.placeholder)}
      ${field("habitPlaceholder", "Daily habit example", l.habitPlaceholder)}
      <p class="small muted">Saving publishes these changes to the learner lesson path.</p>
      <p class="hint" role="alert" data-error></p>
      <div class="row"><button type="submit" class="btn btn-primary">Publish lesson</button>
      <button type="button" class="btn" data-back>Cancel</button></div>
    </form>`;
    const form = el.querySelector("form");
    form.querySelector("[data-back]").onclick = ctx.refresh;
    form.onclick = event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-remove")) button.closest("[data-item]").remove();
      const name = button.dataset.add;
      if (!name) return;
      const container = name === "planner" ? form.querySelector('[data-list="activity"]') : button.previousElementSibling;
      const templates = { activity: quiz, planner, plannerField, source, stat };
      const markup = name === "option"
        ? option("", -1, 0, button.closest("[data-answer-group]").dataset.answerGroup) : templates[name]();
      container.insertAdjacentHTML("beforeend", markup);
      container.lastElementChild.querySelector("input, textarea").focus();
    };

    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      const error = form.querySelector("[data-error]");
      const rawBody = read(form, "html");
      const html = LessonInteractions.content(/^\s*</.test(rawBody) ? rawBody : rawBody.split(/\n\s*\n/).map(p =>
        `<p>${esc(p).replaceAll("\n", "<br>")}</p>`).join(""));
      error.textContent = "";
      try {
        const sources = items(form, "source").map(row => {
          const url = LessonInteractions.safeLink(read(row, "url"));
          if (!url || url.startsWith("#")) throw new Error("Research sources need a valid HTTPS link.");
          return { url, label: read(row, "label"), note: read(row, "note") };
        });
        const content = {
          html, summary: read(form, "summary"), sources,
          placeholder: read(form, "placeholder"), habitPlaceholder: read(form, "habitPlaceholder"),
          stats: items(form, "stat").map(row => [read(row, "value"), read(row, "caption")]),
          activities: items(form, "activity").map(readActivity),
        };
        button.disabled = true;
        form.querySelector("[data-back]").disabled = true;
        const response = await Store.admin.call("admin_save_lesson", {
          p_number: l.n ?? null, p_title: read(form, "title"), p_minutes: Number(read(form, "minutes")),
          p_prompt: read(form, "prompt"), p_content: content,
        });
        if (!response.ok) throw new Error(response.message);
        UI.toast("Lesson published.");
        if (ctx.isCurrent()) ctx.refresh();
      } catch (e) {
        error.textContent = e.message;
      } finally {
        button.disabled = false;
        form.querySelector("[data-back]").disabled = false;
      }
    };
  }

  AdminTabs.register({
    key: "lessons", label: "Lessons", order: 4,
    async render(el, ctx) {
      const result = await Store.admin.listPublishedLessons();
      if (!ctx.isCurrent()) return;
      if (!result.ok) { el.innerHTML = AdminUI.error(result.message); return; }
      el.innerHTML = `<section class="panel">
        <div class="row-between"><h2 class="mb0">Published lessons</h2>
          <button type="button" class="btn btn-primary" data-new>Add lesson</button></div>
        ${result.data.length ? AdminUI.table([
          { label: "Lesson", cell: l => esc(l.title) },
          { label: "Minutes", cell: l => esc(l.minutes) },
          { label: "Actions", cell: l => `
            <button type="button" class="btn btn-sm" data-view="${l.n}">Preview</button>
            <button type="button" class="btn btn-sm" data-edit="${l.n}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${l.n}">Delete</button>` },
        ], result.data) : "<p>No lessons are published yet.</p>"}
      </section>`;
      el.querySelector("[data-new]").onclick = () => editor(el, null, ctx);
      for (const lesson of result.data) {
        el.querySelector(`[data-view="${lesson.n}"]`).onclick = () => preview(el, lesson, ctx.refresh);
        el.querySelector(`[data-edit="${lesson.n}"]`).onclick = () => editor(el, lesson, ctx);
        const button = el.querySelector(`[data-delete="${lesson.n}"]`);
        button.onclick = async () => {
          if (!await AdminUI.confirm({
            title: `Delete “${lesson.title}”?`,
            body: "This removes the lesson from the published path. Existing completions and habits are kept.",
          }) || !ctx.isCurrent()) return;
          button.disabled = true;
          try {
            const result = await Store.admin.call("admin_delete_lesson", { p_number: lesson.n });
            if (!result.ok) throw new Error(result.message);
            UI.toast("Lesson deleted.");
            if (ctx.isCurrent()) ctx.refresh();
          } catch (error) {
            UI.toast(error.message || "Could not delete this lesson.");
            button.disabled = false;
          }
        };
      }
    },
  });
})();
