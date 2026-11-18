/* Admin › App lists (owner: teammate 1). Replace the placeholder with the real tab; see docs/admin-guide.md. */
AdminTabs.register({
  key: "lists",
  label: "App lists",
  order: 4,
  render(el) {
    el.innerHTML = AdminUI.placeholder({
      title: "App lists", owner: "teammate 1",
      plan: [
        ["Create", "Add an activity category, an interest, or an activity idea."],
        ["Read", "All three lists (activity_types, interests, activity_suggestions) in their display order."],
        ["Update", "Rename and reorder."],
        ["Delete", "Retire (hide from new choices). Categories in use can't be hard-deleted: activities point to them."],
      ],
    });
  },
});
