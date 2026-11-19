/* =====================================================================
   Admin › Posts & announcements (teammate 3)
   Full CRUD for posts and announcements:
     - Create: announcements pinned to the feed, branded as Momentum
     - Read: every post site-wide, newest first, with author and status tags
     - Update: edit post caption (tags non-announcements as "Edited by admin")
               hide/unhide posts from public feeds
     - Delete: permanently delete post and send notification with optional reason
   ===================================================================== */
AdminTabs.register({
  key: "posts",
  label: "Posts",
  order: 2,
  async render(el, ctx) {
    const res = await Store.admin.call("admin_list_posts");
    if (!ctx.isCurrent()) return;

    if (!res.ok) {
      el.innerHTML = AdminUI.error(res.message);
      return;
    }

    const posts = res.data || [];
    const { esc, when } = AdminUI;

    el.innerHTML = `
      <section class="panel">
        <div class="row-between">
          <div>
            <h2 class="mb0">Posts &amp; announcements</h2>
            <p class="small muted mb0">Moderate community posts or create official Momentum announcements.</p>
          </div>
          <button class="btn btn-primary" id="btn-create-announcement">${UI.icon("plus", "sm")}Create announcement</button>
        </div>
        ${posts.length ? AdminUI.table([
          {
            label: "Post",
            cell: (p) => {
              const tags = [];
              if (p.is_announcement) tags.push('<span class="tag">Announcement</span>');
              if (p.is_hidden) tags.push('<span class="tag danger">Hidden</span>');
              if (p.edited_by_admin) tags.push('<span class="tag grey">Edited by admin</span>');
              return `
                <div class="mb-xs" style="white-space:pre-wrap;max-width:480px;word-break:break-word;"><b>${esc(p.caption)}</b></div>
                <div class="row" style="gap:4px;flex-wrap:wrap;">${tags.join(" ")}</div>
                ${p.activity_title ? `<div class="small muted mt-xs">${UI.icon("activity", "sm")}Activity: ${esc(p.activity_title)}</div>` : ""}
              `;
            },
          },
          {
            label: "Author",
            cell: (p) => {
              if (p.is_announcement) {
                return '<span class="bold">Momentum</span> <span class="tag">Official</span>';
              }
              const isMe = p.author_id === Store.ME;
              return `<a href="profile.html?id=${esc(p.author_id)}">${esc(p.author_name || "Unknown")}</a>` +
                (p.author_username ? ` <span class="muted small">@${esc(p.author_username)}</span>` : "") +
                (isMe ? ' <span class="tag grey">You</span>' : "");
            },
          },
          {
            label: "Date",
            cell: (p) => `<span class="small muted">${esc(when(p.created_at))}</span>`,
          },
          {
            label: "Actions",
            className: "actions",
            cell: (p) => `
              <button class="btn btn-sm btn-ghost" data-edit="${esc(p.id)}">Edit</button>
              <button class="btn btn-sm ${p.is_hidden ? "btn-primary" : "btn-ghost"}" data-hide="${esc(p.id)}">${p.is_hidden ? "Unhide" : "Hide"}</button>
              <button class="btn btn-sm btn-danger" data-del="${esc(p.id)}">Delete</button>
            `,
          },
        ], posts) : AdminUI.empty("No posts yet.")}
      </section>
    `;

    // 1. CREATE ANNOUNCEMENT
    const createBtn = el.querySelector("#btn-create-announcement");
    if (createBtn) {
      createBtn.onclick = () => {
        UI.modal(`
          <h2>Create announcement</h2>
          <p class="small muted">Announcements appear pinned at the top of everyone's feed, branded as <b>Momentum</b>.</p>
          <div class="field">
            <label for="f-announcement-caption">Announcement text</label>
            <textarea id="f-announcement-caption" rows="4" maxlength="500" placeholder="Share an update or event with the community…" required></textarea>
            <div class="hint">1 to 500 characters.</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary" id="btn-save-announcement">Post announcement</button>
          </div>
        `, {
          onMount(m, close) {
            const textarea = m.querySelector("#f-announcement-caption");
            textarea.focus();
            m.querySelector("#btn-save-announcement").onclick = async () => {
              const text = textarea.value.trim();
              if (!text) {
                UI.toast("Please enter announcement text.");
                textarea.focus();
                return;
              }
              const saveBtn = m.querySelector("#btn-save-announcement");
              saveBtn.disabled = true;
              const r = await Store.admin.call("admin_create_announcement", { p_caption: text });
              if (!r.ok) {
                saveBtn.disabled = false;
                return UI.toast(r.message || "Failed to create announcement.");
              }
              close();
              UI.toast("Announcement posted.");
              if (ctx.isCurrent()) ctx.refresh();
            };
          },
        });
      };
    }

    // 2. EDIT POST
    el.querySelectorAll("[data-edit]").forEach((b) => {
      b.onclick = () => {
        const post = posts.find((p) => String(p.id) === b.dataset.edit);
        if (!post) return;
        const isOtherUser = post.author_id !== Store.ME && !post.is_announcement;

        UI.modal(`
          <h2>Edit post</h2>
          ${isOtherUser ? '<div class="alert warn mb"><span>Editing another user\'s post will display an <b>"Edited by admin"</b> badge on the post.</span></div>' : ""}
          <div class="field">
            <label for="f-edit-caption">Caption</label>
            <textarea id="f-edit-caption" rows="4" maxlength="500" required>${esc(post.caption)}</textarea>
            <div class="hint">Up to 500 characters.</div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-primary" id="btn-save-edit">Save changes</button>
          </div>
        `, {
          onMount(m, close) {
            const textarea = m.querySelector("#f-edit-caption");
            textarea.focus();
            m.querySelector("#btn-save-edit").onclick = async () => {
              const text = textarea.value.trim();
              if (!text) {
                UI.toast("Post caption cannot be empty.");
                textarea.focus();
                return;
              }
              const saveBtn = m.querySelector("#btn-save-edit");
              saveBtn.disabled = true;
              const r = await Store.admin.call("admin_update_post", { p_id: post.id, p_caption: text });
              if (!r.ok) {
                saveBtn.disabled = false;
                return UI.toast(r.message || "Failed to update post.");
              }
              close();
              UI.toast("Post updated.");
              if (ctx.isCurrent()) ctx.refresh();
            };
          },
        });
      };
    });

    // 3. HIDE / UNHIDE POST
    el.querySelectorAll("[data-hide]").forEach((b) => {
      b.onclick = async () => {
        const post = posts.find((p) => String(p.id) === b.dataset.hide);
        if (!post) return;
        const targetHidden = !post.is_hidden;
        b.disabled = true;
        const r = await Store.admin.call("admin_set_post_hidden", { p_id: post.id, p_hidden: targetHidden });
        if (!r.ok) {
          b.disabled = false;
          return UI.toast(r.message || "Failed to change post status.");
        }
        UI.toast(targetHidden ? "Post hidden from feed." : "Post unhidden.");
        if (ctx.isCurrent()) ctx.refresh();
      };
    });

    // 4. DELETE POST (with optional reason to notify author)
    el.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = () => {
        const post = posts.find((p) => String(p.id) === b.dataset.del);
        if (!post) return;
        const isOtherUser = post.author_id !== Store.ME && !post.is_announcement;

        UI.modal(`
          <h2>Delete post?</h2>
          <p class="muted">"${esc(post.caption.length > 100 ? post.caption.slice(0, 100) + "…" : post.caption)}"</p>
          ${isOtherUser ? `
            <div class="field">
              <label for="f-del-reason">Reason for removal <span class="small muted">(optional, sent to author)</span></label>
              <input id="f-del-reason" type="text" placeholder="e.g. Violates community guidelines" maxlength="150">
            </div>
          ` : ""}
          <p class="small danger">This will permanently delete the post and cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn btn-danger solid" id="btn-confirm-delete">Delete post</button>
          </div>
        `, {
          onMount(m, close) {
            m.querySelector("#btn-confirm-delete").onclick = async () => {
              const reasonInput = m.querySelector("#f-del-reason");
              const reason = reasonInput ? reasonInput.value.trim() : "";
              const delBtn = m.querySelector("#btn-confirm-delete");
              delBtn.disabled = true;
              const r = await Store.admin.call("admin_delete_post", {
                p_id: post.id,
                p_reason: reason || null,
              });
              if (!r.ok) {
                delBtn.disabled = false;
                return UI.toast(r.message || "Failed to delete post.");
              }
              close();
              UI.toast("Post deleted.");
              if (ctx.isCurrent()) ctx.refresh();
            };
          },
        });
      };
    });
  },
});
