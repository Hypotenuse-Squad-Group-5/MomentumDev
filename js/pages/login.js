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

  let mode = location.hash === "#signup" ? "signup" : "signin"; // "signin" | "signup" | "check-email" (#signup comes from the landing page)
  let pendingEmail = "";
  const saved = {};          // keeps typed values when the form re-renders

  const field = (id, label, input, hint = "") =>
    `<div class="field" data-f="${id}"><label for="${id}">${label}</label>${input}${hint ? `<div class="hint">${hint}</div>` : ""}<div class="err" hidden></div></div>`;
  const EYE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  // Password box with an eye button that shows/hides the password (toggles both boxes together).
  const pw = (id, autocomplete) =>
    `<div style="position:relative"><input id="${id}" type="password" autocomplete="${autocomplete}" style="padding-right:48px">` +
    `<button type="button" class="icon-btn" data-peek="${id}" aria-label="Show password" aria-pressed="false" title="Show password" style="position:absolute;right:2px;top:1px">${EYE}</button></div>`;
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
      <p class="muted">${signup ? "Everything here is required. Other members only see your first name." : "Sign in to keep your streak going."}</p>
      <form id="auth" class="mt" novalidate>
        <div class="alert" id="form-msg" hidden></div>
        ${signup ? `<div class="grid-2">${field("first_name", "First name", text("first_name", "text", 'autocomplete="given-name" maxlength="40"'))}${field("last_name", "Last name", text("last_name", "text", 'autocomplete="family-name" maxlength="60"'), "Private")}</div>` : ""}
        ${field("email", "Email", text("email", "email", 'autocomplete="email"'), signup ? "Private. Used to sign in." : "")}
        ${field("password", "Password", pw("password", signup ? "new-password" : "current-password"), signup ? "Use upper and lowercase letters, a number, and a symbol." : "")}
        ${signup ? field("password_confirm", "Confirm password", pw("password_confirm", "new-password")) : ""}
        ${signup ? `
          ${field("sex", "Sex", `<select id="sex"><option value="">Choose</option>${[["male", "Male"], ["female", "Female"], ["prefer_not_to_say", "Prefer not to say"]].map(([v, l]) => `<option value="${v}"${saved.sex === v ? " selected" : ""}>${l}</option>`).join("")}</select>`, "Private")}
          <div class="field" data-f="age_ok"><label style="display:flex;align-items:flex-start;gap:10px;font-weight:500;cursor:pointer">
            <input type="checkbox" id="age_ok"${saved.age_ok ? " checked" : ""} style="width:20px;height:20px;margin:2px 0 0;flex-shrink:0;accent-color:var(--primary)">
            <span>I confirm I'm 18 or older and I've read the <a href="about.html" target="_blank" rel="noopener"><b>About &amp; Privacy</b></a> page.</span></label><div class="err" hidden></div></div>` : ""}
        <button class="btn btn-primary btn-block" id="submit">${signup ? "Create account" : "Sign in"}</button>
      </form>
      <p class="center small mt">${signup ? "Already have an account?" : "New to Momentum?"} <a href="#" id="switch"><b>${signup ? "Sign in" : "Sign up"}</b></a></p>
      ${Store.live ? "" : `<p class="hint center">Demo mode (no Supabase keys in js/config.js): either button signs you in as the demo user.</p>`}`;
  }

  function render() {
    main.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <section class="auth-hero">
        <a class="row" href="index.html" style="text-decoration:none" aria-label="Momentum home"><span class="brand-mark" style="background:oklch(1 0 0 / 18%)">M</span><span class="brand-name">Momentum</span></a>
        <div><p style="opacity:.75;font-weight:600">Less scrolling. More living.</p><h1>Make room for what feels real.</h1><p style="opacity:.8">Build better phone habits, find things to do nearby, and show up for them with real people.</p></div>
        <p class="small" style="opacity:.65;margin:0">Private by default · Built for meeting in person</p>
      </section>
      <section class="auth-form">${formHtml()}
        <p class="hint mt mb0">Momentum is a student class project at BYU. It isn't a company and isn't run by BYU. Please use a password you don't use anywhere else. <a href="about.html">About &amp; Privacy</a></p></section>
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
    ["first_name", "last_name", "email", "password", "password_confirm", "sex"].forEach((k) => { if (!v[k]) errs[k] = "Required."; });
    if (!v.age_ok) errs.age_ok = "You must be 18 or older to use Momentum.";
    if (v.password && v.password_confirm && v.password !== v.password_confirm) errs.password_confirm = "Passwords don't match.";
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errs.email = "Enter a valid email.";
    return errs;
  }

  // Supabase's messages, in plain words
  function friendly(error) {
    const m = (error && error.message) || "";
    if (/invalid login credentials/i.test(m)) return "Email or password is incorrect.";
    if (/email not confirmed/i.test(m)) return "Confirm your email first. Check your inbox for the link.";
    if (/database error saving new user/i.test(m)) return "Some details didn't pass our checks. Double-check every field and try again.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a few minutes and try again.";
    if (/at least one character of each/i.test(m)) return "Use at least one lowercase letter, one uppercase letter, one number, and one symbol (like ! or #).";
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
    form.querySelectorAll("input, select").forEach((el) => (el.oninput = () => { if (!isPw(el.id)) saved[el.id] = el.type === "checkbox" ? el.checked : el.value; if (isPw(el.id)) checkMatch(); }));
    // Flag a mismatch as soon as the confirm box has something in it
    function checkMatch() {
      const c = $("password_confirm"); if (!c) return;
      if (c.value && c.value !== $("password").value) fieldError("password_confirm", "Passwords don't match.");
      else clearField("password_confirm");
    }
    // Eye buttons: clicking either one shows or hides BOTH password boxes.
    const peekBtns = [...form.querySelectorAll("[data-peek]")];
    const setPeek = (show) => peekBtns.forEach((btn) => {
      $(btn.dataset.peek).type = show ? "text" : "password";
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide passwords" : "Show passwords");
      btn.title = show ? "Hide passwords" : "Show passwords";
    });
    peekBtns.forEach((btn) => {
      btn.onclick = () => setPeek($(btn.dataset.peek).type === "password");
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      form.querySelectorAll(".invalid").forEach((f) => { f.classList.remove("invalid"); f.querySelector(".err").hidden = true; });
      $("form-msg").hidden = true;

      if (!Store.live) { Store.signIn(); location.href = "home.html"; return; } // demo mode

      const v = {}; form.querySelectorAll("input, select").forEach((el) => (v[el.id] = el.type === "checkbox" ? el.checked : isPw(el.id) ? el.value : el.value.trim()));
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
        first_name: v.first_name, last_name: v.last_name, sex: v.sex, age_confirmed: v.age_ok === true,
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