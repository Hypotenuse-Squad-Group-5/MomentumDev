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
      <div class="field" data-f="title"><label for="title">Title</label><input id="title" type="text" maxlength="60" placeholder="e.g. Board Game Night"><div class="err" hidden></div></div>
      <div class="grid-2">
        <div class="field" data-f="typeId"><label for="typeId">Activity type</label><select id="typeId"><option value="">Choose a type</option>${types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select><div class="err" hidden></div></div>
        <div class="field" data-f="activityName"><label for="activityName">Activity</label><input id="activityName" type="text" placeholder="e.g. board games"><div class="hint">Used for search and filters.</div><div class="err" hidden></div></div>
      </div>
      <div class="field" data-f="date"><label for="date">Date</label><input id="date" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${tomorrow}"><div class="err" hidden></div></div>
      <div class="grid-2">
        <div class="field" data-f="start"><label for="start">Starts</label><input id="start" type="time"><div class="err" hidden></div></div>
        <div class="field" data-f="end"><label for="end">Ends</label><input id="end" type="time"><div class="err" hidden></div></div>
      </div>
      <div class="grid-2">
        <div class="field" data-f="location"><label for="location">General location</label><input id="location" type="text" placeholder="e.g. Kiwanis Park"><div class="hint">Shown publicly on the feed and map.</div><div class="err" hidden></div></div>
        <div class="field" data-f="city"><label for="city">City</label><input id="city" type="text" value="Provo"><div class="err" hidden></div></div>
      </div>
      <div class="field" data-f="address"><label for="address">Exact address</label><input id="address" type="text" placeholder="Street address"><div class="hint">${icon("lock", "sm")} Only shown to people after they commit.</div><div class="err" hidden></div></div>
      <div class="grid-2">
        <div class="field" data-f="min"><label for="min">Min. people</label><input id="min" type="number" min="3" max="20" value="3"><div class="err" hidden></div></div>
        <div class="field" data-f="max"><label for="max">Max. people</label><input id="max" type="number" min="3" max="20" placeholder="20"><div class="err" hidden></div></div>
      </div>
      <div class="field" data-f="description"><label for="description">Description</label><textarea id="description" maxlength="1000" placeholder="What will you do? Who is it good for?"></textarea><div class="err" hidden></div></div>
      <div class="field"><label for="bring">What to bring <span class="opt">(optional)</span></label><input id="bring" type="text" placeholder="e.g. water, a snack to share"></div>
      <div class="field"><span class="flabel">Cover photo <span class="opt">(optional)</span></span><div class="photo cover">${icon("camera", "lg")}</div><p class="hint">Photo upload comes in a later slice.</p></div>
      <fieldset class="field choice-list" style="border:0;padding:0">
        <legend class="flabel" style="font-weight:600;margin-bottom:6px">Who can see this activity?</legend>
        ${Object.entries(UI.VIS).map(([k, v]) => `<label><input type="radio" name="visibility" value="${k}"${k === s.activityVisibility ? " checked" : ""}><span><b>${v}</b>${k === "public" ? '<br><span class="small muted">Anyone on Momentum. The default.</span>' : k === "private" ? '<br><span class="small muted">Only people you invite.</span>' : ""}</span></label>`).join("")}
      </fieldset>
      ${Store.live ? "" : `<p class="hint">Only <b>Public</b> activities appear in the shared feed once Supabase is connected.</p>`}
      <button class="btn btn-primary btn-block" id="submit">Post activity</button>
    </form>
  </div>`;

  const form = document.getElementById("post-form");
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
    const banner = document.getElementById("form-error"); banner.hidden = true;
    const btn = document.getElementById("submit"); btn.disabled = true; btn.textContent = "Posting…";

    const r = await Store.createActivity(data);
    btn.disabled = false; btn.textContent = "Post activity";
    if (r.ok) { UI.flash(Store.live ? "Activity posted to Supabase" : "Activity posted"); location.href = "activity.html?id=" + r.id; return; }
    if (r.errors) {
      Object.entries(r.errors).forEach(([k, msg]) => { const f = form.querySelector(`[data-f="${k}"]`); if (f) { f.classList.add("invalid"); const el = f.querySelector(".err"); el.textContent = msg; el.hidden = false; } });
      const n = Object.keys(r.errors).length;
      banner.innerHTML = `${icon("alert", "sm")}<span>Fix ${n} field${n === 1 ? "" : "s"} to post. Everything you typed is still here.</span>`;
    } else {
      banner.innerHTML = `${icon("alert", "sm")}<span>Supabase didn't accept it: ${esc(r.message)}</span>`;
    }
    banner.hidden = false; banner.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstBad = form.querySelector(".invalid input, .invalid select, .invalid textarea"); if (firstBad) firstBad.focus({ preventScroll: true });
  };
}, { live: false });
