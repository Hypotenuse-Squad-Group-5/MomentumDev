/* =====================================================================
   Admin › Admins: the WORKED EXAMPLE (read-only). Copy this shape for your tab.

   The pattern, start to finish:
     1. Database: momentum_private.admin_list_admins() starts with require_admin(),
        plus a public wrapper (database/032_admin.sql).
     2. Here: call it with Store.admin.call("admin_list_admins")
        -> { ok: true, data } or { ok: false, message }.
     3. Draw a loading state (admin.js does that for you), then an error, empty, or the table.
   For Create / Update / Delete, see docs/admin-guide.md (forms in UI.modal, AdminUI.confirm before deletes).
   ===================================================================== */
AdminTabs.register({
  key: "admins",
  label: "Admins",
  order: 5,
  async render(el, ctx) {
    const res = await Store.admin.call("admin_list_admins");
    if (!ctx.isCurrent()) return; // the admin switched tabs while this was loading

    if (!res.ok) { el.innerHTML = AdminUI.error(res.message); return; }
    const admins = res.data || [];
    const { esc } = AdminUI;

    el.innerHTML = `
      <section class="panel">
        <div class="row-between"><h2 class="mb0">Admins</h2><span class="small muted">${admins.length} ${admins.length === 1 ? "admin" : "admins"}</span></div>
        <p class="small muted">Who can use this page. Admins are added and removed in Supabase only (see database/032_admin.sql), so nobody can make themselves one from the app.</p>
        ${admins.length
          ? AdminUI.table([
              { label: "Name", cell: (a) => `<a href="profile.html?id=${esc(a.profile_id)}">${esc(a.first_name)}</a>${a.profile_id === Store.ME ? ' <span class="tag grey">You</span>' : ""}` },
              { label: "Username", cell: (a) => `<span class="muted">${esc(a.username || "")}</span>` },
              { label: "Note", cell: (a) => esc(a.note || "") },
              { label: "Admin since", cell: (a) => esc(AdminUI.when(a.added_at)) },
            ], admins)
          : AdminUI.empty("No admins yet.")}
      </section>`;
  },
});
