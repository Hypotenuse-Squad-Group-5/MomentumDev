/* Admin › Activities & official events (owner: teammate 4). Replace the placeholder with the real tab; see docs/admin-guide.md. */
AdminTabs.register({
  key: "activities",
  label: "Activities",
  order: 3,
  render(el) {
    el.innerHTML = AdminUI.placeholder({
      title: "Activities & official events", owner: "teammate 4",
      plan: [
        ["Create", "Official event: hosted by \"Momentum\" (badge \"Hosted by Momentum\")."],
        ["Read", "Every activity, including friends-only and cancelled ones."],
        ["Update", "Edit any activity; cancel on the host's behalf (reuse the cancel rules so everyone going is notified)."],
        ["Delete", "Delete an activity (confirm first)."],
      ],
    });
  },
});
