/* Admin › Posts & announcements (owner: teammate 3). Replace the placeholder with the real tab; see docs/admin-guide.md. */
AdminTabs.register({
  key: "posts",
  label: "Posts",
  order: 2,
  render(el) {
    el.innerHTML = AdminUI.placeholder({
      title: "Posts & announcements", owner: "teammate 3",
      plan: [
        ["Create", "Announcement: shown to everyone (past the friends-only rule), pinned in the feed, author shown as \"Momentum\"."],
        ["Read", "Every post site-wide, newest first, with author and date."],
        ["Update", "Edit a post's text, or hide it."],
        ["Delete", "Delete a post (confirm first)."],
      ],
    });
  },
});
