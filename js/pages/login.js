/* Sign in / sign up.
   With Supabase keys in js/config.js: real accounts (Supabase Auth).
   Without keys: demo mode, either button signs you in as the demo user. */
(async function () {
  const { esc } = UI;
  const main = document.getElementById("main");

  // Already signed in (including arriving from the confirmation email link)? Go home.
  if (Store.live) {
    const session = await Store.auth.session();
    if (session) { Store.signIn(); location.replace("home.html"); return; }
  } else if (Store.state.signedIn && !location.search.includes("stay")) {
    location.replace("home.html"); return;
  }

  const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  let mode = "signin";      // "signin" | "signup" | "check-email"
  let pendingEmail = "";
  const saved = {};          // keeps typed values when the form re-renders

  const field = (id, label, input, hint = "") =>
    `<div class="field" data-f="${id}"><label for="${id}">${label}</label>${input}${hint ? `<div class="hint">${hint}</div>` : ""}<div class="err" hidden></div></div>`;
  const EYE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  // Password box with a "hold to show" eye: visible only while pressed, hidden the moment you let go.
  const pw = (id, autocomplete) =>
    `<div style="position:relative"><input id="${id}" type="password" autocomplete="${autocomplete}" style="padding-right:48px">` +
    `<button type="button" class="icon-btn" data-peek="${id}" aria-label="Hold to show password" title="Hold to show" style="position:absolute;right:2px;top:1px;touch-action:none">${EYE}</button></div>`;
  const text = (id, type = "text", attrs = "") => `<input id="${id}" type="${type}" value="${esc(saved[id] || "")}" ${attrs}>`;

  function formHtml() {
    if (mode === "check-email") {
      return `<h2>Check your email</h2>
        <p>We sent a confirmation link to <b>${esc(pendingEmail)}</b>. Click it to finish creating your account, and you'll land back here signed in.</p>
        <p class="hint">Not there? Check spam, or resend it. Emails can take a minute.</p>
        <div class="row mt"><button class="btn" id="resend">Resend email</button><button class="btn btn-ghost" id="back">Back to sign in</button></div>
        <div class="alert mt" id="form-msg" hidden></div>`;
    }
    const signup = mode === "signup";
    return `<h2>${signup ? "Create your account" : "Welcome back"}</h2>
      <p class="muted">${signup ? "Everything here is required. Only your first name, city, and state are visible to other people." : "Sign in to keep your streak going."}</p>
      <form id="auth" class="mt" novalidate>
        <div class="alert" id="form-msg" hidden></div>
        ${signup ? `<div class="grid-2">${field("first_name", "First name", text("first_name", "text", 'autocomplete="given-name" maxlength="40"'))}${field("last_name", "Last name", text("last_name", "text", 'autocomplete="family-name" maxlength="60"'), "Private")}</div>` : ""}
        ${field("email", "Email", text("email", "email", 'autocomplete="email"'), signup ? "Private. Used to sign in." : "")}
        ${field("password", "Password", pw("password", signup ? "new-password" : "current-password"))}
        ${signup ? field("password_confirm", "Confirm password", pw("password_confirm", "new-password")) : ""}
        ${signup ? `
          ${field("phone", "Phone", text("phone", "tel", 'autocomplete="tel" placeholder="(801) 555-0123"'), "Private")}
          ${field("home_address", "Home address", text("home_address", "text", 'autocomplete="street-address"'), "Private. Never shown to anyone.")}
          <div class="grid-2">
            ${field("city", "City", text("city", "text", 'autocomplete="address-level2"'))}
            ${field("state", "State", `<select id="state" autocomplete="address-level1"><option value="">Choose</option>${STATES.map((s) => `<option${saved.state === s ? " selected" : ""}>${s}</option>`).join("")}</select>`)}
          </div>
          <div class="grid-2">
            ${field("zip_code", "Zip code", text("zip_code", "text", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"'), "Private")}
            ${field("birthdate", "Birthdate", text("birthdate", "date", 'autocomplete="bday"'), "Private. You must be 18+.")}
          </div>
          ${field("sex", "Sex", `<select id="sex"><option value="">Choose</option>${[["male", "Male"], ["female", "Female"], ["prefer_not_to_say", "Prefer not to say"]].map(([v, l]) => `<option value="${v}"${saved.sex === v ? " selected" : ""}>${l}</option>`).join("")}</select>`, "Private")}` : ""}
        <button class="btn btn-primary btn-block" id="submit">${signup ? "Create account" : "Sign in"}</button>
      </form>
      <p class="center small mt">${signup ? "Already have an account?" : "New to Momentum?"} <a href="#" id="switch"><b>${signup ? "Sign in" : "Sign up"}</b></a></p>
      ${Store.live ? "" : `<p class="hint center">Demo mode (no Supabase keys in js/config.js): either button signs you in as the demo user.</p>`}`;
  }

  function render() {
    main.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <section class="auth-hero">
        <div class="row"><span class="brand-mark" style="background:oklch(1 0 0 / 18%)">M</span><span class="brand-name">Momentum</span></div>
        <div><p style="opacity:.75;font-weight:600">Less scrolling. More living.</p><h1>Make room for what feels real.</h1><p style="opacity:.8">Build better phone habits, find things to do nearby, and show up for them with real people.</p></div>
        <p class="small" style="opacity:.65;margin:0">Private by default · Built for meeting in person</p>
      </section>
      <section class="auth-form">${formHtml()}</section>
    </div></div>`;
    bind();
  }

  const $ = (id) => document.getElementById(id);
  function showMsg(text, kind = "") { const m = $("form-msg"); m.className = "alert" + (kind ? " " + kind : "") + " mt"; m.textContent = text; m.hidden = false; }
  function clearField(id) { const f = document.querySelector(`[data-f="${id}"]`); if (!f) return; f.classList.remove("invalid"); f.querySelector(".err").hidden = true; }
  function fieldError(id, msg) { const f = document.querySelector(`[data-f="${id}"]`); if (!f) return; f.classList.add("invalid"); const e = f.querySelector(".err"); e.textContent = msg; e.hidden = false; }

  // Same rules the database enforces, checked here first so people get clear messages.
  function validateSignup(v) {
    const errs = {};
    ["first_name", "last_name", "email", "password", "password_confirm", "phone", "home_address", "city", "state", "zip_code", "birthdate", "sex"].forEach((k) => { if (!v[k]) errs[k] = "Required."; });
    if (v.password && v.password_confirm && v.password !== v.password_confirm) errs.password_confirm = "Passwords don't match.";
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errs.email = "Enter a valid email.";
    if (v.phone) { const d = v.phone.replace(/\D/g, ""); if (d.length < 10 || d.length > 15) errs.phone = "Enter a full phone number."; }
    if (v.home_address && v.home_address.length < 5) errs.home_address = "Enter your full street address.";
    if (v.zip_code && !/^[0-9]{5}$/.test(v.zip_code)) errs.zip_code = "Use a 5-digit zip code.";
    if (v.birthdate) {
      const b = new Date(v.birthdate + "T00:00"), adult = new Date(); adult.setFullYear(adult.getFullYear() - 18);
      if (b > adult) errs.birthdate = "You must be 18 or older to use Momentum.";
      else if (b.getFullYear() < 1900) errs.birthdate = "Enter a real birthdate.";
    }
    return errs;
  }

  // Supabase's messages, in plain words
  function friendly(error) {
    const m = (error && error.message) || "";
    if (/invalid login credentials/i.test(m)) return "Email or password is incorrect.";
    if (/email not confirmed/i.test(m)) return "Confirm your email first. Check your inbox for the link.";
    if (/database error saving new user/i.test(m)) return "Some details didn't pass our checks. Double-check every field and try again.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a few minutes and try again.";
    if (/password/i.test(m)) return m; // password rules from your Supabase settings
    return m || "Something went wrong. Try again.";
  }

  function bind() {
    if (mode === "check-email") {
      $("back").onclick = () => { mode = "signin"; render(); };
      $("resend").onclick = async () => {
        const { error } = await Store.auth.resendConfirmation(pendingEmail);
        showMsg(error ? friendly(error) : "Sent. Check your inbox.", error ? "" : "ok");
      };
      return;
    }
    $("switch").onclick = (e) => { e.preventDefault(); mode = mode === "signup" ? "signin" : "signup"; render(); };
    const form = $("auth");
    const isPw = (id) => id === "password" || id === "password_confirm";
    form.querySelectorAll("input, select").forEach((el) => (el.oninput = () => { if (!isPw(el.id)) saved[el.id] = el.value; if (isPw(el.id)) checkMatch(); }));
    // Flag a mismatch as soon as the confirm box has something in it
    function checkMatch() {
      const c = $("password_confirm"); if (!c) return;
      if (c.value && c.value !== $("password").value) fieldError("password_confirm", "Passwords don't match.");
      else clearField("password_confirm");
    }
    form.querySelectorAll("[data-peek]").forEach((btn) => {
      const input = $(btn.dataset.peek);
      const show = (e) => { if (e) e.preventDefault(); input.type = "text"; };
      const hide = () => { input.type = "password"; };
      btn.addEventListener("pointerdown", show);
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, hide));
      btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) show(e); });
      btn.addEventListener("keyup", hide);
      btn.addEventListener("blur", hide);
      btn.addEventListener("contextmenu", (e) => e.preventDefault()); // long-press on phones
    });
    window.addEventListener("blur", () => form.querySelectorAll("[data-peek]").forEach((b) => ($(b.dataset.peek).type = "password")));
    form.onsubmit = async (e) => {
      e.preventDefault();
      form.querySelectorAll(".invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
      $("form-msg").hidden = true;

      if (!Store.live) { Store.signIn(); location.href = "home.html"; return; } // demo mode

      const v = {}; form.querySelectorAll("input, select").forEach((el) => (v[el.id] = isPw(el.id) ? el.value : el.value.trim()));
      const btn = $("submit"); const label = btn.textContent;
      const busy = (on) => { btn.disabled = on; btn.textContent = on ? "One moment…" : label; };

      if (mode === "signin") {
        if (!v.email || !v.password) { if (!v.email) fieldError("email", "Required."); if (!v.password) fieldError("password", "Required."); return; }
        busy(true);
        const { error } = await Store.auth.signIn(v.email, v.password);
        busy(false);
        if (error) return showMsg(friendly(error));
        Store.signIn(); location.href = "home.html";
        return;
      }

      const errs = validateSignup(v);
      if (Object.keys(errs).length) {
        Object.entries(errs).forEach(([k, m]) => fieldError(k, m));
        showMsg("Fix the highlighted fields. Everything you typed is still here.");
        return form.querySelector(".invalid input, .invalid select").focus();
      }
      busy(true);
      const { data, error } = await Store.auth.signUp(v.email, v.password, {
        first_name: v.first_name, last_name: v.last_name, phone: v.phone, home_address: v.home_address,
        city: v.city, state: v.state, zip_code: v.zip_code, sex: v.sex, birthdate: v.birthdate,
      });
      busy(false);
      if (error) return showMsg(friendly(error));
      // With email confirmation on, Supabase hides whether an email is already registered:
      // an existing address comes back as a "user" with no identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return showMsg("An account with that email may already exist. Try signing in instead.");
      }
      if (data.session) { Store.signIn(); location.href = "home.html"; return; } // confirmation turned off
      pendingEmail = v.email; mode = "check-email"; render();
    };
  }

  render();
})();
