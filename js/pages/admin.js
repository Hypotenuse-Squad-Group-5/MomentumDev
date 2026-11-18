/* =====================================================================
   Admin page (migration 032; guide: docs/admin-guide.md)

   - Only admins see "Admin" in the menu (Settings › Admin mode). Non-admins who open
     admin.html get "Admins only". Either way the DATABASE checks admin rights on every
     admin action (momentum_private.require_admin), so this page is only the interface.
   - Each tab is its own file (js/pages/admin-*.js) that registers itself:

       AdminTabs.register({
         key: "posts",            // used in the address: admin.html#posts
         label: "Posts",          // tab name
         order: 2,                // left-to-right position
         async render(el, ctx) {  // draw the tab into `el`; call ctx.refresh() to redraw it
           ...
         },
       });

   - AdminUI below has small shared helpers so every tab looks and behaves the same.
   ===================================================================== */
window.AdminTabs = {
  list: [],
  register(tab) { this.list.push(tab); this.list.sort((a, b) => (a.order || 99) - (b.order || 99)); },
};

window.AdminUI = (() => {
  const { esc, icon } = UI;
  return {
    // Loading / error / empty states
    loading: () => '<div class="panel admin-state"><span class="muted">Loading…</span></div>',
    error: (message) => `<div class="panel admin-state"><p class="mb0" style="color:var(--danger)"><b>Something went wrong.</b> ${esc(message || "")}</p><button class="btn mt" data-admin-retry>${icon("refresh", "sm")}Try again</button></div>`,
    empty: (text) => `<div class="panel admin-state"><span class="muted">${esc(text)}</span></div>`,

    // A data table. columns: [{ label, cell: (row) => html, className? }]. Cell html is NOT escaped: use AdminUI.esc for text.
    table(columns, rows) {
      return `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr>${columns.map((c) => `<th scope="col"${c.className ? ` class="${c.className}"` : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td${c.className ? ` class="${c.className}"` : ""}>${c.cell(r)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
    },

    // "Are you sure?" dialog -> Promise<boolean>. Use before every delete.
    confirm({ title, body = "", confirmLabel = "Delete", danger = true } = {}) {
      return new Promise((resolve) => {
        let answered = false;
        UI.modal(`<h2>${esc(title)}</h2>${body ? `<p>${body}</p>` : ""}<div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn ${danger ? "btn-danger solid" : "btn-primary"}" id="admin-confirm-yes">${esc(confirmLabel)}</button></div>`, {
          onMount(m, close) {
            m.querySelector("#admin-confirm-yes").onclick = () => { answered = true; close(); resolve(true); };
            const done = () => { if (!answered) resolve(false); };
            m.closest(".modal-backdrop").addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target.classList.contains("modal-backdrop")) setTimeout(done); });
            document.addEventListener("keydown", function onEsc(e) { if (e.key === "Escape") { document.removeEventListener("keydown", onEsc); setTimeout(done); } });
          },
        });
      });
    },

    // "Not built yet" card for a tab whose owner hasn't started. Replace it with your real tab.
    placeholder({ title, owner, plan }) {
      return `<section class="panel"><div class="row-between"><h2 class="mb0">${esc(title)}</h2><span class="tag grey">Not built yet</span></div>
        <p class="small muted">Owner: ${esc(owner)}. Plan (see docs/admin-guide.md):</p>
        <ul class="admin-plan">${plan.map(([letter, text]) => `<li><b>${esc(letter)}</b><span>${esc(text)}</span></li>`).join("")}</ul></section>`;
    },

    // Short date + time, e.g. "Nov 18, 2026, 1:48 PM"
    when: (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""),
    esc,
  };
})();

UI.mount("admin", function render() {
  const main = document.getElementById("main");
  if (!Store.adminChecked()) { main.innerHTML = AdminUI.loading(); Store.checkAdmin().then(render); return; }
  if (!Store.isAdmin()) {
    main.innerHTML = `<div class="panel center" style="max-width:480px;margin:40px auto">
      <h1>Admins only</h1><p class="muted">This page is for Momentum admins.</p>
      <a class="btn btn-primary" href="home.html">Go home</a></div>`;
    return;
  }
  const tabs = AdminTabs.list;
  const current = () => tabs.find((t) => "#" + t.key === location.hash) || tabs[0];
  main.innerHTML = `
    <div class="page-head"><div><h1>Admin</h1><p class="muted mb0">Manage Momentum. Changes here affect everyone, so take care.</p></div></div>
    <nav class="subnav admin-tabs" aria-label="Admin sections">${tabs.map((t) => `<a href="#${t.key}" data-tab="${t.key}">${UI.esc(t.label)}</a>`).join("")}</nav>
    <div id="admin-tab"></div>`;

  let drawing = 0;
  async function renderTab() {
    const tab = current(), el = document.getElementById("admin-tab"), mine = ++drawing;
    main.querySelectorAll(".admin-tabs a").forEach((a) => {
      const on = a.dataset.tab === tab.key;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    el.innerHTML = AdminUI.loading();
    try {
      await tab.render(el, { refresh: renderTab, isCurrent: () => mine === drawing });
    } catch (e) {
      if (mine !== drawing) return;
      el.innerHTML = AdminUI.error(e && e.message);
    }
    const retry = el.querySelector("[data-admin-retry]");
    if (retry) retry.onclick = renderTab;
  }
  window.onhashchange = renderTab;
  renderTab();
}, { live: false }); // tabs manage their own data, so background updates don't wipe a half-filled form
