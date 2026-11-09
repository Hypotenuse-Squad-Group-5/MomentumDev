/* Post an activity: THE VERTICAL SLICE.
   Submits to Supabase when js/config.js has keys; otherwise saves in this browser.
   PL-6: missing/invalid fields block posting, are flagged, and everything typed stays put. */
UI.mount("activities", async function render() {
  const { icon, esc } = UI;
  const types = await Store.loadTypes();
  const s = Store.state.settings;
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  document.getElementById("main").innerHTML = `
  <div style="max-width:720px">
    <a class="small" href="activities.html">‹ Cancel</a>
    <div class="page-head mt"><div><h1>Post an activity</h1><p class="muted mb0">Bring people together, in person.</p></div>
      <span class="mode-badge${Store.live ? " live" : ""}" title="${Store.live ? "Connected to your Supabase project" : "No Supabase keys in js/config.js yet"}">Saved to: ${Store.live ? "Supabase" : "this browser"}</span></div>

    <form class="panel" id="post-form" novalidate>
      <div class="alert" id="form-error" hidden></div>

      <!-- Section 1: Details & Location -->
      <details class="form-section" name="post-section" open>
        <summary>
          <div class="form-section-title">
            <span class="form-section-name">Details & Location</span>
            <span class="form-section-desc">Title, activity type, location & description</span>
          </div>
          <span class="form-section-chevron"></span>
        </summary>
        <div class="form-section-body">
          <div class="field" data-f="title"><label for="title">Title</label><input id="title" type="text" maxlength="60" placeholder="e.g. Board Game Night"><div class="err" hidden></div></div>
          <div class="grid-2">
            <div class="field" data-f="typeId"><label for="typeId">Activity type</label><select id="typeId"><option value="">Choose a type</option>${types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select><div class="err" hidden></div></div>
            <div class="field" data-f="activityName"><label for="activityName">Activity</label><input id="activityName" type="text" maxlength="40" placeholder="e.g. board games"><div class="hint">Used for search and filters.</div><div class="err" hidden></div></div>
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
          <datalist id="time-suggestions">
            <option value="6:00"></option><option value="6:30"></option><option value="7:00"></option><option value="7:30"></option>
            <option value="8:00"></option><option value="8:30"></option><option value="9:00"></option><option value="9:30"></option>
            <option value="10:00"></option><option value="10:30"></option><option value="11:00"></option><option value="11:30"></option>
            <option value="12:00"></option><option value="12:30"></option><option value="1:00"></option><option value="1:30"></option>
            <option value="2:00"></option><option value="2:30"></option><option value="3:00"></option><option value="3:30"></option>
            <option value="4:00"></option><option value="4:30"></option><option value="5:00"></option><option value="5:30"></option>
          </datalist>
          <div class="grid-2">
            <div class="field" data-f="start">
              <label for="start-time">Starts</label>
              <div class="time-control">
                <input id="start-time" class="time-text-input" type="text" placeholder="6:00" list="time-suggestions" autocomplete="off" maxlength="8">
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
                <input id="end-time" class="time-text-input" type="text" placeholder="7:00" list="time-suggestions" autocomplete="off" maxlength="8">
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
            <span class="form-section-desc">Items to bring, cover photo & visibility</span>
          </div>
          <span class="form-section-chevron"></span>
        </summary>
        <div class="form-section-body">
          <div class="field"><label for="bring">What to bring <span class="opt">(optional)</span></label><input id="bring" maxlength="80" type="text" placeholder="e.g. water, a snack to share"></div>
          <div class="field"><span class="flabel">Cover photo <span class="opt">(optional)</span></span><div class="photo cover">${icon("camera", "lg")}</div><p class="hint">Photo upload comes in a later slice.</p></div>
          <fieldset class="field choice-list" style="border:0;padding:0">
            <legend class="flabel" style="font-weight:600;margin-bottom:6px">Who can see this activity?</legend>
            ${Object.entries(UI.VIS).map(([k, v]) => `<label><input type="radio" name="visibility" value="${k}"${k === s.activityVisibility ? " checked" : ""}><span><b>${v}</b>${k === "public" ? '<br><span class="small muted">Anyone on Momentum. The default.</span>' : k === "private" ? '<br><span class="small muted">Only people you invite.</span>' : ""}</span></label>`).join("")}
          </fieldset>
        </div>
      </details>

      ${Store.live ? "" : `<p class="hint">Only <b>Public</b> activities appear in the shared feed once Supabase is connected.</p>`}
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

  // Time controls with AM/PM toggle
  function initTimeControl(type, defaultHour, defaultMin, defaultAmpm) {
    const textInput = form.querySelector(`#${type}-time`);
    const hiddenInput = form.querySelector(`#${type}`);
    const toggle = form.querySelector(`.ampm-toggle[data-for="${type}"]`);
    if (!textInput || !hiddenInput || !toggle) return { setTime: () => {} };

    let ampm = defaultAmpm;

    const updateToggleUI = () => {
      toggle.querySelectorAll(".ampm-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.val === ampm);
      });
    };

    const updateHidden = () => {
      let val = textInput.value.trim().toLowerCase();
      if (!val) { hiddenInput.value = ""; return; }
      if (val.includes("am")) { ampm = "AM"; val = val.replace(/am/g, "").trim(); }
      else if (val.includes("pm")) { ampm = "PM"; val = val.replace(/pm/g, "").trim(); }
      updateToggleUI();

      const parts = val.split(":");
      let h = parseInt(parts[0], 10);
      let m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      if (isNaN(h)) { hiddenInput.value = ""; return; }
      if (isNaN(m) || m < 0) m = 0;
      if (m > 59) m = 59;

      if (h > 12) {
        ampm = "PM";
        h -= 12;
        updateToggleUI();
      } else if (h === 0) {
        h = 12;
        ampm = "AM";
        updateToggleUI();
      }

      let h24 = h;
      if (ampm === "PM" && h < 12) h24 += 12;
      if (ampm === "AM" && h === 12) h24 = 0;
      hiddenInput.value = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const setTime = (h12, m, newAmpm) => {
      textInput.value = `${h12}:${String(m).padStart(2, "0")}`;
      ampm = newAmpm;
      updateToggleUI();
      updateHidden();
    };

    toggle.querySelectorAll(".ampm-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        ampm = btn.dataset.val;
        updateToggleUI();
        updateHidden();
        textInput.dispatchEvent(new Event("change"));
      });
    });

    textInput.addEventListener("input", updateHidden);
    textInput.addEventListener("change", updateHidden);

    setTime(defaultHour, defaultMin, defaultAmpm);
    return { setTime };
  }

  const startTimeCtrl = initTimeControl("start", 6, 0, "PM");
  const endTimeCtrl = initTimeControl("end", 7, 0, "PM");

  // Auto-fill end time to exactly 1 hour after start time
  const startTextInput = form.querySelector("#start-time");
  if (startTextInput) {
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

      const endField = form.querySelector('[data-f="end"]');
      if (endField) {
        endField.classList.remove("invalid");
        const err = endField.querySelector(".err");
        if (err) err.hidden = true;
      }
    };

    startTextInput.addEventListener("input", handleStartChange);
    startTextInput.addEventListener("change", handleStartChange);
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

    const r = await Store.createActivity(data);
    btn.disabled = false; btn.textContent = "Post activity";
    if (r.ok) { UI.flash(Store.live ? "Activity posted to Supabase" : "Activity posted"); location.href = "activity.html?id=" + r.id; return; }
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