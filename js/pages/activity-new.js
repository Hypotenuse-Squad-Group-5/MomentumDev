/* Post an activity: THE VERTICAL SLICE.
   Submits to Supabase. Categories come from the activity_types table.
   PL-6: missing/invalid fields block posting, are flagged, and everything typed stays put. */
UI.mount("activities", async function render() {
  const { icon, esc } = UI;
  const [types] = await Promise.all([Store.loadTypes(), Store.loadSuggestions()]);
  const s = Store.state.settings;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  // "Use info from a previous activity": everything you've hosted, newest first
  const pastHosted = Store.hosting().slice().sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
  const typeEmoji = (typeName) => (types.find((t) => t.name === typeName) || {}).emoji || "📋";

  // Activity categories come from the activity_types table (name, emoji, sort_order).
  // To add, rename, reorder or change an emoji, edit that table in Supabase. No code change needed.
  const CATEGORY_LIST = types.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji || "" }));

  // Time choices: "-:--" (blank) plus 48 times in 15-minute steps, 6:00 through 5:45. AM/PM is the toggle beside it.
  const TIME_OPTIONS = '<option value="">-:--</option>' + [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]
    .flatMap((h) => ["00", "15", "30", "45"].map((m) => `<option value="${h}:${m}">${h}:${m}</option>`)).join("");

  document.getElementById("main").innerHTML = `
  <div style="max-width:720px">
    <a class="small" href="activities.html">‹ Cancel</a>
    <div class="page-head mt"><div><h1>Post an activity</h1><p class="muted mb0">Bring people together, in person.</p></div></div>

    <form class="panel" id="post-form" novalidate>
      <div class="alert" id="form-error" hidden></div>

      ${pastHosted.length ? `
      <!-- Re-use a previous activity -->
      <div class="field reuse-field" style="margin-bottom:16px">
        <label class="reuse-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
          <input type="checkbox" id="reuse-check"> Use info from a previous activity
        </label>
        <div id="reuse-picker" hidden style="margin-top:10px">
          <p class="small muted mb0" style="margin-bottom:6px">Select an activity to pre-fill everything except the date:</p>
          <div class="stack" id="reuse-list" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:6px">
            ${pastHosted.map((a) => `
              <button type="button" class="reuse-item" data-reuse-id="${esc(a.id)}" aria-pressed="false" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:8px 10px;border:0;background:none;border-radius:8px;cursor:pointer;font-size:.88rem;color:inherit">
                <span style="font-size:1.1rem" aria-hidden="true">${esc(typeEmoji(a.type))}</span>
                <span class="grow"><b>${esc(a.title)}</b><br><span class="small muted">${esc(a.activityName || "")} · ${esc(a.location || "")} · ${esc(new Date(a.startsAt).toLocaleDateString())}</span></span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
      ` : ""}

      <!-- Section 1: Details & Location -->
      <details class="form-section" name="post-section" open>
        <summary>
          <div class="form-section-title">
            <span class="form-section-name">Details & Location</span>
            <span class="form-section-desc">Title, activity category, location & description</span>
          </div>
          <span class="form-section-chevron"></span>
        </summary>
        <div class="form-section-body">
          <div class="field" data-f="title"><label for="title">Title</label><input id="title" type="text" maxlength="50" placeholder="e.g. Board Game Night"><div class="err" hidden></div></div>
          
          <div class="field" data-f="typeId">
            <span class="flabel" style="font-weight:600;margin-bottom:8px">Activity category</span>
            <div class="chips type-chips" id="type-chips">
              ${CATEGORY_LIST.map((c) => `
                <button type="button" class="chip type-chip" data-id="${c.id}">
                  <span class="chip-emoji">${esc(c.emoji)}</span>
                  <span>${esc(c.name)}</span>
                </button>
              `).join("")}
            </div>
            <input type="hidden" id="typeId" value="">
            <div class="err" hidden></div>
          </div>

          <div class="field" data-f="activityName">
            <label for="activityName">Activity</label>
            <input id="activityName" type="text" maxlength="40" placeholder="e.g. board games, volleyball, mindfulness meditation" list="activity-name-suggestions">
            <datalist id="activity-name-suggestions">${Store.activitySuggestions().map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
            <div class="hint">Used for search and filters.</div>
            <div class="err" hidden></div>
          </div>

          <div class="grid-2">
            <div class="field" data-f="location"><label for="location">General location</label><input id="location" maxlength="50" type="text" placeholder="e.g. Kiwanis Park"><div class="hint">Shown publicly on the feed and map.</div><div class="err" hidden></div></div>
            <div class="field" data-f="city"><label for="city">City</label><input id="city" maxlength="20" type="text" value="Provo"><div class="err" hidden></div></div>
          </div>
          <div class="field" data-f="address"><label for="address">Exact address</label><input id="address" maxlength="150" type="text" placeholder="Street address"><div class="hint">${icon("lock", "sm")} Only shown to people after they commit.</div><div class="err" hidden></div></div>
          <div class="field" data-f="description"><label for="description">Description</label><textarea id="description" maxlength="1000" placeholder="What will you do? Who is it good for?"></textarea><div class="err" hidden></div></div>
        </div>
      </details>

      <!-- Section 2: Time & Capacity -->
      <details class="form-section" name="post-section">
        <summary>
          <div class="form-section-title">
            <span class="form-section-name">Time & Capacity</span>
            <span class="form-section-desc">Date, hours & participant limits</span>
          </div>
          <span class="form-section-chevron"></span>
        </summary>
        <div class="form-section-body">
          <div class="field" data-f="date"><label for="date">Date</label><input id="date" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${tomorrow}"><div class="err" hidden></div></div>
          <div class="grid-2 time-grid">
            <div class="field" data-f="start">
              <label for="start-time">Starts</label>
              <div class="time-control">
                <select id="start-time" class="time-select">${TIME_OPTIONS}</select>
                <div class="ampm-toggle" data-for="start">
                  <button type="button" class="ampm-btn" data-val="AM">AM</button>
                  <button type="button" class="ampm-btn active" data-val="PM">PM</button>
                </div>
              </div>
              <input type="hidden" id="start">
              <div class="err" hidden></div>
            </div>
            <div class="field" data-f="end">
              <label for="end-time">Ends</label>
              <div class="time-control">
                <select id="end-time" class="time-select">${TIME_OPTIONS}</select>
                <div class="ampm-toggle" data-for="end">
                  <button type="button" class="ampm-btn" data-val="AM">AM</button>
                  <button type="button" class="ampm-btn active" data-val="PM">PM</button>
                </div>
              </div>
              <input type="hidden" id="end">
              <div class="err" hidden></div>
            </div>
          </div>
          <div class="grid-2">
            <div class="field" data-f="min"><label for="min">Min. people</label><input id="min" type="number" min="3" max="20" value="3"><div class="err" hidden></div></div>
            <div class="field" data-f="max"><label for="max">Max. people</label><input id="max" type="number" min="3" max="20" placeholder="20"><div class="err" hidden></div></div>
          </div>
        </div>
      </details>

      <!-- Section 3: Logistics -->
      <details class="form-section" name="post-section">
        <summary>
          <div class="form-section-title">
            <span class="form-section-name">Logistics</span>
            <span class="form-section-desc">Items to bring &amp; visibility</span>
          </div>
          <span class="form-section-chevron"></span>
        </summary>
        <div class="form-section-body">
          <div class="field"><label for="bring">What to bring <span class="opt">(optional)</span></label><input id="bring" maxlength="80" type="text" placeholder="e.g. water, a snack to share"></div>
          <fieldset class="field choice-list" style="border:0;padding:0">
            <legend class="flabel" style="font-weight:600;margin-bottom:6px">Who can see this activity?</legend>
            ${Object.entries(UI.VIS).map(([k, v]) => `<label><input type="radio" name="visibility" value="${k}"${k === s.activityVisibility ? " checked" : ""}><span><b>${v}</b>${k === "public" ? '<br><span class="small muted">Anyone on Momentum. The default.</span>' : k === "private" ? '<br><span class="small muted">Only people you invite.</span>' : ""}</span></label>`).join("")}
          </fieldset>
        </div>
      </details>

      <button class="btn btn-primary btn-block" id="submit">Post activity</button>
    </form>
  </div>`;

  const form = document.getElementById("post-form");

  // Keep single-open accordion behavior across all browsers
  form.querySelectorAll("details.form-section").forEach((sec) => {
    sec.addEventListener("toggle", () => {
      if (sec.open) {
        form.querySelectorAll("details.form-section").forEach((other) => {
          if (other !== sec) other.open = false;
        });
      }
    });
  });

  // Single-select Activity Category chips
  const hiddenTypeId = form.querySelector("#typeId");
  const typeChips = form.querySelectorAll(".type-chip");

  typeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      hiddenTypeId.value = chip.dataset.id;

      // Only one active at a time
      typeChips.forEach((c) => c.classList.toggle("active", c === chip));

      // Clear any prior error on typeId
      const field = form.querySelector('[data-f="typeId"]');
      if (field) {
        field.classList.remove("invalid");
        const err = field.querySelector(".err");
        if (err) err.hidden = true;
      }
    });
  });

  // Time controls: a dropdown of times (or "-:--" for none) plus the AM/PM toggle
  function initTimeControl(type, defaultAmpm) {
    const select = form.querySelector(`#${type}-time`);
    const hiddenInput = form.querySelector(`#${type}`);
    const toggle = form.querySelector(`.ampm-toggle[data-for="${type}"]`);
    if (!select || !hiddenInput || !toggle) return { setTime: () => {} };

    let ampm = defaultAmpm;

    const updateToggleUI = () => {
      toggle.querySelectorAll(".ampm-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.val === ampm);
      });
    };

    // Fill the hidden 24-hour value ("18:30") that the form actually posts
    const updateHidden = () => {
      if (!select.value) { hiddenInput.value = ""; return; }
      const [h, m] = select.value.split(":").map(Number);
      let h24 = h % 12;
      if (ampm === "PM") h24 += 12;
      hiddenInput.value = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const setTime = (h12, m, newAmpm) => {
      select.value = `${h12}:${String(m).padStart(2, "0")}`;
      ampm = newAmpm;
      updateToggleUI();
      updateHidden();
    };

    toggle.querySelectorAll(".ampm-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        ampm = btn.dataset.val;
        updateToggleUI();
        updateHidden();
        select.dispatchEvent(new Event("change"));
      });
    });

    select.addEventListener("change", updateHidden);

    updateToggleUI();
    updateHidden();
    return { setTime };
  }

  const startTimeCtrl = initTimeControl("start", "PM");
  const endTimeCtrl = initTimeControl("end", "PM");

  // Auto-fill end time to exactly 1 hour after start time
  const startSelect = form.querySelector("#start-time");
  if (startSelect) {
    const handleStartChange = () => {
      const hiddenVal = form.querySelector("#start").value;
      if (!hiddenVal || hiddenVal.length < 5) return;
      const [h24Str, mStr] = hiddenVal.split(":");
      const h24 = parseInt(h24Str, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h24) || isNaN(m)) return;

      const endH24 = (h24 + 1) % 24;
      let endH12 = endH24;
      let endAmpm = "AM";
      if (endH24 >= 12) {
        endAmpm = "PM";
        if (endH24 > 12) endH12 = endH24 - 12;
      } else if (endH24 === 0) {
        endH12 = 12;
        endAmpm = "AM";
      }

      endTimeCtrl.setTime(endH12, m, endAmpm);

      const startField = form.querySelector('[data-f="start"]');
      if (startField) {
        startField.classList.remove("invalid");
        const startErr = startField.querySelector(".err");
        if (startErr) startErr.hidden = true;
      }

      const endField = form.querySelector('[data-f="end"]');
      if (endField) {
        endField.classList.remove("invalid");
        const err = endField.querySelector(".err");
        if (err) err.hidden = true;
      }
    };

    startSelect.addEventListener("change", handleStartChange);
  }

  // Re-use a previous activity: show the list, then pre-fill everything except the date
  const reuseCheck = document.getElementById("reuse-check");
  const reusePicker = document.getElementById("reuse-picker");
  if (reuseCheck && reusePicker) {
    reuseCheck.addEventListener("change", () => { reusePicker.hidden = !reuseCheck.checked; });

    let pickedId = null;
    form.querySelectorAll(".reuse-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = Store.activity(btn.dataset.reuseId);
        if (!a) return;
        pickedId = a.id;

        // Highlight the chosen activity
        form.querySelectorAll(".reuse-item").forEach((b) => { b.style.background = "none"; b.setAttribute("aria-pressed", "false"); });
        btn.style.background = "var(--primary-soft)";
        btn.setAttribute("aria-pressed", "true");

        // Text and number fields
        const setVal = (id, v) => { const el = form.querySelector("#" + id); if (el) el.value = v ?? ""; };
        setVal("title", a.title);
        setVal("activityName", a.activityName);
        setVal("location", a.location);
        setVal("city", a.city);
        setVal("description", a.description);
        setVal("bring", a.bring);
        setVal("min", a.min);
        setVal("max", a.max);

        // Exact address: from this browser if we have it, otherwise ask Supabase (hosts can read their own)
        setVal("address", Store.address(a.id) || "");
        if (!Store.address(a.id) && Store.loadAddress) {
          Store.loadAddress(a.id).then((addr) => {
            const el = form.querySelector("#address");
            if (addr && pickedId === a.id && el && !el.value) el.value = addr; // don't overwrite a newer pick or typing
          });
        }

        // Category chip
        const matchedType = types.find((t) => t.name === a.type);
        hiddenTypeId.value = matchedType ? matchedType.id : "";
        typeChips.forEach((c) => c.classList.toggle("active", !!matchedType && String(c.dataset.id) === String(matchedType.id)));

        // Times: the dropdowns go in 15-minute steps, so round to the nearest one (6:10 PM -> 6:15 PM)
        const to12 = (iso) => {
          const d = new Date(iso);
          const mins = (Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15) % 1440;
          const h24 = Math.floor(mins / 60);
          return { h: h24 % 12 || 12, m: mins % 60, ampm: h24 >= 12 ? "PM" : "AM" };
        };
        const sT = to12(a.startsAt), eT = to12(a.endsAt);
        startTimeCtrl.setTime(sT.h, sT.m, sT.ampm);
        endTimeCtrl.setTime(eT.h, eT.m, eT.ampm);

        // Visibility
        const radio = a.visibility && form.querySelector(`input[name=visibility][value="${a.visibility}"]`);
        if (radio) radio.checked = true;

        // Clear old errors and open the first section to review
        form.querySelectorAll("[data-f]").forEach((f) => { f.classList.remove("invalid"); const err = f.querySelector(".err"); if (err) err.hidden = true; });
        form.querySelectorAll("details.form-section").forEach((sec) => sec.classList.remove("has-error"));
        const banner = document.getElementById("form-error"); if (banner) banner.hidden = true;
        const firstSec = form.querySelector("details.form-section");
        if (firstSec) firstSec.open = true;

        UI.toast(`Pre-filled from "${a.title}". Just pick a new date!`);
      });
    });
  }

  // Force strict maxlength enforcement in case pasting or browser quirks bypass it
  ["title", "activityName", "location", "city", "address", "description", "bring"].forEach((id) => {
    const el = form.querySelector("#" + id);
    if (!el) return;
    const max = el.getAttribute("maxlength");
    if (max) {
      el.addEventListener("input", () => {
        if (el.value.length > max) {
          el.value = el.value.slice(0, max);
        }
      });
    }
  });

  const val = (id) => form.querySelector("#" + id).value;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      title: val("title"), typeId: val("typeId"), activityName: val("activityName"), date: val("date"), start: val("start"), end: val("end"),
      location: val("location"), city: val("city"), address: val("address"), min: val("min"), max: val("max"),
      description: val("description"), bring: val("bring"), visibility: form.querySelector("input[name=visibility]:checked").value,
    };
    // Clear old errors (values stay where they are)
    form.querySelectorAll("[data-f]").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
    form.querySelectorAll("details.form-section").forEach((s) => s.classList.remove("has-error"));
    const banner = document.getElementById("form-error"); banner.hidden = true;
    const btn = document.getElementById("submit"); btn.disabled = true; btn.textContent = "Posting…";

    const TIME = /^([01]\d|2[0-3]):[0-5]\d$/; // a real 24-hour time, e.g. 18:30
    const timeErrs = {};
    if (data.start && !TIME.test(data.start)) timeErrs.start = "Enter a real time, like 6:30 PM.";
    if (data.end && !TIME.test(data.end)) timeErrs.end = "Enter a real time, like 7:30 PM.";
    let r;
    if (Object.keys(timeErrs).length) r = { ok: false, errors: { ...Store.validateActivity(data), ...timeErrs } };
    else {
      try { r = await Store.createActivity(data); }
      catch (err) { console.error(err); r = { ok: false, message: err.message || "Something went wrong. Please try again." }; } // never leave the button spinning
    }
    btn.disabled = false; btn.textContent = "Post activity";
    if (r.ok) { UI.flash("Activity posted"); location.href = "activity.html?id=" + r.id; return; }
    if (r.errors) {
      let firstBadSection = null;
      Object.entries(r.errors).forEach(([k, msg]) => {
        const f = form.querySelector(`[data-f="${k}"]`);
        if (f) {
          f.classList.add("invalid");
          const el = f.querySelector(".err");
          el.textContent = msg;
          el.hidden = false;
          const sec = f.closest("details.form-section");
          if (sec) {
            sec.classList.add("has-error");
            if (!firstBadSection) firstBadSection = sec;
          }
        }
      });
      if (firstBadSection) firstBadSection.open = true;
      const n = Object.keys(r.errors).length;
      banner.innerHTML = `${icon("alert", "sm")}<span>Fix ${n} field${n === 1 ? "" : "s"} to post. Everything you typed is still here.</span>`;
    } else {
      banner.innerHTML = `${icon("alert", "sm")}<span>Supabase didn't accept it: ${esc(r.message)}</span>`;
    }
    banner.hidden = false; banner.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstBad = form.querySelector(".invalid input, .invalid select, .invalid textarea");
    if (firstBad) {
      const sec = firstBad.closest("details.form-section");
      if (sec) sec.open = true;
      firstBad.focus({ preventScroll: true });
    }
  };
}, { live: false });