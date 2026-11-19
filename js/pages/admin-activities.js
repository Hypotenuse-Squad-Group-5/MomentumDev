/* Admin › Activities & official Momentum events. */
(() => {
  const { esc, when, table, confirm: askConfirm, error } = AdminUI;
  const localInput = (value) => {
    if (!value) return "";
    const d = new Date(value);
    const pad = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  const value = (form, key) => form.querySelector('[name="' + key + '"]').value.trim();
  const field = (name, label, v = "", type = "text", required = false, extra = "") =>
    '<div class="field"><label for="activity-' + name + '">' + esc(label) + '</label><input id="activity-' + name + '" name="' + name + '" type="' + type + '" value="' + esc(v ?? "") + '" ' + (required ? "required" : "") + " " + extra + "></div>";
  const area = (name, label, v = "", required = false) =>
    '<div class="field"><label for="activity-' + name + '">' + esc(label) + '</label><textarea id="activity-' + name + '" name="' + name + '" rows="3" ' + (required ? "required" : "") + '>' + esc(v ?? "") + '</textarea></div>';

  function editor(el, ctx, activity, types) {
    const a = activity || {};
    const typeOptions = types.map(t => '<option value="' + esc(t.id) + '"' + (String(t.id) === String(a.type_id || "") ? " selected" : "") + '>' + esc(t.name) + '</option>').join("");
    el.innerHTML = `<section class="panel">
      <div class="row-between"><h2 class="mb0">${activity ? "Edit activity" : "Create official Momentum event"}</h2><button type="button" class="btn btn-ghost" data-back>Back to activities</button></div>
      <p class="small muted">${activity ? "Changes apply to the activity for everyone. Existing attendee and timing rules still apply." : 'This event will appear as hosted by "Momentum".'}</p>
      <form data-activity-form>
        ${field("title","Activity title",a.title,"text",true,'maxlength="50"')}
        <div class="field"><label for="activity-type_id">Category</label><select id="activity-type_id" name="type_id" required><option value="">Choose a category</option>${typeOptions}</select></div>
        ${field("starts","Starts",localInput(a.starts_at),"datetime-local",true)}
        ${field("ends","Ends",localInput(a.ends_at),"datetime-local",true)}
        ${field("general_location","General location",a.general_location,"text",true)}
        ${field("city","City",a.city,"text",true)}
        ${field("exact_address","Exact address",a.exact_address,"text",true)}
        ${area("description","Description",a.description,true)}
        ${area("what_to_bring","What to bring",a.what_to_bring)}
        <div class="row">
          <div class="field grow"><label for="activity-min_participants">Minimum group size</label><input id="activity-min_participants" name="min_participants" type="number" min="3" max="100" value="${esc(a.min_participants ?? 3)}"></div>
          <div class="field grow"><label for="activity-max_participants">Maximum group size</label><input id="activity-max_participants" name="max_participants" type="number" min="3" max="100" value="${esc(a.max_participants ?? 100)}"></div>
        </div>
        <div class="field"><label for="activity-visibility">Visibility</label><select id="activity-visibility" name="visibility">
          <option value="public"${(a.visibility || "public") === "public" ? " selected" : ""}>Public</option>
          <option value="friends"${a.visibility === "friends" ? " selected" : ""}>Friends only</option>
        </select></div>
        ${activity ? '<label class="check small"><input type="checkbox" name="official" ' + (a.official ? "checked" : "") + '> Show as hosted by Momentum</label>' : ""}
        <p class="hint" role="alert" data-error></p>
        <div class="row mt"><button class="btn btn-primary" type="submit">${activity ? "Save changes" : "Create official event"}</button><button class="btn btn-ghost" type="button" data-back>Cancel</button></div>
      </form>
    </section>`;
    el.querySelectorAll("[data-back]").forEach(b => b.onclick = ctx.refresh);
    const form = el.querySelector("[data-activity-form]");
    form.onsubmit = async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const msg = form.querySelector("[data-error]");
      const min = value(form,"min_participants") || "3";
      const max = value(form,"max_participants") || "100";
      if (Number(min) > Number(max)) { msg.textContent = "Minimum group size can't be greater than maximum group size."; return; }
      const starts = new Date(value(form,"starts")), ends = new Date(value(form,"ends"));
      if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime())) { msg.textContent = "Enter a valid start and end date/time."; return; }
      const data = {
        title: value(form,"title"), type_id: value(form,"type_id"),
        starts_at: starts.toISOString(), ends_at: ends.toISOString(),
        general_location: value(form,"general_location"), city: value(form,"city"),
        exact_address: value(form,"exact_address"), description: value(form,"description"),
        what_to_bring: value(form,"what_to_bring"), min_participants: min, max_participants: max,
        visibility: value(form,"visibility"),
        official: activity ? form.querySelector('[name="official"]').checked : true,
      };
      submit.disabled = true;
      try {
        const res = await Store.admin.call("admin_save_activity", { p_id: activity?.id || null, p_data: data });
        if (!res.ok) throw new Error(res.message);
        UI.toast(activity ? "Activity updated." : "Official event created.");
        if (ctx.isCurrent()) ctx.refresh();
      } catch (e) {
        msg.textContent = e.message || "Couldn't save this activity.";
        submit.disabled = false;
      }
    };
  }

  AdminTabs.register({
    key: "activities", label: "Activities", order: 3,
    async render(el, ctx) {
      const [res, types] = await Promise.all([
        Store.admin.call("admin_list_activities"),
        Store.loadTypes(),
      ]);
      if (!ctx.isCurrent()) return;
      if (!res.ok) { el.innerHTML = AdminUI.error(res.message); return; }
      const rows = res.data || [];
      el.innerHTML = `<section class="panel">
        <div class="row-between"><div><h2 class="mb0">Activities</h2><p class="small muted mb0">All activities, including friends-only and cancelled events.</p></div>
          <button type="button" class="btn btn-primary" data-new>Create official event</button></div>
        ${rows.length ? AdminUI.table([
          { label: "Activity", cell: a => '<b>' + esc(a.title) + '</b>' + (a.official ? '<div><span class="tag">Hosted by Momentum</span></div>' : "") + '<div class="small muted">' + esc(a.type_name || "Uncategorized") + '</div>' },
          { label: "Date", cell: a => esc(when(a.starts_at)) },
          { label: "Host", cell: a => esc(a.host_name) },
          { label: "Going", cell: a => esc(a.going_count) + " / " + esc(a.max_participants) },
          { label: "Status", cell: a => a.cancelled_at ? '<span class="tag danger">Cancelled</span>' : new Date(a.starts_at) <= new Date() ? '<span class="tag grey">Started / past</span>' : '<span class="tag ok">Upcoming</span>' },
          { label: "Actions", className: "actions", cell: a => '<button type="button" class="btn btn-sm" data-edit="' + a.id + '"' + (a.cancelled_at || new Date(a.starts_at) <= new Date() ? " disabled" : "") + '>Edit</button> ' +
            '<button type="button" class="btn btn-sm btn-ghost" data-cancel="' + a.id + '"' + (a.cancelled_at || new Date(a.starts_at) <= new Date() ? " disabled" : "") + '>Cancel</button> ' +
            '<button type="button" class="btn btn-sm btn-danger" data-delete="' + a.id + '">Delete</button>' },
        ], rows) : AdminUI.empty("No activities have been created yet.")}
      </section>`;
      el.querySelector("[data-new]").onclick = () => editor(el, ctx, null, Store.types());
      for (const a of rows) {
        const edit = el.querySelector('[data-edit="' + a.id + '"]');
        if (edit) edit.onclick = () => editor(el, ctx, a, Store.types());
        const cancel = el.querySelector('[data-cancel="' + a.id + '"]');
        if (cancel) cancel.onclick = async () => {
          if (!await askConfirm({ title: 'Cancel "' + a.title + '"?', body: "The activity will remain in history. Everyone committed to it will be notified.", confirmLabel: "Cancel activity" }) || !ctx.isCurrent()) return;
          cancel.disabled = true;
          const out = await Store.admin.call("admin_cancel_activity", { p_activity: a.id });
          if (!out.ok) { UI.toast(out.message); cancel.disabled = false; return; }
          UI.toast("Activity cancelled. Attendees were notified.");
          if (ctx.isCurrent()) ctx.refresh();
        };
        const del = el.querySelector('[data-delete="' + a.id + '"]');
        del.onclick = async () => {
          if (!await askConfirm({ title: 'Permanently delete "' + a.title + '"?', body: "This cannot be undone. Use Cancel instead if you want to preserve the event in everyone's history.", confirmLabel: "Delete activity" }) || !ctx.isCurrent()) return;
          del.disabled = true;
          const out = await Store.admin.call("admin_delete_activity", { p_activity: a.id });
          if (!out.ok) { UI.toast(out.message); del.disabled = false; return; }
          UI.toast("Activity deleted.");
          if (ctx.isCurrent()) ctx.refresh();
        };
      }
    },
  });
})();
