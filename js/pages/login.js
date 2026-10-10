/* Login. No real accounts yet: both buttons sign you in as the demo user (Chase).
   Once signed in, opening the site skips straight to Home. */
(function () {
  if (Store.state.signedIn && !location.search.includes("stay")) { location.replace("home.html"); return; }
  let signup = false;
  function render() {
    const { esc } = UI;
    document.getElementById("main").innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <section class="auth-hero">
        <div class="row"><span class="brand-mark" style="background:oklch(1 0 0 / 18%)">M</span><span class="brand-name">Momentum</span></div>
        <div><p style="opacity:.75;font-weight:600">Less scrolling. More living.</p><h1>Make room for what feels real.</h1><p style="opacity:.8">Build better phone habits, find things to do nearby, and show up for them with real people.</p></div>
        <p class="small" style="opacity:.65;margin:0">Private by default · Built for meeting in person</p>
      </section>
      <section class="auth-form">
        <h2>${signup ? "Create your account" : "Welcome back"}</h2>
        <p class="muted">${signup ? "Start making time for what matters." : "Sign in to keep your streak going."}</p>
        <form id="auth" class="mt" novalidate>
          ${signup ? `<div class="field"><label for="name">First name</label><input id="name" type="text" autocomplete="given-name"></div>` : ""}
          <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${signup ? "new-password" : "current-password"}"></div>
          ${signup ? `<label class="check field"><input type="checkbox"> <span>I agree to the terms and community guidelines</span></label>` : `<label class="check field"><input type="checkbox" checked> <span>Keep me signed in</span></label>`}
          <button class="btn btn-primary btn-block">${signup ? "Create account" : "Sign in"}</button>
        </form>
        <p class="center small mt">${signup ? "Already have an account?" : "New to Momentum?"} <a href="#" id="switch"><b>${signup ? "Sign in" : "Sign up"}</b></a></p>
        <p class="hint center">Demo: real accounts come in a later slice. Either button signs you in as Chase.</p>
      </section>
    </div></div>`;
    document.getElementById("switch").onclick = (e) => { e.preventDefault(); signup = !signup; render(); };
    document.getElementById("auth").onsubmit = (e) => { e.preventDefault(); Store.signIn(); location.href = "home.html"; };
  }
  render();
})();
