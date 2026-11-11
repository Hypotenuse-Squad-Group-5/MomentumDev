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
    post: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
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
    const p = Store.profile(id);
    const cls = "avatar " + size + " " + colorFor(id);
    const init = '<span class="avatar-initials" aria-hidden="true">' + initials(id) + '</span>';
    const inner = p && p.avatarUrl
      ? '<img class="avatar-img" src="' + esc(p.avatarUrl) + '" alt="' + esc(Store.fullName(id)) + '" onerror="this.style.display=\'none\';">' + init
      : init;
    return link ? '<a class="' + cls + '" href="profile.html?id=' + id + '" title="' + esc(Store.fullName(id)) + '">' + inner + '</a>'
      : '<span class="' + cls + '" aria-hidden="true">' + inner + '</span>';
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

  // The header + tabs from this device's last visit, so the next page can draw them instantly.
  // Stored per login; cleared on sign-out.
  const shellKey = () => { const id = Store.savedLogin(); return id && id !== "saved" ? "momentum.shell." + id : null; };
  function readShell() { try { const k = shellKey(); return k ? JSON.parse(localStorage.getItem(k)) : null; } catch (e) { return null; } }
  function saveShell(data) { try { const k = shellKey(); if (k) localStorage.setItem(k, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  const BRAND_ONLY = '<a href="home.html" class="brand" aria-label="Momentum home"><span class="brand-mark">M</span><span class="brand-name">Momentum</span></a>';
  const LOADER = '<div class="page-loader" role="status" aria-label="Loading"><span class="brand-mark loader-mark">M</span></div>';

  let currentPageKey = null, shellReady = false;
  function buildShell(pageKey) {
    currentPageKey = pageKey;
    const main = document.getElementById("main");
    const header = document.createElement("header"); header.className = "app-header"; header.id = "app-header";
    const shell = document.createElement("div"); shell.className = "shell";
    const side = document.createElement("nav"); side.className = "sidebar panel"; side.id = "app-sidebar"; side.setAttribute("aria-label", "Main");
    const tabs = document.createElement("nav"); tabs.className = "tabbar"; tabs.id = "app-tabbar"; tabs.setAttribute("aria-label", "Main");
    main.parentNode.insertBefore(header, main);
    main.parentNode.insertBefore(shell, main);
    shell.appendChild(side); shell.appendChild(main);
    document.body.appendChild(tabs);
    const panel = document.createElement("aside"); panel.className = "msg-panel"; panel.id = "msg-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Messages");
    document.body.appendChild(panel);
    // Data isn't loaded yet: draw the last saved header (or just the logo) and the tabs.
    const last = readShell();
    header.innerHTML = last && last.header ? last.header : BRAND_ONLY;
    renderNav(pageKey, last ? last.requests : 0);
  }
  function renderNav(pageKey, savedRequests) {
    if (!pageKey) return;
    const reqCount = shellReady ? Store.incomingRequests().length : savedRequests || 0;
    const socialBadge = reqCount > 0 ? ' <span class="badge" aria-label="' + reqCount + ' pending friend requests">' + reqCount + "</span>" : "";
    const side = document.getElementById("app-sidebar");
    if (side) {
      side.innerHTML = NAV.map((n) => '<a class="nav-item' + (n.key === pageKey ? " active" : "") + '" href="' + n.href + '"' + (n.key === pageKey ? ' aria-current="page"' : "") + ">" + icon(n.icon) + n.label + (n.key === "social" ? socialBadge : "") + "</a>").join("") +
        '<a class="nav-item' + (pageKey === "profile" ? " active" : "") + '" href="profile.html">' + icon("user") + "My profile</a><hr>" +
        '<a class="nav-item' + (pageKey === "settings" ? " active" : "") + '" href="settings.html">' + icon("settings") + "Settings</a>";
    }
    const tabs = document.getElementById("app-tabbar");
    if (tabs) {
      tabs.innerHTML = NAV.map((n) => '<a href="' + n.href + '"' + (n.key === pageKey ? ' class="active" aria-current="page"' : "") + ">" + icon(n.icon) + n.label + (n.key === "social" ? socialBadge : "") + "</a>").join("");
    }
  }
  function renderHeader() {
    renderNav(currentPageKey);
    const h = document.getElementById("app-header"); if (!h) return;
    h.innerHTML = headerHtml();
    saveShell({ header: h.innerHTML, requests: Store.incomingRequests().length });
    const btn = document.getElementById("msg-toggle");
    btn.classList.toggle("on", Messages.isOpen()); btn.setAttribute("aria-expanded", Messages.isOpen());
    btn.onclick = () => Messages.toggle();
  }

  // ---------- Messages panel ----------
  const Messages = (function () {
    let open = false, view = "list", tab = "conversations", convoId = null, draftOtherId = null, draftActivityId = null;
    let query = "", peopleQuery = "";
    let searchResults = null, searchError = "", searching = false, searchSeq = 0, searchTimer = null;
    let refreshing = false, sending = false, responding = false;
    const panel = () => document.getElementById("msg-panel");

    function show(v, id) {
      open = true;
      const nextView = v || "list";
      if (nextView === "new" && view !== "new") {
        peopleQuery = ""; searchResults = null; searchError = ""; searching = false;
      }
      view = nextView;
      convoId = id || null;
      if (view !== "thread") { draftOtherId = null; draftActivityId = null; }
      render();
      renderHeader();
    }
    function hide() { open = false; render(); renderHeader(); }
    function toggle() {
      if (open) hide();
      else { show("list"); refresh(true); }
    }
    async function refresh(silent = false) {
      if (refreshing) return;
      refreshing = true;
      if (!silent) render();
      try {
        await Promise.all([
          Store.loadConversations ? Store.loadConversations() : Promise.resolve(),
          Store.loadFriendships ? Store.loadFriendships(true) : Promise.resolve(),
          Store.loadBlocks ? Store.loadBlocks() : Promise.resolve(),
        ]);
        if (view === "thread" && !convoId && draftOtherId) {
          const found = Store.findDirect(draftOtherId);
          if (found) { convoId = found.id; draftOtherId = null; }
        }
      } finally {
        refreshing = false;
        render();
        renderHeader();
      }
    }
    function openChat(otherId, activityId) {
      if (!otherId || otherId === Store.ME) return;
      const existing = Store.findDirect(otherId);
      if (existing) {
        draftOtherId = null;
        draftActivityId = null;
        show("thread", existing.id);
      } else {
        draftOtherId = otherId;
        draftActivityId = activityId || null;
        show("thread", null);
      }
      refresh(true);
    }
    function title(c) { return displayName(Store.otherMember(c)); }
    function fmtRetryWait(iso) {
      const ms = Math.max(0, new Date(iso).getTime() - Date.now());
      const days = Math.ceil(ms / 864e5);
      if (days <= 1) return "in less than a day";
      return "in " + days + " days";
    }

    function render() {
      const p = panel(); if (!p) return;
      p.hidden = !open; if (!open) { p.innerHTML = ""; return; }
      if (view === "thread") return renderThread(p);
      if (view === "new") return renderNew(p);
      renderList(p);
    }

    function renderList(p) {
      const all = Store.conversations();
      const reqsAll = all.filter(Store.isRequestToMe);
      const convosAll = all.filter((c) => !Store.isRequestToMe(c));
      const unreadConvos = convosAll.filter(Store.unread).length;
      const reqsCount = reqsAll.length;

      const listForTab = () => {
        const base = tab === "requests" ? reqsAll : convosAll;
        const ql = query.trim().toLowerCase();
        if (!ql) return base;
        return base.filter((c) => title(c).toLowerCase().includes(ql) || c.messages.some((m) => m.body.toLowerCase().includes(ql)));
      };

      const item = (c) => {
        const l = c.messages[c.messages.length - 1];
        const other = Store.otherMember(c);
        const pendingTag = Store.isOutgoingPending && Store.isOutgoingPending(c) ? '<span class="tag grey">Pending</span>' : "";
        const preview = l ? (l.senderId === Store.ME ? "You: " : "") + l.body : "No messages yet";
        const isUnread = Store.unread(c);
        return '<button class="convo-item' + (isUnread ? " unread" : "") + '" data-open="' + c.id + '">' + avatar(other, "sm") +
          '<span class="grow"><span class="name">' + esc(title(c)) + pendingTag + "</span>" +
          '<span class="preview" style="display:block">' + esc(preview) + "</span></span>" +
          (l ? '<span class="tiny muted">' + fmtAgo(l.at) + "</span>" : "") + "</button>";
      };

      const renderItems = (box) => {
        const items = listForTab();
        if (items.length) { box.innerHTML = items.map(item).join(""); }
        else if (query.trim()) { box.innerHTML = '<p class="muted small">No ' + (tab === "requests" ? "message requests" : "conversations") + " match.</p>"; }
        else if (tab === "requests") {
          box.innerHTML = '<div class="center mt"><p><b>No message requests.</b></p><p class="muted small">When someone who isn\'t your friend messages you, it will show up here for you to accept or decline.</p></div>';
        } else {
          box.innerHTML = '<div class="center mt"><p><b>No conversations yet.</b></p><p class="muted small">Message a friend directly, or search for someone to send a message request.</p><button class="btn btn-sm btn-primary mt" data-new-empty>' + icon("plus", "sm") + "New chat</button></div>";
          const nb = box.querySelector("[data-new-empty]");
          if (nb) nb.onclick = () => show("new");
        }
        box.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => show("thread", b.dataset.open)));
      };

      const existingBox = p.querySelector("#msg-list-items");
      const existingQ = p.querySelector("[data-q]");
      if (existingBox && existingQ && document.activeElement === existingQ) {
        const tabsEl = p.querySelector(".msg-tabs");
        if (tabsEl) {
          tabsEl.innerHTML =
            '<button type="button" role="tab" aria-selected="' + (tab === "conversations") + '" class="' + (tab === "conversations" ? "active" : "") + '" data-tab="conversations">Conversations' + (unreadConvos ? '<span class="badge">' + unreadConvos + "</span>" : "") + "</button>" +
            '<button type="button" role="tab" aria-selected="' + (tab === "requests") + '" class="' + (tab === "requests" ? "active" : "") + '" data-tab="requests">Message requests' + (reqsCount ? '<span class="badge">' + reqsCount + "</span>" : "") + "</button>";
          tabsEl.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
        }
        const refBtn = p.querySelector("[data-refresh]");
        if (refBtn) {
          refBtn.classList.toggle("spinning", refreshing);
          refBtn.disabled = refreshing;
        }
        renderItems(existingBox);
        return;
      }

      p.innerHTML = '<div class="msg-head"><h2 class="grow mb0">Messages</h2>' +
        '<button class="icon-btn' + (refreshing ? " spinning" : "") + '" data-refresh aria-label="Refresh messages" title="Refresh messages"' + (refreshing ? " disabled" : "") + ">" + icon("refresh", "sm") + "</button>" +
        '<button class="btn btn-sm" data-new>' + icon("plus", "sm") + "New chat</button>" +
        '<button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body">' +
        '<div class="msg-tabs" role="tablist" aria-label="Message sections">' +
        '<button type="button" role="tab" aria-selected="' + (tab === "conversations") + '" class="' + (tab === "conversations" ? "active" : "") + '" data-tab="conversations">Conversations' + (unreadConvos ? '<span class="badge">' + unreadConvos + "</span>" : "") + "</button>" +
        '<button type="button" role="tab" aria-selected="' + (tab === "requests") + '" class="' + (tab === "requests" ? "active" : "") + '" data-tab="requests">Message requests' + (reqsCount ? '<span class="badge">' + reqsCount + "</span>" : "") + "</button>" +
        "</div>" +
        '<input type="search" placeholder="' + (tab === "requests" ? "Search message requests" : "Search conversations") + '" value="' + esc(query) + '" data-q aria-label="Search messages">' +
        '<div class="mt" id="msg-list-items"></div></div>';

      const listBox = p.querySelector("#msg-list-items");
      renderItems(listBox);
      p.querySelector("[data-hide]").onclick = hide;
      p.querySelector("[data-refresh]").onclick = () => refresh(false);
      p.querySelector("[data-new]").onclick = () => show("new");
      p.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
      const q = p.querySelector("[data-q]");
      q.oninput = () => { query = q.value; renderItems(listBox); };
    }

    function confirmBlock(otherId) {
      if (!otherId || otherId === Store.ME) return;
      const name = displayName(otherId);
      modal(
        "<h2>Block " + esc(name) + "?</h2>" +
        "<p>They won't be notified, and neither of you will be able to message each other. This conversation will be hidden from your Messages list.</p>" +
        '<p class="hint">You can unblock them anytime in Settings or on their profile.</p>' +
        '<div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-danger" id="do-block">Block</button></div>',
        {
          onMount(m, close) {
            const btn = m.querySelector("#do-block");
            btn.onclick = async () => {
              btn.disabled = true;
              const wasFriend = Store.isFriend(otherId);
              const res = await Store.blockUser(otherId);
              close();
              if (!res.ok) {
                toast(res.message || "Could not block this user");
                return;
              }
              if (open && view === "thread") {
                show("list");
              }
              if (wasFriend) {
                const full = Store.fullName(otherId);
                modal(
                  "<h2>" + esc(full) + " is blocked</h2>" +
                  "<p>They can no longer message you. Since you're currently friends, would you also like to unfriend " + esc(full) + "?</p>" +
                  '<div class="modal-actions"><button type="button" class="btn" data-close>Keep as friend</button><button type="button" class="btn btn-danger" id="do-block-unfriend">Unfriend</button></div>',
                  {
                    onMount(m2, close2) {
                      const uf = m2.querySelector("#do-block-unfriend");
                      uf.onclick = async () => {
                        uf.disabled = true;
                        const r2 = await Store.removeFriend(otherId);
                        close2();
                        if (r2.ok) toast("Blocked and removed from friends");
                        else toast(r2.message || "Blocked, but could not unfriend");
                      };
                    },
                  }
                );
              } else {
                toast(name + " blocked");
              }
            };
          },
        }
      );
    }

    function renderThread(p) {
      const c = convoId ? Store.conversation(convoId) : null;
      if (convoId && !c) return show("list");
      const other = c ? Store.otherMember(c) : draftOtherId;
      if (!other) return show("list");
      if (c && Store.unread(c)) {
        Store.markRead(c.id, { silent: true });
        renderHeader();
      }
      const actId = (c && c.activityId) || draftActivityId;
      const a = actId ? Store.activity(actId) : null;
      const st = Store.requestStatusFor(other);
      const msgs = c ? c.messages : [];
      const name = displayName(other);

      let noticeHtml = "";
      let footerHtml = "";

      if (st.kind === "blocked_by_me") {
        footerHtml = '<div class="msg-locked msg-blocked-bar"><span>You blocked ' + esc(name) + '.</span><button type="button" class="btn btn-sm" data-unblock>Unblock</button></div>';
      } else if (st.kind === "blocked_by_other") {
        footerHtml = '<div class="msg-locked">Messaging this person is currently unavailable.</div>';
      } else if (st.kind === "incoming_request") {
        noticeHtml = '<div class="alert info mb0">' + icon("lock", "sm") + "<span><b>" + esc(name) + "</b> isn't your friend yet. Accept to reply and move this chat to Conversations.</span></div>";
        footerHtml = '<div class="msg-request-actions"><button class="btn btn-primary grow" data-accept' + (responding ? " disabled" : "") + '>Accept</button><button class="btn grow" data-decline' + (responding ? " disabled" : "") + '>Decline</button><button class="btn btn-danger" data-block' + (responding ? " disabled" : "") + ">Block</button></div>";
      } else if (st.kind === "declined_by_me") {
        noticeHtml = '<div class="alert info mb0">' + icon("lock", "sm") + "<span>You previously declined this message request from <b>" + esc(name) + "</b>.</span></div>";
        footerHtml = '<div class="msg-request-actions"><button class="btn btn-primary btn-block" data-accept' + (responding ? " disabled" : "") + ">Accept &amp; move to Conversations</button></div>";
      } else if (st.kind === "request_waiting") {
        footerHtml = '<div class="msg-locked">Message request sent to ' + esc(name) + ". You can send 1 follow-up on " + esc(fmtDay(st.retryAt)) + " (" + esc(fmtRetryWait(st.retryAt)) + ") if they haven't responded.</div>";
      } else if (st.kind === "request_limit_reached") {
        footerHtml = '<div class="msg-locked">Follow-up sent. You can send more messages once ' + esc(name) + " accepts your request.</div>";
      } else if (st.kind === "declined_by_other") {
        footerHtml = '<div class="msg-locked">Follow-up messages aren\'t available for this request.</div>';
      } else {
        if (st.kind === "request_initial") {
          noticeHtml = '<div class="alert info">' + icon("lock", "sm") + "<span><b>" + esc(name) + "</b> isn't your friend yet, so this will appear as a message request. You can send 1 message now (and 1 follow-up after 7 days if they haven't responded).</span></div>";
        } else if (st.kind === "request_followup_ready") {
          noticeHtml = '<div class="alert info">' + icon("clock", "sm") + "<span><b>" + esc(name) + "</b> hasn't responded yet. You can send 1 follow-up message.</span></div>";
        }
        footerHtml = '<form class="composer"><input type="text" placeholder="Write a message" aria-label="Message" maxlength="2000"' + (sending ? " disabled" : "") + '><button class="btn btn-primary" aria-label="Send"' + (sending ? " disabled" : "") + ">" + icon("send", "sm") + "</button></form>";
      }

      const existingComposer = p.querySelector(".composer input");
      const sameThreadComposer = existingComposer && existingComposer.dataset.for === other;
      const prevDraft = sameThreadComposer ? existingComposer.value : "";
      const hadComposerFocus = sameThreadComposer && document.activeElement === existingComposer;
      const prevSel = hadComposerFocus ? existingComposer.selectionStart : null;
      const shouldFocusComposer = !sameThreadComposer || hadComposerFocus;

      const emptyMsg = st.kind === "blocked_by_me"
        ? '<p class="muted small center">You\'ve blocked ' + esc(name) + " from messaging you.</p>"
        : st.kind === "blocked_by_other"
          ? '<p class="muted small center">No messages yet.</p>'
          : '<p class="muted small center">Say hi to ' + esc(name) + "." + (a ? " This chat is linked to " + esc(a.title) + "." : "") + "</p>";

      const bubblesHtml = msgs.length
        ? '<div class="thread">' + msgs.map((m) => '<div class="bubble' + (m.senderId === Store.ME ? " me" : "") + '">' + esc(m.body) + "</div>").join("") + "</div>"
        : emptyMsg;

      const showHeaderBlock = !Store.hasBlocked || !Store.hasBlocked(other);

      p.innerHTML = '<div class="msg-head"><button class="icon-btn" data-back aria-label="Back">' + icon("left") + "</button>" +
        avatar(other, "sm", true) +
        '<div class="grow"><a href="profile.html?id=' + esc(other) + '" style="text-decoration:none"><b>' + esc(name) + "</b></a>" +
        (a ? '<div><a class="context-pill" href="activity.html?id=' + esc(a.id) + '">' + icon("activity", "sm") + "About: " + esc(a.title) + "</a></div>" : "") + "</div>" +
        (showHeaderBlock ? '<button class="icon-btn" data-block aria-label="Block ' + esc(name) + '" title="Block ' + esc(name) + '">' + icon("ban", "sm") + "</button>" : "") +
        '<button class="icon-btn' + (refreshing ? " spinning" : "") + '" data-refresh aria-label="Refresh messages" title="Refresh messages"' + (refreshing ? " disabled" : "") + ">" + icon("refresh", "sm") + "</button>" +
        '<button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body">' +
        (st.kind === "incoming_request" || st.kind === "declined_by_me"
          ? noticeHtml + '<div class="mt">' + bubblesHtml + "</div>"
          : (noticeHtml ? noticeHtml + '<div class="mt">' + bubblesHtml + "</div>" : bubblesHtml)) +
        "</div>" + footerHtml;

      p.querySelector("[data-back]").onclick = () => show("list");
      p.querySelector("[data-hide]").onclick = hide;
      p.querySelector("[data-refresh]").onclick = () => refresh(false);
      p.querySelectorAll("[data-block]").forEach((b) => (b.onclick = () => confirmBlock(other)));
      const unb = p.querySelector("[data-unblock]");
      if (unb) unb.onclick = () => confirmUnblock(other);

      const acc = p.querySelector("[data-accept]");
      if (acc) {
        acc.onclick = async () => {
          if (responding) return;
          responding = true; render();
          const res = await Store.respondRequest(c.id, true);
          responding = false;
          if (!res.ok) { toast(res.message || "Could not accept request"); render(); return; }
          tab = "conversations";
          toast("Message request accepted");
          render();
          renderHeader();
        };
      }
      const dec = p.querySelector("[data-decline]");
      if (dec) {
        dec.onclick = async () => {
          if (responding) return;
          responding = true; render();
          const res = await Store.respondRequest(c.id, false);
          responding = false;
          if (!res.ok) { toast(res.message || "Could not decline request"); render(); return; }
          toast("Message request declined");
          show("list");
        };
      }

      const f = p.querySelector(".composer");
      if (f) {
        const inp = f.querySelector("input");
        inp.dataset.for = other;
        if (prevDraft) inp.value = prevDraft;
        f.onsubmit = async (e) => {
          e.preventDefault();
          const text = inp.value;
          if (!text.trim() || sending) return;
          sending = true;
          const btn = f.querySelector("button");
          inp.disabled = true; btn.disabled = true;
          const res = await Store.sendDirectMessage({ recipientId: other, body: text, activityId: actId });
          sending = false;
          if (!res.ok) {
            toast(res.message || "Could not send message");
            const latestSt = Store.requestStatusFor(other);
            if (!latestSt.canSend) {
              render();
            } else {
              inp.disabled = false; btn.disabled = false;
              inp.focus();
            }
            return;
          }
          inp.value = "";
          const liveInp = panel() && panel().querySelector(".composer input");
          if (liveInp) liveInp.value = "";
          convoId = res.conversationId;
          draftOtherId = null;
          draftActivityId = null;
          tab = "conversations";
          render();
          renderHeader();
          const nextInp = panel().querySelector(".composer input");
          if (nextInp) nextInp.focus();
        };
        if (shouldFocusComposer) {
          inp.focus();
          if (prevSel != null && typeof inp.setSelectionRange === "function") {
            try { inp.setSelectionRange(prevSel, prevSel); } catch (e) { /* ignore */ }
          }
        }
      }
      const bodyEl = p.querySelector(".msg-body");
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function renderNew(p) {
      const renderResults = (box) => {
        const q = peopleQuery.trim();
        const row = (id) => {
          const isF = Store.isFriend(id);
          const blockedByMe = Store.hasBlocked && Store.hasBlocked(id);
          const existing = Store.findDirect(id);
          const isActive = existing && Store.memberStatus(existing, Store.ME) === "active" && Store.memberStatus(existing, id) === "active";
          const sub = blockedByMe ? "Blocked" : isF ? "Friend" : isActive ? "Active conversation" : "Not a friend · sends a message request";
          return '<button class="convo-item" data-person="' + id + '">' + avatar(id, "sm") +
            '<span class="grow"><span class="name">' + esc(isF ? Store.fullName(id) : Store.profile(id).first) + "</span>" +
            '<span class="preview" style="display:block">' + esc(sub) + "</span></span></button>";
        };
        if (!q) {
          const friendIds = Store.friends().map((f) => f.id).sort((a, b) => Store.fullName(a).localeCompare(Store.fullName(b)));
          box.innerHTML = '<p class="label mt">Your friends</p>' +
            (friendIds.length
              ? friendIds.map(row).join("")
              : '<p class="muted small">No friends yet. Search by name above to send someone a message request.</p>');
        } else if (searching) {
          box.innerHTML = '<p class="label mt">Search results</p><p class="muted small">Searching…</p>';
        } else if (searchError) {
          box.innerHTML = '<p class="label mt">Search results</p><p class="err">' + esc(searchError) + "</p>";
        } else {
          const ids = searchResults || [];
          box.innerHTML = '<p class="label mt">Search results</p>' +
            (ids.length ? ids.map(row).join("") : '<p class="muted small">No one found with that name.</p>');
        }
        box.querySelectorAll("[data-person]").forEach((b) => (b.onclick = () => openChat(b.dataset.person)));
      };

      const runSearch = async (qVal) => {
        const trimmed = qVal.trim();
        if (!trimmed) {
          searching = false; searchError = ""; searchResults = null;
          const b = panel()?.querySelector("#msg-new-results");
          if (b) renderResults(b);
          return;
        }
        const mySeq = ++searchSeq;
        searching = true; searchError = "";
        const b1 = panel()?.querySelector("#msg-new-results");
        if (b1) renderResults(b1);
        const res = await Store.searchProfiles(trimmed);
        if (mySeq !== searchSeq) return;
        searching = false;
        if (res.ok) { searchResults = res.ids; searchError = ""; }
        else { searchResults = []; searchError = res.message || "Could not search people."; }
        const b2 = panel()?.querySelector("#msg-new-results");
        if (b2) renderResults(b2);
      };

      const existingBox = p.querySelector("#msg-new-results");
      const existingInp = p.querySelector("[data-pq]");
      if (existingBox && existingInp && document.activeElement === existingInp) {
        renderResults(existingBox);
        return;
      }

      p.innerHTML = '<div class="msg-head"><button class="icon-btn" data-back aria-label="Back">' + icon("left") + '</button><h2 class="grow mb0">New chat</h2><button class="icon-btn" data-hide aria-label="Close messages">' + icon("x") + "</button></div>" +
        '<div class="msg-body"><input type="search" placeholder="Search people by name" value="' + esc(peopleQuery) + '" data-pq aria-label="Search people"><div id="msg-new-results"></div></div>';
      p.querySelector("[data-back]").onclick = () => show("list");
      p.querySelector("[data-hide]").onclick = hide;
      const box = p.querySelector("#msg-new-results");
      renderResults(box);
      const qInp = p.querySelector("[data-pq]");
      qInp.oninput = () => {
        peopleQuery = qInp.value;
        if (searchTimer) clearTimeout(searchTimer);
        if (!peopleQuery.trim()) { runSearch(""); return; }
        searching = true;
        renderResults(box);
        searchTimer = setTimeout(() => runSearch(peopleQuery), 200);
      };
      qInp.focus();
    }

    return { toggle, show, hide, openChat, refresh, render, isOpen: () => open };
  })();

  // ---------- Page mounting ----------
  // mount("home", render, { live: true }) builds the shell, loads activities,
  // then renders. With live:true the page re-renders whenever data changes
  // (here or in another tab), so streaks/points/habits stay in sync everywhere.
  async function mount(pageKey, render, opts = {}) {
    const main = document.getElementById("main");
    // No login saved on this device: go straight to sign-in without drawing the app.
    if (Store.savedLogin() === "") { location.replace("login.html"); return; }
    // Draw the frame right away; the loader only appears if loading takes more than a moment (CSS).
    if (opts.shell !== false) buildShell(pageKey);
    main.innerHTML = LOADER;
    // Auth guard: the saved login must still be valid. Nothing below runs for signed-out visitors.
    const signedIn = await Store.init();
    if (signedIn === false) { location.replace("login.html"); return; }
    if (signedIn === "syncerror") {
      main.innerHTML = '<div class="panel" style="max-width:480px;margin:40px auto"><h2>Could not load your saved progress</h2><p class="muted">' + esc(Store.loadError) + '</p><button class="btn btn-primary" id="sync-retry">Try again</button></div>';
      document.getElementById("sync-retry").onclick = () => location.reload();
      return;
    }
    if (signedIn === "noprofile") {
      main.innerHTML = '<div class="panel" style="max-width:480px;margin:40px auto"><h2>We couldn\'t load your profile</h2><p class="muted">' + esc(Store.loadError || "") + '</p><button class="btn btn-primary" id="np-out">Sign out</button></div>';
      document.getElementById("np-out").onclick = async () => { await Store.auth.signOut(); location.replace("index.html"); };
      return;
    }
    shellReady = true;
    if (opts.shell !== false) renderHeader(); // swap in today's streak, messages and photo
    await Promise.all([Store.loadActivities(), Store.loadPosts(), Store.loadTypes()]);
    render();
    showFlash();
    if (Store.loadError && pageKey !== "activities") toast("Couldn't reach Supabase. Check js/config.js.");
    Store.subscribe(() => { renderHeader(); Messages.render(); if (opts.live !== false) render(); });
  }

  function confirmUnblock(otherId, { onUnblocked } = {}) {
    if (!otherId || otherId === Store.ME) return;
    const name = displayName(otherId);
    modal(
      "<h2>Unblock " + esc(name) + "?</h2>" +
      "<p>You and " + esc(name) + " will be able to message each other again.</p>" +
      '<div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" id="do-unblock">Unblock</button></div>',
      {
        onMount(m, close) {
          const btn = m.querySelector("#do-unblock");
          btn.onclick = async () => {
            btn.disabled = true;
            const res = await Store.unblockUser(otherId);
            close();
            if (!res.ok) {
              toast(res.message || "Could not unblock this user");
              return;
            }
            toast(name + " unblocked");
            if (onUnblocked) onUnblocked();
          };
        },
      }
    );
  }

  window.UI = {
    icon, esc, fmtDay, fmtTime, fmtRange, fmtAgo, dateBadge, VIS, visSelect, distanceMi, fmtMi, qs, words,
    avatar, displayName, nameLink, initials, toast, flash, modal, alertModal, confirmUnblock, addToCalendarModal, calendarLinks,
    Messages, mount, renderHeader,
  };
})();
