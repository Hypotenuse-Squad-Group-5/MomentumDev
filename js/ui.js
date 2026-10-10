/* =====================================================================
   Momentum: shared UI
   - Builds the header, sidebar (desktop), bottom tab bar (phone), and the
     messages panel on every page. Edit navigation HERE, once.
   - Helpers for icons, dates, avatars, pop-ups, and point toasts.
   ===================================================================== */
(function () {
  // ---------- Icons (Lucide-style, inline SVG) ----------
  const ICONS = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    activity: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  };
  const icon = (name, cls = "") => '<svg class="i ' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";

  // ---------- Text + dates ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const D = (iso) => new Date(iso);
  const fmtDay = (iso) => D(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const fmtTime = (iso) => D(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fmtRange = (a) => fmtDay(a.startsAt) + " · " + fmtTime(a.startsAt) + " – " + fmtTime(a.endsAt);
  function fmtAgo(iso) {
    const s = (Date.now() - D(iso)) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 7 * 86400) return Math.floor(s / 86400) + "d ago"; return fmtDay(iso);
  }
  function dateBadge(iso, past) {
    const d = D(iso);
    return '<div class="date-badge' + (past ? " past" : "") + '"><small>' + d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() + "</small><b>" + d.getDate() + "</b><small>" + d.toLocaleDateString(undefined, { month: "short" }).toUpperCase() + "</small></div>";
  }
  const VIS = { public: "Public", friends_of_friends: "Friends of friends", friends: "Friends", private: "Private" };
  function visSelect(value, attrs = "") {
    return "<select " + attrs + ">" + Object.entries(VIS).map(([k, v]) => '<option value="' + k + '"' + (k === value ? " selected" : "") + ">" + v + "</option>").join("") + "</select>";
  }
  function distanceMi(a) {
    const me = Store.profile(Store.ME); if (a.lat == null || me.lat == null) return null;
    const R = 3958.8, toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(a.lat - me.lat), dLng = toR(a.lng - me.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(me.lat)) * Math.cos(toR(a.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtMi = (m) => (m == null ? "" : m < 0.1 ? "nearby" : m.toFixed(1) + " mi");
  const qs = (k) => new URLSearchParams(location.search).get(k);
  const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  // ---------- People ----------
  function initials(id) { const p = Store.profile(id); return ((p.first || "?")[0] + ((p.last || "")[0] || "")).toUpperCase(); }
  function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "c" + ((h % 4) + 1); }
  function avatar(id, size = "", link = false) {
    const cls = "avatar " + size + " " + colorFor(id);
    return link ? '<a class="' + cls + '" href="profile.html?id=' + id + '" title="' + esc(Store.fullName(id)) + '">' + initials(id) + "</a>"
      : '<span class="' + cls + '" aria-hidden="true">' + initials(id) + "</span>";
  }
  // Friends see your full name + profile. Non-friends see first name only (or nothing, if hidden).
  function displayName(id) {
    if (id === Store.ME) return "You";
    if (Store.isFriend(id)) return Store.fullName(id);
    return Store.profile(id).first;
  }
  const nameLink = (id) => (id !== Store.ME && Store.isFriend(id)) || id === Store.ME
    ? '<a href="profile.html?id=' + id + '">' + esc(id === Store.ME ? "You" : Store.fullName(id)) + "</a>"
    : esc(Store.profile(id).first);

  // ---------- Toasts ----------
  function toast(text, points) {
    let box = document.querySelector(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast";
    t.innerHTML = (points ? '<span class="pts">' + (points > 0 ? "+" : "") + points + "</span>" : "") + "<span>" + esc(text) + "</span>";
    box.appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  // A one-time toast carried across a redirect (e.g. "Activity posted")
  function flash(text, points) { sessionStorage.setItem("momentum.flash", JSON.stringify({ text, points })); }
  function showFlash() { const f = sessionStorage.getItem("momentum.flash"); if (f) { sessionStorage.removeItem("momentum.flash"); const { text, points } = JSON.parse(f); setTimeout(() => toast(text, points), 250); } }

  // ---------- Modals ----------
  function modal(html, { onMount, wide } = {}) {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true"' + (wide ? ' style="max-width:640px"' : "") + '><button class="icon-btn close" data-close aria-label="Close">' + icon("x") + "</button>" + html + "</div>";
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    const first = back.querySelector("input, select, textarea, button:not(.close)"); if (first) first.focus();
    if (onMount) onMount(back.querySelector(".modal"), close);
    return close;
  }
  function alertModal(title, body, { error, actions } = {}) {
    return modal("<h2" + (error ? ' style="color:var(--danger)"' : "") + ">" + esc(title) + "</h2><p>" + body + '</p><div class="modal-actions">' + (actions || '<button class="btn btn-primary" data-close>OK</button>') + "</div>");
  }

  // ---------- Add to calendar (Google link + .ics for Apple / Outlook) ----------
  function calendarLinks(a) {
    const z = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const addr = Store.address(a.id) || a.location;
    const g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(a.title) + "&dates=" + z(a.startsAt) + "/" + z(a.endsAt) + "&details=" + encodeURIComponent(a.description + "\n\nCommitted via Momentum.") + "&location=" + encodeURIComponent(addr);
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Momentum//EN", "BEGIN:VEVENT", "UID:" + a.id + "@momentum", "DTSTAMP:" + z(new Date().toISOString()),
      "DTSTART:" + z(a.startsAt), "DTEND:" + z(a.endsAt), "SUMMARY:" + a.title, "LOCATION:" + addr, "DESCRIPTION:" + a.description.replace(/\n/g, " "),
      "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Put the phone away. " + a.title + " starts in 30 minutes.", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return { google: g, ics: URL.createObjectURL(new Blob([ics], { type: "text/calendar" })) };
  }
  function addToCalendarModal(a, intro) {
    const l = calendarLinks(a);
    const file = a.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".ics";
    modal((intro || "") + "<h2>Add it to your calendar</h2><p class=\"muted\">" + esc(a.title) + "<br>" + esc(fmtRange(a)) + "</p>" +
      '<div class="stack"><a class="btn btn-block" href="' + l.google + '" target="_blank" rel="noopener">' + icon("calendar") + "Google Calendar</a>" +
      '<a class="btn btn-block" href="' + l.ics + '" download="' + file + '">' + icon("download") + "Apple Calendar (.ics)</a>" +
      '<a class="btn btn-block" href="' + l.ics + '" download="' + file + '">' + icon("download") + "Outlook (.ics)</a></div>" +
      '<p class="hint mt">The calendar file includes a reminder 30 minutes before the start.</p><div class="modal-actions"><button class="btn btn-ghost" data-close>Not now</button></div>');
  }

  // ---------- Layout ----------
  const NAV = [
    { key: "home", href: "home.html", label: "Home", icon: "home" },
    { key: "activities", href: "activities.html", label: "Activities", icon: "activity" },
    { key: "calendar", href: "calendar.html", label: "Calendar", icon: "calendar" },
    { key: "lessons", href: "lessons.html", label: "Lessons", icon: "book" },
    { key: "social", href: "social.html", label: "Social", icon: "users" },
  ];

  function headerHtml() {
    const s = Store.stats(); const u = Store.unreadCount();
    return '<a href="home.html" class="brand" aria-label="Momentum home"><span class="brand-mark">M</span><span class="brand-name">Momentum</span></a>' +
      '<a href="streak.html" class="streak-chip" title="Your streak and points">' + icon("flame", "sm") + s.streak + "</a>" +
      '<button class="icon-btn" id="msg-toggle" aria-label="Messages" aria-expanded="false">' + icon("message") + (u ? '<span class="badge">' + u + "</span>" : "") + "</button>" +
      '<a href="settings.html" class="icon-btn" aria-label="Settings">' + icon("settings") + "</a>" +
      '<a href="profile.html" class="avatar-btn" aria-label="My profile">' + avatar(Store.ME, "sm") + "</a>";
  }

  function buildShell(pageKey) {
    const main = document.getElementById("main");
    const header = document.createElement("header"); header.className = "app-header"; header.id = "app-header";
    const shell = document.createElement("div"); shell.className = "shell";
    const side = document.createElement("nav"); side.className = "sidebar panel"; side.setAttribute("aria-label", "Main");
    side.innerHTML = NAV.map((n) => '<a class="nav-item' + (n.key === pageKey ? " active" : "") + '" href="' + n.href + '"' + (n.key === pageKey ? ' aria-current="page"' : "") + ">" + icon(n.icon) + n.label + "</a>").join("") +
      '<a class="nav-item' + (pageKey === "profile" ? " active" : "") + '" href="profile.html">' + icon("user") + "My profile</a><hr>" +
      '<a class="nav-item' + (pageKey === "settings" ? " active" : "") + '" href="settings.html">' + icon("settings") + "Settings</a>";
    const tabs = document.createElement("nav"); tabs.className = "tabbar"; tabs.setAttribute("aria-label", "Main");
    tabs.innerHTML = NAV.map((n) => '<a href="' + n.href + '"' + (n.key === pageKey ? ' class="active" aria-current="page"' : "") + ">" + icon(n.icon) + n.label + "</a>").join("");
    main.parentNode.insertBefore(header, main);
    main.parentNode.insertBefore(shell, main);
    shell.appendChild(side); shell.appendChild(main);
    document.body.appendChild(tabs);
    const panel = document.createElement("aside"); panel.className = "msg-panel"; panel.id = "msg-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Messages");
    document.body.appendChild(panel);
    renderHeader();
  }
  function renderHeader() {
    const h = document.getElementById("app-header"); if (!h) return;
    h.innerHTML = headerHtml();
    const btn = document.getElementById("msg-toggle");
    btn.classList.toggle("on", Messages.isOpen()); btn.setAttribute("aria-expanded", Messages.isOpen());
    btn.onclick = () => Messages.toggle();
  }

  // ---------- Messages panel ----------
  const Messages = (function () {
    let open = false, view = "list", convoId = null, query = "", peopleQuery = "";
    const panel = () => document.getElementById("msg-panel");
    function show(v, id) { open = true; view = v || "list"; convoId = id || null; render(); renderHeader(); }
    function hide() { open = false; render(); renderHeader(); }
    function toggle() { open ? hide() : show("list"); }
    function openChat(otherId, activityId) { const c = Store.openDirect(otherId, activityId); show("thread", c.id); }
    function title(c) {
      if (c.kind === "activity_group") { const a = Store.activity(c.activityId); return (a ? a.title : "Activity") + " group"; }
      return displayName(Store.otherMember(c));
    }
    function render() {
      const p = panel(); if (!p) return;
      p.hidden = !open; if (!open) { p.innerHTML = ""; return; }
      if (view === "thread") return renderThread(p);
      if (view === "new") return renderNew(p);
      const all = Store.conversations().filter((c) => !query || title(c).toLowerCase().includes(query.toLowerCase()) || c.messages.some((m) => m.body.toLowerCase().includes(query.toLowerCase())));
      const reqs = all.filter(Store.isRequestToMe), rest = all.filter((c) => !Store.isRequestToMe(c));
      const item = (c) => {
        const l = c.messages[c.messages.length - 1];
        const other = c.kind === "direct" ? Store.otherMember(c) : null;
        const preview = Store.isRequestToMe(c) ? "Message hidden until you accept" : l ? (l.senderId === Store.ME ? "You: " : c.kind === "activity_group" ? Store.profile(l.senderId).first + ": " : "") + l.body : "No messages yet";
        return '<button class="convo-item' + (Store.unread(c) ? " unread" : "") + '" data-open="' + c.id + '">' + (other ? avatar(other, "sm") : '<span class="avatar sm">' + icon("users", "sm") + "</span>") +
          '<span class="grow"><span class="name">' + esc(title(c)) + "</span>" + '<span class="preview" style="display:block">' + esc(preview) + "</span></span>" + (l ? '<span class="tiny muted">' + fmtAgo(l.at) + "</span>" : "") + "</button>";
      };
      p.innerHTML = '<div class="msg-head"><h2 class="grow mb0">Messages</h2><button class="btn btn-sm" data-new>' + icon("plus", "sm") + 'New chat</button><button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body"><input type="search" placeholder="Search conversations" value="' + esc(query) + '" data-q aria-label="Search conversations">' +
        (reqs.length ? '<p class="label mt">Message requests (' + reqs.length + ")</p>" + reqs.map(item).join("") : "") +
        '<p class="label mt">Conversations</p>' + (rest.length ? rest.map(item).join("") : '<p class="muted small">No conversations match.</p>') +
        '<p class="hint mt">Group chats exist only for activities (max 20). 1-on-1 chats archive after 6 months, groups after 3.</p></div>';
      p.querySelector("[data-hide]").onclick = hide;
      p.querySelector("[data-new]").onclick = () => show("new");
      const q = p.querySelector("[data-q]"); q.oninput = () => { query = q.value; render(); const n = panel().querySelector("[data-q]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      p.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => show("thread", b.dataset.open)));
    }
    function renderThread(p) {
      const c = Store.conversation(convoId); if (!c) return show("list");
      Store.markRead(c.id);
      const a = c.activityId ? Store.activity(c.activityId) : null;
      const isReq = Store.isRequestToMe(c);
      const other = c.kind === "direct" ? Store.otherMember(c) : null;
      const waiting = other && Store.memberStatus(c, other) === "requested";
      p.innerHTML = '<div class="msg-head"><button class="icon-btn" data-back aria-label="Back">' + icon("left") + "</button>" + (other ? avatar(other, "sm", Store.isFriend(other)) : "") +
        '<div class="grow"><b>' + esc(title(c)) + "</b>" + (a ? '<div><a class="context-pill" href="activity.html?id=' + a.id + '">' + icon("activity", "sm") + "About: " + esc(a.title) + "</a></div>" : "") + "</div>" +
        '<button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body">' + (isReq
          ? '<div class="alert info">' + icon("lock", "sm") + "<span><b>" + esc(displayName(other)) + "</b> isn't your friend yet, so their message stays hidden until you accept.</span></div>" +
            '<div class="row mt"><button class="btn btn-primary" data-accept>Accept</button><button class="btn" data-decline>Decline</button></div>'
          : '<div class="thread">' + (c.messages.length ? c.messages.map((m) => '<div class="bubble' + (m.senderId === Store.ME ? " me" : "") + '">' + (c.kind === "activity_group" && m.senderId !== Store.ME ? '<span class="who">' + esc(Store.profile(m.senderId).first) + "</span>" : "") + esc(m.body) + "</div>").join("") : '<p class="muted small center">Say hi. ' + (a ? "This chat is linked to " + esc(a.title) + "." : "") + "</p>") + "</div>" +
            (waiting ? '<p class="hint mt center">' + esc(displayName(other)) + " isn't your friend, so this is a message request. They'll see it once they accept.</p>" : "")) +
        "</div>" + (isReq ? "" : '<form class="composer"><input type="text" placeholder="Write a message" aria-label="Message" maxlength="2000"><button class="btn btn-primary" aria-label="Send">' + icon("send", "sm") + "</button></form>");
      p.querySelector("[data-back]").onclick = () => show("list");
      p.querySelector("[data-hide]").onclick = hide;
      const acc = p.querySelector("[data-accept]"); if (acc) { acc.onclick = () => { Store.respondRequest(c.id, true); render(); }; p.querySelector("[data-decline]").onclick = () => { Store.respondRequest(c.id, false); show("list"); }; }
      const f = p.querySelector(".composer");
      if (f) { const inp = f.querySelector("input"); f.onsubmit = (e) => { e.preventDefault(); if (!inp.value.trim()) return; Store.send(c.id, inp.value); render(); panel().querySelector(".composer input").focus(); }; inp.focus(); }
      const body = p.querySelector(".msg-body"); body.scrollTop = body.scrollHeight;
    }
    function renderNew(p) {
      const shared = Store.shareActivityPeople();
      const everyone = Object.keys(Store.state.profiles).filter((id) => id !== Store.ME);
      const match = (id) => !peopleQuery || Store.fullName(id).toLowerCase().includes(peopleQuery.toLowerCase());
      const row = (id) => '<button class="convo-item" data-person="' + id + '">' + avatar(id, "sm") + '<span class="grow"><span class="name">' + esc(Store.isFriend(id) ? Store.fullName(id) : Store.profile(id).first) + '</span><span class="preview" style="display:block">' + (Store.isFriend(id) ? "Friend" : "Not a friend: sends a message request") + "</span></span></button>";
      const list = peopleQuery ? everyone.filter(match) : shared;
      p.innerHTML = '<div class="msg-head"><button class="icon-btn" data-back aria-label="Back">' + icon("left") + '</button><h2 class="grow mb0">New chat</h2><button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body"><input type="search" placeholder="Search people by name" value="' + esc(peopleQuery) + '" data-pq aria-label="Search people">' +
        '<p class="label mt">' + (peopleQuery ? "Search results" : "People you've shared activities with") + "</p>" + (list.length ? list.map(row).join("") : '<p class="muted small">No one found.</p>') + "</div>";
      p.querySelector("[data-back]").onclick = () => show("list");
      p.querySelector("[data-hide]").onclick = hide;
      const q = p.querySelector("[data-pq]"); q.oninput = () => { peopleQuery = q.value; render(); const n = panel().querySelector("[data-pq]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      p.querySelectorAll("[data-person]").forEach((b) => (b.onclick = () => openChat(b.dataset.person)));
    }
    return { toggle, show, hide, openChat, render, isOpen: () => open };
  })();

  // ---------- Page mounting ----------
  // mount("home", render, { live: true }) builds the shell, loads activities,
  // then renders. With live:true the page re-renders whenever data changes
  // (here or in another tab), so streaks/points/habits stay in sync everywhere.
  async function mount(pageKey, render, opts = {}) {
    if (opts.shell !== false) buildShell(pageKey);
    const main = document.getElementById("main");
    main.innerHTML = '<p class="muted">Loading…</p>';
    await Store.loadActivities();
    render();
    showFlash();
    if (Store.loadError && pageKey !== "activities") toast("Couldn't reach Supabase. Check js/config.js.");
    Store.subscribe(() => { renderHeader(); Messages.render(); if (opts.live !== false) render(); });
  }

  window.UI = {
    icon, esc, fmtDay, fmtTime, fmtRange, fmtAgo, dateBadge, VIS, visSelect, distanceMi, fmtMi, qs, words,
    avatar, displayName, nameLink, initials, toast, flash, modal, alertModal, addToCalendarModal, calendarLinks,
    Messages, mount, renderHeader,
  };
})();
