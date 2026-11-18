/* Admin › Accounts (owner: teammate 2). Replace the placeholder with the real tab; see docs/admin-guide.md. */
AdminTabs.register({
  key: "accounts",
  label: "Accounts",
  order: 1,
  render(el) {
    el.innerHTML = AdminUI.placeholder({
      title: "Accounts", owner: "teammate 2",
      plan: [
        ["Create", "Add user: email + temporary password, through a Supabase Edge Function (needs the service key, which never goes in the website). Or skip, if the professor agrees."],
        ["Read", "Search every account by name or username; show joined date and whether suspended."],
        ["Update", "Edit name, bio and photo; suspend and unsuspend."],
        ["Delete", "Delete an account (same approach as delete_my_account, behind require_admin)."],
      ],
    });
  },
});
