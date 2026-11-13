/* =====================================================================
   Momentum: data layer ("Store")

   Every page reads and writes data ONLY through this file.
   Supabase is required: js/config.js must have the project URL and
   publishable key. There is no demo mode.

   Stored in Supabase: accounts, profiles, interests, habits + check-ins,
   lessons, activities, commitments (RSVPs) + +1s + attendance, friendships,
   messages, and posts.
   Activity reports, likes, and general settings stay browser-local.
   ===================================================================== */
(function () {
  let KEY = null; // this user's browser data: "momentum.v1.user.<profile id>" (set in init)
  const CANCELS_PER_MONTH = 2;  // also enforced by the database (migration 018)
  const CANCEL_HOURS = 3;       // no cancelling within 3 hours of the start (also in the database)
  const BUFFER_MIN = 30;

  let ME = null; // the signed-in user's profile id (set in init)

  // ---------- small helpers ----------
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
  const nowIso = () => new Date().toISOString();
  const dayKey = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const today = () => dayKey(new Date());
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };

  // =====================================================================
  // A brand-new account's browser data (everything else loads from Supabase)
  // =====================================================================
  function defaultSettings() {
    return {
      postVisibility: "friends", activityVisibility: "public", friendsListVisibility: "friends",
      attendeeDisplay: "first_name",
      notifyActivity: true, notifyHabits: true, notifyFriends: true, notifyMessages: true,
      remindersByEmail: false, checkinTime: "21:30", pauseBeforeOpen: false, weeklySummary: true,
    };
  }
  function blankState(me) {
    return {
      version: 1, meId: me.id, signedIn: true, profiles: { [me.id]: me },
      friendships: [], blocks: [], activities: [], addresses: {}, rsvps: [], guests: [], reports: [], posts: [],
      encouragements: [], conversations: [], lessonsDone: [], habits: [], checkins: [], momentum: [], cancellations: [],
      settings: defaultSettings(),
    };
  }

  // Restore only supported fields so old browser data cannot reintroduce retired features.
  function restoreState(saved, me) {
    const restored = blankState(me);
    if (saved && saved.version === 1) {
      // Commitments come from the database now (migration 018): never restore this browser's old copy.
      const FROM_DATABASE = ["rsvps", "guests", "cancellations"];
      Object.keys(restored).forEach((key) => { if (key in saved && !FROM_DATABASE.includes(key)) restored[key] = saved[key]; });
      restored.settings = { ...defaultSettings(), ...restored.settings };
    }
    return restored;
  }

  // =====================================================================
  // State, persistence, live updates
  // =====================================================================
  let state;
  function load() { // another tab changed this user's browser data
    try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && saved.version === 1) state = restoreState(saved, state.profiles[ME]); } catch (e) { /* keep what we have */ }
  }
  function persist() { if (!KEY) return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } }
  const listeners = new Set();
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  function save() { persist(); emit(); }
  // Another tab changed something: reload and re-render (keeps every open page in sync)
  window.addEventListener("storage", (e) => { if (KEY && e.key === KEY) { load(); emit(); } });

  // =====================================================================
  // Supabase connection (required)
  // =====================================================================
  const cfg = window.MOMENTUM_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  let actCache = null, postCache = null, typeCache = null, loadError = null;
  const remoteProfiles = {}; // public profile cards of other users, learned from the activities they host

  function cacheRemoteProfile(p) {
    if (!p || !p.id || p.id === ME) return;
    const prev = remoteProfiles[p.id] || {
      id: p.id, first: p.first_name || "Someone", last: "",
      bio: "", avatarUrl: null, memberSince: null,
      interests: [], attendeeDisplay: "first_name",
    };
    remoteProfiles[p.id] = {
      ...prev,
      first: p.first_name || prev.first,
      bio: p.bio !== undefined ? (p.bio || "") : prev.bio,
      avatarUrl: p.avatar_url !== undefined ? (p.avatar_url || null) : prev.avatarUrl,
      memberSince: p.created_at || prev.memberSince,
    };
  }

  function fromRow(row) {
    if (row.host && row.host_id !== ME) {
      cacheRemoteProfile({ id: row.host_id, ...row.host });
    }
    return {
      id: row.id, hostId: row.host_id, hostName: row.host ? row.host.first_name : null,
      type: row.type ? row.type.name : "", title: row.title, activityName: row.activity_name,
      description: row.description, bring: row.what_to_bring || "", startsAt: row.starts_at, endsAt: row.ends_at,
      location: row.general_location, city: row.city, lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null, min: row.min_participants, max: row.max_participants,
      taken: row.spots_taken != null ? Number(row.spots_taken) : null, // host + people going + their +1s (migration 018)
      visibility: row.visibility, createdAt: row.created_at, source: "supabase",
    };
  }

  async function loadActivities(force) {
    if (actCache && !force) return actCache;
    loadError = null;
    // spots_taken needs migration 018; without it the count is worked out from the commitments we can see
    const selects = [
      "*, spots_taken, host:profiles!activities_host_id_fkey(first_name,avatar_url,created_at), type:activity_types(name)",
      "*, host:profiles!activities_host_id_fkey(first_name,avatar_url,created_at), type:activity_types(name)",
      "*, host:profiles!activities_host_id_fkey(first_name,created_at), type:activity_types(name)",
    ];
    let data = null, error = null;
    for (const cols of selects) {
      ({ data, error } = await sb.from("activities").select(cols).order("starts_at"));
      if (!error) break;
    }
    if (error) { loadError = error.message; console.error(error); actCache = []; }
    else actCache = data.map(fromRow);
    return actCache;
  }

  function fromPostRow(row) {
    if (row.author && row.author_id !== ME) {
      cacheRemoteProfile({ id: row.author_id, ...row.author });
    }
    return {
      id: row.id,
      authorId: row.author_id,
      caption: row.caption,
      activityId: row.activity_id || null,
      visibility: row.visibility || "public",
      createdAt: row.created_at,
      source: "supabase",
    };
  }

  async function loadPosts(force) {
    if (postCache && !force) return postCache;
    let { data, error } = await sb.from("posts")
      .select("id, author_id, caption, activity_id, visibility, created_at, author:profiles!posts_author_id_fkey(first_name,avatar_url,created_at)")
      .order("created_at", { ascending: false });
    if (error) {
      const alt = await sb.from("posts")
        .select("id, author_id, caption, activity_id, visibility, created_at, author:profiles(first_name,created_at)")
        .order("created_at", { ascending: false });
      if (!alt.error) {
        data = alt.data;
        error = null;
      } else {
        const bare = await sb.from("posts")
          .select("id, author_id, caption, activity_id, visibility, created_at")
          .order("created_at", { ascending: false });
        if (!bare.error) {
          data = bare.data;
          error = null;
        }
      }
    }
    if (error) {
      console.error("Failed to load posts from Supabase:", error.message || error);
      postCache = (state.posts || []).map((p) => ({ ...p, source: "local" }));
    } else {
      postCache = (data || []).map(fromPostRow);
    }
    return postCache;
  }

  // "Activity" box ideas: most-used names first (2+ different hosts), then starters from activity_suggestions (migration 014)
  let suggestionCache = null;
  async function loadSuggestions() {
    if (suggestionCache) return suggestionCache;
    const { data, error } = await sb.from("activity_suggestions").select("name")
      .order("sort_order", { ascending: true, nullsFirst: false }).order("name");
    suggestionCache = error || !data ? [] : data.map((r) => r.name);
    return suggestionCache;
  }
  function activitySuggestions(limit = 10) {
    const groups = new Map(); // "board games" -> who used it, how often, and how they spelled it
    (actCache || []).forEach((a) => {
      const name = String(a.activityName || "").trim().replace(/\s+/g, " ");
      if (!name) return;
      const key = name.toLowerCase();
      const g = groups.get(key) || { hosts: new Set(), uses: 0, spellings: new Map() };
      g.hosts.add(a.hostId); g.uses++; g.spellings.set(name, (g.spellings.get(name) || 0) + 1);
      groups.set(key, g);
    });
    const popular = [...groups.values()]
      .filter((g) => g.hosts.size >= 2)
      .sort((x, y) => y.hosts.size - x.hosts.size || y.uses - x.uses)
      .map((g) => { const s = [...g.spellings].sort((p, q) => q[1] - p[1])[0][0]; return s.charAt(0).toUpperCase() + s.slice(1); });
    const out = [], seen = new Set();
    for (const n of [...popular, ...(suggestionCache || [])]) {
      if (out.length >= limit) break;
      if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push(n); }
    }
    return out;
  }

  async function loadTypes() {
    if (typeCache) return typeCache;
    const { data, error } = await sb.from("activity_types").select("id,name,emoji,sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false }).order("id");
    typeCache = error ? [] : data;
    return typeCache;
  }

  // Server-side rules the DB also enforces, checked here first for friendly messages.
  function validateActivity(f) {
    const errs = {};
    const req = ["title", "typeId", "activityName", "date", "start", "end", "location", "city", "address", "min", "max", "description"];
    req.forEach((k) => { if (!String(f[k] ?? "").trim()) errs[k] = "Required."; });
    if (f.title && f.title.length > 50) errs.title = "Keep it to 50 characters or fewer.";
    const min = Number(f.min), max = Number(f.max);
    if (f.min !== "" && (min < 3 || min > 20)) errs.min = "Use a number from 3 to 20.";
    if (f.max !== "" && (max < 3 || max > 20)) errs.max = "Use a number from 3 to 20.";
    if (!errs.min && !errs.max && f.min !== "" && f.max !== "" && min > max) errs.max = "Max can't be smaller than min.";
    if (f.date && f.start) {
      const s = new Date(f.date + "T" + f.start);
      if (s < new Date()) errs.date = "The activity must start in the future.";
      if (f.end) { const e = new Date(f.date + "T" + f.end); if (e <= s) errs.end = "End time must be after the start time."; }
    }
    return errs;
  }

  async function createActivity(f) {
    const errs = validateActivity(f);
    if (Object.keys(errs).length) return { ok: false, errors: errs };
    const starts = new Date(f.date + "T" + f.start).toISOString();
    const ends = new Date(f.date + "T" + f.end).toISOString();
    const me = profile(ME);
    const types = await loadTypes();
    const typeName = (types.find((t) => String(t.id) === String(f.typeId)) || {}).name || "";
    let id;
    const { data, error } = await sb.from("activities").insert({
      host_id: ME, type_id: Number(f.typeId), title: f.title.trim(), activity_name: f.activityName.trim(),
      description: f.description.trim(), what_to_bring: f.bring.trim() || null, starts_at: starts, ends_at: ends,
      general_location: f.location.trim(), city: f.city.trim(), latitude: me.lat, longitude: me.lng,
      min_participants: Number(f.min), max_participants: Number(f.max), visibility: f.visibility,
    }).select("id").single();
    if (error) return { ok: false, message: error.message };
    id = data.id;
    const addr = await sb.from("activity_addresses").insert({ activity_id: id, exact_address: f.address.trim() });
    if (addr.error) console.warn("Address not saved:", addr.error.message);
    state.addresses[id] = f.address.trim(); // host can always see their own address
    actCache = null;
    save();
    return { ok: true, id };
  }

  // =====================================================================
  // People + friends
  // =====================================================================
  function profile(id) { return state.profiles[id] || remoteProfiles[id] || { id, first: "Someone", last: "", avatarUrl: null }; }
  function fullName(id) { const p = profile(id); return (p.first + " " + (p.last || "")).trim(); }
  function friendshipWith(id) { return state.friendships.find((f) => (f.requesterId === ME && f.addresseeId === id) || (f.addresseeId === ME && f.requesterId === id)); }
  function isFriend(id) { const f = friendshipWith(id); return !!f && f.status === "accepted"; }
  function friends() { return state.friendships.filter((f) => f.status === "accepted").map((f) => ({ id: f.requesterId === ME ? f.addresseeId : f.requesterId, metAt: f.metAt, since: f.since })); }
  function incomingRequests() { return state.friendships.filter((f) => f.status === "pending" && f.addresseeId === ME); }
  function sentRequests() { return state.friendships.filter((f) => f.status === "pending" && f.requesterId === ME); }
  function sharedActivityId(otherId) {
    const mine = new Set(myCommitmentIds());
    const theirs = state.rsvps.filter((r) => r.profileId === otherId && r.status === "committed").map((r) => r.activityId);
    return theirs.find((id) => mine.has(id)) || null;
  }
  async function loadFriendships(force) {
    if (!ME) return state.friendships || [];
    try {
      const q = sb.from("friendships")
        .select("id, requester_id, addressee_id, status, met_at_activity_id, created_at, accepted_at, requester:profiles!friendships_requester_id_fkey(id,first_name,bio,avatar_url,created_at), addressee:profiles!friendships_addressee_id_fkey(id,first_name,bio,avatar_url,created_at)");
      if (typeof q.or !== "function") return state.friendships || [];
      const { data, error } = await q.or(`requester_id.eq.${ME},addressee_id.eq.${ME}`);
      if (error) {
        console.warn("Could not load friendships from Supabase (has migration 010 been run?):", error.message);
        return state.friendships || [];
      }
      if (data) {
        data.forEach((r) => {
          const other = r.requester_id === ME ? r.addressee : r.requester;
          const otherId = r.requester_id === ME ? r.addressee_id : r.requester_id;
          if (other) cacheRemoteProfile({ id: otherId, ...other });
        });
        state.friendships = data.map((r) => ({
          id: r.id,
          requesterId: r.requester_id,
          addresseeId: r.addressee_id,
          status: r.status,
          metAt: r.met_at_activity_id,
          since: r.accepted_at || r.created_at,
        }));
        state.friendships.filter((f) => f.status === "accepted").forEach((f) => {
          promoteChatForFriend(f.requesterId === ME ? f.addresseeId : f.requesterId);
        });
      }
      return state.friendships;
    } catch (e) {
      console.warn("loadFriendships error:", e);
      return state.friendships || [];
    }
  }

  async function loadProfile(id) {
    if (!id) return { ok: false, message: "Missing profile ID", profile: null };
    if (id === ME) return { ok: true, profile: state.profiles[ME] || null };
    try {
      const { data, error } = await sb.from("profiles")
        .select("id, first_name, bio, avatar_url, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) return { ok: false, message: error.message, profile: remoteProfiles[id] || null };
      if (!data) return { ok: true, profile: null };
      cacheRemoteProfile(data);
      return { ok: true, profile: remoteProfiles[id] };
    } catch (e) {
      return { ok: false, message: e.message || "Could not load profile", profile: remoteProfiles[id] || null };
    }
  }

  async function sendFriendRequest(id) {
    if (!id || id === ME) return { ok: false, message: "Invalid user" };
    if (friendshipWith(id)) return { ok: false, message: "Already requested or friends" };
    const shared = sharedActivityId(id);
    const sharedAct = shared && activity(shared);
    const metAt = (sharedAct && sharedAct.source === "supabase") ? (shared || null) : null;
    const { data, error } = await sb.from("friendships")
      .insert({ requester_id: ME, addressee_id: id, status: "pending", met_at_activity_id: metAt })
      .select("id, created_at")
      .single();
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) {
        await loadFriendships(true);
        save();
        const existing = friendshipWith(id);
        if (existing && existing.status === "accepted") {
          return { ok: false, code: "exists", message: "You're already friends." };
        }
        if (existing && existing.addresseeId === ME) {
          return { ok: false, code: "exists", message: "They already sent you a friend request — you can accept it now." };
        }
        return { ok: false, code: "exists", message: "A friend request is already pending." };
      }
      return { ok: false, message: error.message };
    }
    state.friendships.push({ id: data.id, requesterId: ME, addresseeId: id, status: "pending", metAt, since: data.created_at });
    save();
    return { ok: true };
  }

  async function cancelFriendRequest(idOrFid) {
    const f = state.friendships.find((x) => x.status === "pending" && x.requesterId === ME && (x.id === idOrFid || x.addresseeId === idOrFid));
    if (!f) return { ok: false, message: "Request not found" };
    const { error } = await sb.from("friendships").delete().eq("id", f.id);
    if (error) return { ok: false, message: error.message };
    state.friendships = state.friendships.filter((x) => x !== f);
    save();
    return { ok: true };
  }

  async function acceptFriend(fid) {
    const f = state.friendships.find((x) => x.id === fid && x.status === "pending" && x.addresseeId === ME);
    if (!f) return { ok: false, message: "Friend request not found" };
    const now = nowIso();
    const { data, error } = await sb.from("friendships")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", fid)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!data) {
      await loadFriendships(true);
      save();
      return { ok: false, message: "That friend request is no longer pending." };
    }
    f.status = "accepted";
    f.since = now;
    f.metAt = f.metAt || sharedActivityId(f.requesterId);
    promoteChatForFriend(f.requesterId);
    save();
    return { ok: true };
  }

  async function declineFriend(fid) {
    const f = state.friendships.find((x) => x.id === fid && x.status === "pending" && x.addresseeId === ME);
    if (!f) return { ok: false, message: "Request not found" };
    const { error } = await sb.from("friendships").delete().eq("id", fid);
    if (error) return { ok: false, message: error.message };
    state.friendships = state.friendships.filter((x) => x !== f);
    save();
    return { ok: true };
  }

  async function removeFriend(id) {
    const f = friendshipWith(id);
    if (!f || f.status !== "accepted") return { ok: false, message: "Friend not found" };
    const { error } = await sb.from("friendships").delete().eq("id", f.id);
    if (error) return { ok: false, message: error.message };
    state.friendships = state.friendships.filter((x) => x !== f);
    save();
    return { ok: true };
  }

  async function searchProfiles(query) {
    if (!query || !query.trim()) return { ok: true, ids: [] };
    const q = query.trim();
    try {
      const escaped = q.replace(/[\\%_]/g, "\\$&");
      const { data, error } = await sb.from("profiles")
        .select("id, first_name, bio, avatar_url, created_at")
        .ilike("first_name", `%${escaped}%`)
        .neq("id", ME)
        .order("first_name")
        .limit(20);
      if (error) {
        console.warn("searchProfiles error:", error.message);
        return { ok: false, message: error.message || "Could not search profiles.", ids: [] };
      }
      (data || []).forEach(cacheRemoteProfile);
      return { ok: true, ids: (data || []).map((p) => p.id) };
    } catch (e) {
      console.warn("searchProfiles error:", e);
      return { ok: false, message: e.message || "Could not search profiles.", ids: [] };
    }
    const ql = q.toLowerCase();
    return {
      ok: true,
      ids: Object.keys(state.profiles).filter((id) => {
        if (id === ME) return false;
        const name = isFriend(id) ? fullName(id) : profile(id).first;
        return name.toLowerCase().includes(ql);
      }),
    };
  }

  // =====================================================================
  // Activities: commitments (RSVPs), +1s, cancellations, check-ins
  // Saved in Supabase (migration 018). The database enforces every rule (full, 3-hour
  // cancel window, 2 cancels a month, 30-minute gap, blocks); the checks here just answer
  // quickly before asking it. Who can see what:
  //   everyone signed in: how many are going (activity.taken)
  //   the host and people going: who's going
  // =====================================================================
  const activity = (id) => (actCache || []).find((a) => a.id === id) || null;
  const isPast = (a) => new Date(a.endsAt) < new Date();
  const hasStarted = (a) => new Date(a.startsAt) <= new Date();
  function myRsvp(activityId) { return state.rsvps.find((r) => r.activityId === activityId && r.profileId === ME) || null; }
  function myGuestInvite(activityId) {
    return state.guests.find((g) => g.guestProfileId === ME && state.rsvps.some((r) => r.id === g.rsvpId && r.activityId === activityId)) || null;
  }
  // Activities I'm going to: my own committed RSVPs + +1 invites I accepted
  function myCommitmentIds() {
    const ids = state.rsvps.filter((r) => r.profileId === ME && r.status === "committed").map((r) => r.activityId);
    state.guests.filter((g) => g.guestProfileId === ME && g.status === "accepted").forEach((g) => {
      const r = state.rsvps.find((x) => x.id === g.rsvpId); if (r && r.status === "committed") ids.push(r.activityId);
    });
    return [...new Set(ids)];
  }
  function isGoing(activityId) { return myCommitmentIds().includes(activityId); }
  function myCommitments() { return myCommitmentIds().map(activity).filter(Boolean).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)); }
  // Exact address of an activity. Supabase returns it to the host and to people going (migration 018).
  async function loadAddress(id) {
    if (state.addresses[id]) return state.addresses[id];
    const { data, error } = await sb.from("activity_addresses").select("exact_address").eq("activity_id", id).maybeSingle();
    if (error || !data) return null;
    state.addresses[id] = data.exact_address;
    return data.exact_address;
  }
  function hosting() { return (actCache || []).filter((a) => a.hostId === ME); }

  // Load my commitments, the commitments on activities I host or go to, and +1 invites
  // (the database only returns rows I'm allowed to see), plus my cancellations.
  function fromRsvpRow(r) {
    if (r.person) cacheRemoteProfile(r.person);
    return { id: r.id, activityId: r.activity_id, profileId: r.profile_id, status: r.status, createdAt: r.created_at, cancelledAt: r.cancelled_at || null, attended: r.attended == null ? null : r.attended };
  }
  function fromGuestRow(g) {
    if (g.person) cacheRemoteProfile(g.person);
    return { id: g.id, rsvpId: g.rsvp_id, guestProfileId: g.guest_profile_id || null, guestFirstName: g.guest_first_name || null, status: g.status, createdAt: g.created_at };
  }
  async function loadCommitments() {
    if (!ME) return false;
    const who = "id,first_name,avatar_url,created_at";
    const [r, g, c] = await Promise.all([
      sb.from("rsvps").select(`id,activity_id,profile_id,status,created_at,cancelled_at,attended,checked_in_at,person:profiles!rsvps_profile_id_fkey(${who})`),
      sb.from("rsvp_guests").select(`id,rsvp_id,guest_profile_id,guest_first_name,status,created_at,person:profiles!rsvp_guests_guest_profile_id_fkey(${who})`),
      sb.from("rsvp_cancellations").select("activity_id,cancelled_at"),
    ]);
    const err = r.error || g.error || c.error;
    if (err) { console.warn("Commitments didn't load (has migration 018 been run?):", err.message); return false; }
    state.rsvps = (r.data || []).map(fromRsvpRow);
    state.guests = (g.data || []).map(fromGuestRow);
    state.cancellations = (c.data || []).map((x) => ({ activityId: x.activity_id, cancelledAt: x.cancelled_at }));
    // the exact address unlocks once you're going
    await Promise.all(myCommitmentIds().filter((id) => !state.addresses[id]).map((id) => loadAddress(id).catch(() => null)));
    return true;
  }
  // After a change: fresh commitments + fresh "N going" counts, then redraw every open page
  async function refreshCommitments() {
    await Promise.all([loadCommitments(), loadActivities(true)]);
    save();
  }
  // A database refusal → the same { ok:false, code, message } shape the pages already use
  function refusal(error) {
    return { ok: false, code: (error && error.hint) || null, message: (error && error.message) || "Something went wrong. Please try again." };
  }

  // Who's going: committed people + their +1s (pending friend invites don't hold a spot).
  // Only filled in for the host and people going; everyone else just sees the count.
  function attendees(activityId) {
    const list = [];
    state.rsvps.filter((r) => r.activityId === activityId && r.status === "committed").forEach((r) => {
      list.push({ kind: "member", profileId: r.profileId });
      const g = state.guests.find((x) => x.rsvpId === r.id);
      if (g && g.status === "accepted") list.push(g.guestProfileId ? { kind: "member", profileId: g.guestProfileId, plusOneOf: r.profileId } : { kind: "guest", name: g.guestFirstName, plusOneOf: r.profileId });
    });
    return list;
  }
  function canSeeAttendees(activityId) { const a = activity(activityId); return !!a && (a.hostId === ME || isGoing(activityId)); }
  function spotsTaken(activityId) { // +1 = host
    const a = activity(activityId);
    return a && a.taken != null ? a.taken : attendees(activityId).length + 1;
  }
  function cancellationsUsed() {
    const now = new Date();
    return state.cancellations.filter((c) => new Date(c.cancelledAt).getMonth() === now.getMonth() && new Date(c.cancelledAt).getFullYear() === now.getFullYear()).length;
  }
  function cancellationsLeft() { return Math.max(0, CANCELS_PER_MONTH - cancellationsUsed()); }
  function canCancel(activityId) {
    const a = activity(activityId); const r = myRsvp(activityId);
    if (!a || !r || r.status !== "committed") return { ok: false, code: "not_committed", reason: "You're not committed to this activity." };
    if (new Date(a.startsAt) - new Date() < CANCEL_HOURS * 36e5) return { ok: false, code: "cancel_window", reason: `Commitments can't be cancelled within ${CANCEL_HOURS} hours of the start.` };
    if (cancellationsLeft() === 0) return { ok: false, code: "no_cancels", reason: "You've used both cancellations for this month." };
    return { ok: true };
  }
  // PL-14: no overlap and no starting within 30 minutes of another commitment
  function conflictFor(a) {
    const buf = BUFFER_MIN * 6e4;
    const s = new Date(a.startsAt).getTime(), e = new Date(a.endsAt).getTime();
    return myCommitments().find((o) => o.id !== a.id && s < new Date(o.endsAt).getTime() + buf && e > new Date(o.startsAt).getTime() - buf) || null;
  }

  async function commit(activityId, plusOne) {
    const a = activity(activityId);
    if (!a) return { ok: false, message: "That activity couldn't be found." };
    if (!state.signedIn) return { ok: false, code: "login", message: "Sign in to commit to an activity." };
    if (hasStarted(a)) return { ok: false, code: "started", message: isPast(a) ? "This activity has already happened." : "This activity has already started." };
    if (a.hostId === ME) return { ok: false, message: "You're hosting this one." };
    if (isGoing(activityId)) return { ok: false, message: "You're already committed." };
    const conflict = conflictFor(a);
    if (conflict) return { ok: false, code: "conflict", conflict, message: "This overlaps or starts within 30 minutes of " + conflict.title + "." };
    const need = 1 + (plusOne && plusOne.type === "guest" ? 1 : 0);
    if (spotsTaken(activityId) + need > a.max) return { ok: false, code: "full", message: need > 1 && spotsTaken(activityId) + 1 <= a.max ? "There's only room for one more person, so you can't bring a guest." : "This activity is full." };

    const args = { p_activity: activityId };
    if (plusOne && plusOne.type === "friend") args.p_friend = plusOne.profileId;
    if (plusOne && plusOne.type === "guest") args.p_guest_name = plusOne.name.trim();
    const { error } = await sb.rpc("commit_to_activity", args);
    await refreshCommitments(); // either way: someone may have taken the last spot
    if (error) { const r = refusal(error); if (r.code === "conflict") r.code = null; return r; } // (the conflict pop-up needs details only the site has)
    return { ok: true };
  }

  async function cancel(activityId) {
    const c = canCancel(activityId); if (!c.ok) return { ok: false, code: c.code, message: c.reason };
    const { data, error } = await sb.rpc("cancel_commitment", { p_activity: activityId });
    await refreshCommitments();
    if (error) return refusal(error);
    return { ok: true, left: data && data.left != null ? data.left : cancellationsLeft() };
  }

  // Incoming +1 invites (a friend asked me along)
  function plusOneInvites() {
    return state.guests.filter((g) => g.guestProfileId === ME && g.status === "pending").map((g) => {
      const r = state.rsvps.find((x) => x.id === g.rsvpId); return { guest: g, rsvp: r, activity: r && activity(r.activityId) };
    }).filter((x) => x.rsvp && x.activity && !hasStarted(x.activity));
  }
  async function respondPlusOne(guestId, accept) {
    const g = state.guests.find((x) => x.id === guestId); if (!g) return { ok: false, message: "That invite is no longer open." };
    if (accept) {
      const r = state.rsvps.find((x) => x.id === g.rsvpId); const a = r && activity(r.activityId);
      const conflict = a && conflictFor(a);
      if (conflict) return { ok: false, code: "conflict", message: "This overlaps or starts within 30 minutes of " + conflict.title + "." };
    }
    const { data, error } = await sb.rpc("respond_plus_one", { p_guest: guestId, p_accept: !!accept });
    await refreshCommitments();
    if (error) return refusal(error);
    if (data && data.ok === false) return { ok: false, code: data.code || null, message: data.message };
    return { ok: true };
  }

  // "Did you go?" after it ends. Yes = today's "attended" Momentum (the database also credits the host).
  async function checkIn(activityId, attended) {
    const r = myRsvp(activityId); if (!r || r.attended !== null) return { ok: false, message: "You already checked in." };
    const before = momentum().gainedToday;
    const { error } = await sb.rpc("check_in_activity", { p_activity: activityId, p_attended: !!attended });
    if (error) return refusal(error);
    r.attended = !!attended;
    if (attended && !state.momentum.some((m) => m.date === today() && m.reason === "attended")) state.momentum.push({ date: today(), reason: "attended" });
    save();
    return { ok: true, gainedNow: !!attended && !before && momentum().gainedToday };
  }
  function needsCheckIn() { return myCommitments().filter((a) => isPast(a) && myRsvp(a.id) && myRsvp(a.id).status === "committed" && myRsvp(a.id).attended === null); }

  function report(activityId, authorId) { return state.reports.find((r) => r.activityId === activityId && r.authorId === authorId) || null; }
  function saveReport(activityId, body) {
    let r = report(activityId, ME);
    if (r) r.body = body; else state.reports.push({ id: uid(), activityId, authorId: ME, body, createdAt: nowIso() });
    save();
  }

  // =====================================================================
  // Habits, lessons, streaks
  // =====================================================================
  // Active habits in the user's chosen order (sortOrder), oldest first as a tiebreaker.
  const byOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || new Date(a.createdAt) - new Date(b.createdAt);
  const habits = () => state.habits.filter((h) => h.active).sort(byOrder);
  const archivedHabits = () => state.habits.filter((h) => !h.active).sort((a, b) => a.title.localeCompare(b.title));
  const nextSortOrder = () => state.habits.reduce((m, h) => Math.max(m, h.sortOrder ?? 0), 0) + 1;
  const isHabitDone = (habitId, d = today()) => state.checkins.some((c) => c.habitId === habitId && c.date === d);
  // Limits (the database enforces these too, migration 017)
  const MAX_ACTIVE_HABITS = 5, MAX_ARCHIVED_HABITS = 10;
  const canAddHabit = () => habits().length < MAX_ACTIVE_HABITS;
  const canArchiveHabit = () => archivedHabits().length < MAX_ARCHIVED_HABITS;
  const MAX_ACTIVE_MSG = "Max of 5 active habits reached. Archive one to add one.";
  const ARCHIVE_FULL_MSG = "Your habit archive is full (10). Delete an archived habit to archive this one.";
  function toggleHabitLocal(habitId) {
    const d = today();
    const before = momentum().gainedToday;
    if (isHabitDone(habitId, d)) state.checkins = state.checkins.filter((c) => !(c.habitId === habitId && c.date === d));
    else state.checkins.push({ habitId, date: d });
    save();
    const after = momentum().gainedToday;
    return { done: isHabitDone(habitId, d), gainedNow: !before && after, lostNow: before && !after };
  }
  // Signed in: the screen updates instantly, then the change is saved to Supabase.
  // If the save fails, the change is undone and the reason is shown.
  function syncFailed(message) { save(); if (window.UI) window.UI.toast(message); }
  // One save at a time per habit. Fast clicking only changes what the user WANTS;
  // when the current save finishes, one more save is sent if the database doesn't match yet.
  // (Sending every click at once let a "check" overtake an "uncheck", and the database
  // rightly rejected the duplicate check-in for the same day.)
  const habitSaves = new Map(); // habitId -> { want, saved }
  let habitClicks = 0;          // goes up on every click, so a refresh can tell it's out of date
  function toggleHabit(habitId) {
    const r = toggleHabitLocal(habitId);
    habitClicks++;
    let s = habitSaves.get(habitId);
    if (s) { s.want = r.done; return r; } // a save is already running; it will pick this up
    s = { want: r.done, saved: !r.done }; // before this click, the database had the opposite
    habitSaves.set(habitId, s);
    (async () => {
      while (s.want !== s.saved) {
        const target = s.want;
        const { error } = target
          ? await sb.from("habit_checkins").insert({ habit_id: habitId }) // the database fills in today's date
          : await sb.from("habit_checkins").delete().eq("habit_id", habitId).eq("check_date", today());
        if (error) {
          if (isHabitDone(habitId) !== s.saved) toggleHabitLocal(habitId); // show what the database really has
          syncFailed("Couldn't save: " + error.message);
          break;
        }
        s.saved = target;
      }
      habitSaves.delete(habitId);
      const clicksNow = habitClicks;
      // Refresh saved check-ins, unless the user clicked again meanwhile
      // (that newer save refreshes when it finishes, so this answer would be stale).
      loadHabitData(() => habitClicks === clicksNow && habitSaves.size === 0).then(save);
    })();
    return r;
  }
  async function addHabit(title, extra = {}) {
    if (!canAddHabit()) { const e = new Error(MAX_ACTIVE_MSG); e.code = "max_active"; throw e; }
    const clean = title.trim();
    if (!clean || clean.length > 80) throw new Error("Give your habit a name of 1 to 80 characters.");
    const h = { id: uid(), title: clean, goalText: null, lessonNumber: null, active: true, createdAt: nowIso(), sortOrder: nextSortOrder(), ...extra };
    const { error } = await sb.from("habits").insert({ id: h.id, profile_id: ME, title: h.title, goal_text: h.goalText, source_lesson_id: h.lessonId || null, sort_order: h.sortOrder });
    if (error) throw new Error("Couldn't save habit: " + error.message);
    state.habits.push(h);save();
    return h;
  }
  // Archive = hide the habit but keep its check-ins. Returns { ok:false, code } when the archive is full.
  function removeHabit(habitId) {
    const h = state.habits.find((x) => x.id === habitId);if (!h) return { ok: false };
    if (!canArchiveHabit()) return { ok: false, code: "archive_full", message: ARCHIVE_FULL_MSG };
    h.active = false;save();
    sb.from("habits").update({ is_active: false }).eq("id", habitId)
      .then(({ error }) => { if (error) { h.active = true; syncFailed("Couldn't archive habit: " + error.message); } else loadHabitData().then(save); });
    return { ok: true };
  }
  // Delete an ARCHIVED habit for good. Its check-ins go with it; past Momentum stays (it lives in the momentum log).
  function deleteHabit(habitId) {
    const i = state.habits.findIndex((x) => x.id === habitId && !x.active); if (i < 0) return { ok: false };
    const [h] = state.habits.splice(i, 1); save();
    sb.from("habits").delete().eq("id", habitId)
      .then(({ error }) => { if (error) { state.habits.push(h); syncFailed("Couldn't delete habit: " + error.message); } });
    return { ok: true };
  }
  // Restore from the Archived list → bottom of the list. Undo right after archiving → back in its old spot.
  function restoreHabit(habitId, { keepPlace = false } = {}) {
    const h = state.habits.find((x) => x.id === habitId);if (!h) return { ok: false };
    if (!canAddHabit()) return { ok: false, code: "max_active", message: MAX_ACTIVE_MSG };
    const before = h.sortOrder;
    h.active = true;if (!keepPlace) h.sortOrder = nextSortOrder();save();
    sb.from("habits").update({ is_active: true, sort_order: h.sortOrder }).eq("id", habitId)
      .then(({ error }) => { if (error) { h.active = false; h.sortOrder = before; syncFailed("Couldn't restore habit: " + error.message); } else loadHabitData().then(save); });
    return { ok: true };
  }
  function editHabit(habitId, title) {
    const h = state.habits.find((x) => x.id === habitId);if (!h) return { ok: false, message: "Habit not found." };
    const t = title.trim();
    if (!t) return { ok: false, message: "Give the habit a name." };
    if (t.length > 80) return { ok: false, message: "Keep it under 80 characters." };
    const before = h.title;
    h.title = t;save();
    sb.from("habits").update({ title: t }).eq("id", habitId)
      .then(({ error }) => { if (error) { h.title = before; syncFailed("Couldn't rename habit: " + error.message); } });
    return { ok: true };
  }
  // ids = active habit ids in their new order (top to bottom)
  function reorderHabits(ids) {
    const changed = [];
    ids.forEach((id, i) => { const h = state.habits.find((x) => x.id === id); if (h && h.sortOrder !== i + 1) { h.sortOrder = i + 1; changed.push(h); } });
    if (!changed.length) return;
    save();
    Promise.all(changed.map((h) => sb.from("habits").update({ sort_order: h.sortOrder }).eq("id", h.id)))
      .then((results) => { const bad = results.find((r) => r.error); if (bad) loadHabitData().then(() => syncFailed("Couldn't save the new order: " + bad.error.message)); });
  }

  const LESSON_COUNT = 6;
  const CURRICULUM_VERSION = 2;
  let lessonCatalog = [];
  const pendingLessons = new Map();
  const isLessonDone = (n) => state.lessonsDone.some((l) => l.n === n);
  const isLessonUnlocked = (n) => n === 1 || isLessonDone(n - 1);
  function currentLesson() { for (let n = 1; n <= LESSON_COUNT; n++) if (!isLessonDone(n)) return n; return null; }
  // Finishing a lesson adds its habit, so a NEW lesson needs a free habit slot. Reviewing a finished one is always fine.
  const LESSON_BLOCKED_MSG = "You won't be able to do this lesson until you have 1 open habit slot.";
  const canStartLesson = (n) => isLessonDone(n) || canAddHabit();
  function completeLesson(n, goalText, habitTitle) {
    if (pendingLessons.has(n)) return pendingLessons.get(n);
    const pending = saveLesson(n, goalText, habitTitle).finally(() => pendingLessons.delete(n));
    pendingLessons.set(n, pending);
    return pending;
  }
  async function saveLesson(n, goalText, habitTitle) {
    if (!Number.isInteger(n) || n < 1 || n > LESSON_COUNT) return { ok: false, message: "Lesson not found." };
    if (!isLessonUnlocked(n)) return { ok: false, message: "Finish the previous lesson first." };
    if (isLessonDone(n)) return { ok: false, message: "You've already finished this lesson." };
    if (!canStartLesson(n)) return { ok: false, code: "max_active", message: LESSON_BLOCKED_MSG };
    const gainedBefore = momentum().gainedToday;
    const goal = goalText.trim(), title = habitTitle.trim();
    if (!goal || goal.length > 1000) return { ok: false, message: "Add a brief reflection of up to 1,000 characters." };
    if (!title || title.length > 80) return { ok: false, message: "Give your daily habit a name of 1 to 80 characters." };
    try {
      const { data, error } = await sb.rpc("complete_momentum_lesson", { p_number: n, p_goal: goal, p_habit_title: title });
      if (error) return { ok: false, message: error.message };
      if (!data || !data.ok) return { ok: false, message: "The lesson could not be saved. Please try again." };
      const refreshed = await Promise.all([loadLessonData(), loadHabitData()]);
      if (!refreshed.every(Boolean)) return { ok: false, message: "Your lesson was saved, but we couldn't refresh your progress. Reload this page; retrying won't create another habit." };
      save();
      return { ...data, gainedNow: !gainedBefore && momentum().gainedToday };
    } catch (error) { return { ok: false, message: error.message || "Couldn't reach the server. Your reflection is still here; please try again." }; }

  }
  function lessonHabit(n) {
    const completed = state.lessonsDone.find(l => l.n === n);
    const lesson = lessonCatalog.find(l => l.number === n);
    return state.habits.find(h => (completed && completed.habitId === h.id) || (lesson && h.lessonId === lesson.id)) || null;
  }
  async function loadLessonData() {
    try {
      const [lessons, completed] = await Promise.all([
        sb.from("lessons").select("id,number").eq("curriculum_version", CURRICULUM_VERSION).order("number"),
        sb.from("lesson_completions").select("lesson_id,completed_at,user_goal_response,habit_id").eq("profile_id", ME)
      ]);
      if (lessons.error || completed.error || lessons.data?.length !== LESSON_COUNT || !completed.data) return false;
      lessonCatalog = lessons.data;
      if (!state.lessonSyncVersion) state.legacyLessonProgress = state.lessonsDone || [];
      state.lessonSyncVersion = CURRICULUM_VERSION;
      const numbers = new Map(lessonCatalog.map(l => [l.id, l.number]));
      state.lessonsDone = completed.data.filter(c => numbers.has(c.lesson_id)).map(c => ({ n: numbers.get(c.lesson_id), at: c.completed_at, goal: c.user_goal_response, habitId: c.habit_id }));
      return true;
    } catch (_) { return false; }
  }
  function lessonGoal(n) { const l = state.lessonsDone.find((x) => x.n === n); return l ? l.goal : null; }

  // Momentum (migration 017). A day "gains Momentum" if you checked at least half your active habits
  // (rounded up), finished a lesson, or went to an activity. Past days come from the momentum log
  // (locked in by the database); TODAY is judged live on this device so the screen reacts instantly.
  // The number: +1 for each day gained, -2 for each day missed, never below 0. Today never counts
  // against you until it's over.
  const MOMENTUM_GAIN = 1, MOMENTUM_DECAY = 2;
  const habitsNeeded = () => { const n = habits().length; return n ? Math.ceil(n / 2) : 0; };
  const habitsDoneToday = () => habits().filter((h) => isHabitDone(h.id)).length;
  function momentumDays() {
    const t = today();
    const days = new Set(state.momentum.filter((m) => !(m.date === t && m.reason === "habits")).map((m) => m.date));
    if (habits().length && habitsDoneToday() >= habitsNeeded()) days.add(t);
    return days;
  }
  function momentum() {
    const t = today(), days = momentumDays();
    const past = [...days].filter((d) => d < t).sort();
    let value = 0, top = 0;
    for (let d = past[0]; d && d < t; d = addDays(d, 1)) {
      value = days.has(d) ? value + MOMENTUM_GAIN : Math.max(0, value - MOMENTUM_DECAY);
      top = Math.max(top, value);
    }
    const gainedToday = days.has(t);
    if (gainedToday) { value += MOMENTUM_GAIN; top = Math.max(top, value); }
    const missedYesterday = past.length > 0 && !days.has(addDays(t, -1));
    return {
      value, top, gainedToday,
      trend: gainedToday ? "up" : missedYesterday ? "down" : "flat", // up = gaining, flat = coasting, down = slowing
      needed: habitsNeeded(), doneToday: habitsDoneToday(), active: habits().length,
    };
  }
  function lastDays(n) {
    const days = momentumDays(), out = [];
    for (let i = n - 1; i >= 0; i--) { const d = addDays(today(), -i); out.push({ date: d, gained: days.has(d), count: days.has(d) ? 1 : 0 }); }
    return out;
  }
  function stats() {
    const m = momentum();
    const countsByDay = {}; state.checkins.forEach((c) => (countsByDay[c.date] = (countsByDay[c.date] || 0) + 1));
    const goalsMetDays = Object.values(countsByDay).filter((n) => n >= Math.max(1, habits().length)).length;
    return {
      // "streak", "longest" and "doneToday" keep their old names for older pages and tests:
      // they now mean the Momentum number, top speed, and "gained Momentum today".
      streak: m.value, longest: m.top, doneToday: m.gainedToday, momentum: m.value, top: m.top, trend: m.trend,
      habitsNeeded: m.needed, habitsDone: m.doneToday, activeHabits: m.active, gainedDays: momentumDays().size, lessonPercent: Math.round(state.lessonsDone.length / LESSON_COUNT * 100),
      habitsChecked: state.checkins.length, goalsMetDays, lessonsDone: state.lessonsDone.length,
      attended: state.rsvps.filter((r) => r.profileId === ME && r.attended === true).length,
      upcoming: myCommitments().filter((a) => !isPast(a)).length,
      posts: ((postCache !== null ? postCache : state.posts) || []).filter((p) => p.authorId === ME).length,
    };
  }

  // =====================================================================
  // Posts + feed
  // =====================================================================
  async function createPost({ caption, activityId, visibility }) {
    if (!caption || !caption.trim()) return { ok: false, message: "Write something before posting." };
    if (caption.trim().length > 500) return { ok: false, message: "Posts can be up to 500 characters." };
    let post;
    let res = await sb.from("posts").insert({
      author_id: ME,
      caption: caption.trim(),
      activity_id: activityId || null,
      visibility: "public",
    }).select("id, author_id, caption, activity_id, visibility, created_at, author:profiles!posts_author_id_fkey(first_name,avatar_url,created_at)").single();
    if (res.error) {
      res = await sb.from("posts").insert({
        author_id: ME,
        caption: caption.trim(),
        activity_id: activityId || null,
        visibility: "public",
      }).select().single();
    }
    if (res.error) return { ok: false, message: res.error.message };
    post = fromPostRow(res.data);
    if (!state.posts) state.posts = [];
    state.posts.unshift(post);
    if (postCache && !postCache.some((p) => p.id === post.id)) postCache.unshift(post);
    save();
    return { ok: true, post };
  }

  async function deletePost(id) {
    const { error } = await sb.from("posts").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    state.posts = (state.posts || []).filter((p) => p.id !== id);
    if (postCache) postCache = postCache.filter((p) => p.id !== id);
    save();
    return { ok: true };
  }

  function setPostVisibility(id, v) {
    const list = postCache !== null ? postCache : state.posts;
    const p = (list || []).find((x) => x.id === id);
    if (p) { p.visibility = v; save(); }
  }

  function encouraged(postId) { return state.encouragements.some((e) => e.postId === postId && e.profileId === ME); }
  function toggleEncourage(postId) {
    if (encouraged(postId)) state.encouragements = state.encouragements.filter((e) => !(e.postId === postId && e.profileId === ME));
    else state.encouragements.push({ postId, profileId: ME, at: nowIso() });
    save();
  }

  // 10 most recent posts + activities from friends and public posts. No reshuffle, newest first.
  function feed() {
    const fr = new Set(friends().map((f) => f.id));
    fr.add(ME);
    const items = [];
    const pList = postCache !== null ? postCache : (state.posts || []);
    pList.filter((p) => p.visibility === "public" || fr.has(p.authorId)).forEach((p) => items.push({ kind: "post", at: p.createdAt, post: p }));
    (actCache || []).filter((a) => a.visibility === "public" || fr.has(a.hostId)).forEach((a) => items.push({ kind: "activity", at: a.createdAt, activity: a }));
    return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
  }

  function historyFor(profileId) {
    const pList = postCache !== null ? postCache : (state.posts || []);
    const items = pList.filter((p) => p.authorId === profileId).map((p) => ({ kind: "post", at: p.createdAt, post: p }));
    const going = profileId === ME ? new Set(myCommitmentIds()) : new Set(state.rsvps.filter((r) => r.profileId === profileId && r.status === "committed").map((r) => r.activityId));
    (actCache || []).filter((a) => a.hostId === profileId || going.has(a.id)).forEach((a) => items.push({ kind: "activity", at: a.startsAt, activity: a, hosting: a.hostId === profileId }));
    return items.sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  // =====================================================================
  // Messages (SN-4): 1-on-1 private chats & message requests
  // =====================================================================
  const RETRY_MS = 7 * 864e5;
  const memberStatus = (c, id) => (c.members.find((m) => m.id === id) || {}).status;
  const last = (c) => (c.messages && c.messages[c.messages.length - 1]) || {};
  function otherMember(c) { return (c.members.find((m) => m.id !== ME) || {}).id; }
  function promoteChatForFriend(otherId) {
    if (!otherId || !state || !Array.isArray(state.conversations)) return;
    const c = state.conversations.find((x) => x.kind === "direct" && x.members.length === 2 && x.members.some((m) => m.id === ME) && x.members.some((m) => m.id === otherId));
    if (c) c.members.forEach((m) => { if (m.status === "requested" || m.status === "declined") m.status = "active"; });
  }
  function fromConversationRow(row) {
    (row.members || []).forEach((m) => {
      if (m.profile && m.profile_id !== ME) cacheRemoteProfile({ id: m.profile_id, ...m.profile });
    });
    const lastRead = {};
    const members = (row.members || []).map((m) => {
      if (m.last_read_at) lastRead[m.profile_id] = m.last_read_at;
      return { id: m.profile_id, status: m.status, lastReadAt: m.last_read_at || null };
    });
    const messages = (row.messages || []).map((m) => ({
      id: m.id, senderId: m.sender_id, body: m.body, at: m.created_at,
    })).sort((a, b) => new Date(a.at) - new Date(b.at));
    return {
      id: row.id,
      kind: row.kind,
      activityId: row.activity_id || null,
      createdAt: row.created_at,
      members,
      lastRead,
      messages,
      source: "supabase",
    };
  }
  async function loadConversations() {
    if (!ME) return conversations();
    try {
      const q = sb.from("conversations")
        .select("id, kind, activity_id, created_at, archived_at, members:conversation_members(profile_id, status, joined_at, last_read_at, profile:profiles(id, first_name, bio, avatar_url, created_at)), messages(id, sender_id, body, created_at)");
      const { data, error } = await (typeof q.eq === "function" ? q.eq("kind", "direct") : q);
      if (error) {
        console.warn("Could not load conversations from Supabase (has migration 011 been run?):", error.message);
        return conversations();
      }
      if (Array.isArray(data)) {
        state.conversations = data.map(fromConversationRow);
        persist();
      }
      return conversations();
    } catch (e) {
      console.warn("loadConversations error:", e);
      return conversations();
    }
  }
  function hasBlocked(id) {
    return !!id && (state?.blocks || []).some((b) => b.blockerId === ME && b.blockedId === id);
  }
  function isBlockedBy(id) {
    return !!id && (state?.blocks || []).some((b) => b.blockerId === id && b.blockedId === ME);
  }
  function isBlockedBetween(id) {
    return hasBlocked(id) || isBlockedBy(id);
  }
  function blockedUsers() {
    return (state?.blocks || [])
      .filter((b) => b.blockerId === ME)
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((b) => ({ id: b.blockedId, createdAt: b.createdAt }));
  }
  async function loadBlocks() {
    if (!ME) return (state && state.blocks) || [];
    try {
      const q = sb.from("user_blocks")
        .select("blocker_id, blocked_id, created_at, blocker:profiles!user_blocks_blocker_id_fkey(id, first_name, bio, avatar_url, created_at), blocked:profiles!user_blocks_blocked_id_fkey(id, first_name, bio, avatar_url, created_at)");
      if (typeof q.or !== "function") return (state && state.blocks) || [];
      const { data, error } = await q.or(`blocker_id.eq.${ME},blocked_id.eq.${ME}`);
      if (error) {
        console.warn("Could not load user_blocks from Supabase (has migration 015 been run?):", error.message);
        return (state && state.blocks) || [];
      }
      if (Array.isArray(data)) {
        data.forEach((r) => {
          if (r.blocker && r.blocker_id !== ME) cacheRemoteProfile({ id: r.blocker_id, ...r.blocker });
          if (r.blocked && r.blocked_id !== ME) cacheRemoteProfile({ id: r.blocked_id, ...r.blocked });
        });
        state.blocks = data.map((r) => ({
          blockerId: r.blocker_id,
          blockedId: r.blocked_id,
          createdAt: r.created_at,
        }));
        persist();
      }
      return state.blocks || [];
    } catch (e) {
      console.warn("loadBlocks error:", e);
      return (state && state.blocks) || [];
    }
  }
  async function blockUser(otherId) {
    if (!otherId || otherId === ME) return { ok: false, message: "Choose someone else to block." };
    const { data, error } = await sb.from("user_blocks")
      .insert({ blocker_id: ME, blocked_id: otherId })
      .select("blocker_id, blocked_id, created_at")
      .single();
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) {
        await loadBlocks();
        save();
        return { ok: true, alreadyBlocked: true };
      }
      return { ok: false, message: error.message || "Could not block this user." };
    }
    if (!Array.isArray(state.blocks)) state.blocks = [];
    if (!hasBlocked(otherId)) {
      state.blocks.push({
        blockerId: data ? data.blocker_id : ME,
        blockedId: data ? data.blocked_id : otherId,
        createdAt: (data && data.created_at) || nowIso(),
      });
    }
    save();
    return { ok: true };
  }
  async function unblockUser(otherId) {
    if (!otherId || otherId === ME) return { ok: false, message: "Invalid user." };
    const { error } = await sb.from("user_blocks")
      .delete()
      .eq("blocker_id", ME)
      .eq("blocked_id", otherId);
    if (error) return { ok: false, message: error.message || "Could not unblock this user." };
    state.blocks = (state.blocks || []).filter((b) => !(b.blockerId === ME && b.blockedId === otherId));
    save();
    return { ok: true };
  }

  function conversations() {
    return (state.conversations || [])
      .filter((c) => {
        if (c.kind !== "direct" || !c.members.some((m) => m.id === ME) || !c.members.some((m) => m.id !== ME)) return false;
        if (memberStatus(c, ME) === "declined") return false;
        const other = otherMember(c);
        if (hasBlocked(other)) return false;
        if (memberStatus(c, ME) === "requested" && isBlockedBy(other)) return false;
        return true;
      })
      .sort((a, b) => new Date(last(b).at || b.createdAt || 0) - new Date(last(a).at || a.createdAt || 0));
  }
  function findDirect(otherId) {
    if (!otherId) return null;
    return (state.conversations || []).find((x) => x.kind === "direct" && x.members.length === 2 && x.members.some((m) => m.id === ME) && x.members.some((m) => m.id === otherId)) || null;
  }
  function isRequestToMe(c) {
    const other = otherMember(c);
    return !!c && c.kind === "direct" && memberStatus(c, ME) === "requested" && !isFriend(other) && !isBlockedBetween(other);
  }
  function isOutgoingPending(c) {
    if (!c || c.kind !== "direct" || isRequestToMe(c)) return false;
    const other = otherMember(c);
    if (isBlockedBetween(other)) return false;
    return !isFriend(other) && memberStatus(c, other) === "requested";
  }
  function unread(c) {
    if (!c || isBlockedBetween(otherMember(c))) return false;
    const l = last(c);
    return !!l.at && l.senderId !== ME && (!c.lastRead || !c.lastRead[ME] || new Date(l.at) > new Date(c.lastRead[ME]));
  }
  function unreadConversationsCount() { return conversations().filter((c) => !isRequestToMe(c) && unread(c)).length; }
  function incomingMessageRequests() { return conversations().filter((c) => isRequestToMe(c)); }
  function unreadCount() { return conversations().filter((c) => unread(c) || isRequestToMe(c)).length; }
  function conversation(id) { return (state.conversations || []).find((c) => c.id === id && c.kind === "direct") || null; }
  function markRead(id, { silent = false } = {}) {
    const c = conversation(id);
    if (!c || !unread(c)) return;
    const ts = nowIso();
    c.lastRead = c.lastRead || {};
    c.lastRead[ME] = ts;
    const meM = c.members.find((m) => m.id === ME);
    if (meM) meM.lastReadAt = ts;
    if (silent) persist();
    else save();
    if (c.source === "supabase") {
      sb.from("conversation_members")
        .update({ last_read_at: ts })
        .eq("conversation_id", id)
        .eq("profile_id", ME)
        .then(({ error }) => { if (error) console.warn("markRead error:", error.message); });
    }
  }
  function requestStatusFor(otherId) {
    if (hasBlocked(otherId)) {
      return { kind: "blocked_by_me", canSend: false, isRequest: false, messagesLeft: 0, retryAt: null };
    }
    if (isBlockedBy(otherId)) {
      return { kind: "blocked_by_other", canSend: false, isRequest: false, messagesLeft: 0, retryAt: null };
    }
    const c = findDirect(otherId);
    const friends = isFriend(otherId);
    if (!c) {
      return { kind: friends ? "friend_new" : "request_initial", canSend: true, isRequest: !friends, messagesLeft: friends ? Infinity : 1, retryAt: null };
    }
    const mySt = memberStatus(c, ME);
    const otherSt = memberStatus(c, otherId);
    if (friends || (mySt === "active" && otherSt === "active")) {
      return { kind: "active", canSend: true, isRequest: false, messagesLeft: Infinity, retryAt: null };
    }
    if (mySt === "requested") {
      return { kind: "incoming_request", canSend: false, isRequest: true, messagesLeft: 0, retryAt: null };
    }
    if (mySt === "declined") {
      return { kind: "declined_by_me", canSend: false, isRequest: true, messagesLeft: 0, retryAt: null };
    }
    if (otherSt === "declined") {
      return { kind: "declined_by_other", canSend: false, isRequest: true, messagesLeft: 0, retryAt: null };
    }
    const msgs = c.messages || [];
    if (msgs.length === 0) {
      return { kind: "request_initial", canSend: true, isRequest: true, messagesLeft: 1, retryAt: null };
    }
    if (msgs.length === 1) {
      const firstMs = new Date(msgs[0].at).getTime();
      const retryMs = firstMs + RETRY_MS;
      if (Date.now() >= retryMs) {
        return { kind: "request_followup_ready", canSend: true, isRequest: true, messagesLeft: 1, retryAt: null };
      }
      return { kind: "request_waiting", canSend: false, isRequest: true, messagesLeft: 0, retryAt: new Date(retryMs).toISOString() };
    }
    return { kind: "request_limit_reached", canSend: false, isRequest: true, messagesLeft: 0, retryAt: null };
  }
  async function sendDirectMessage({ recipientId, body, activityId = null }) {
    if (!recipientId || recipientId === ME) return { ok: false, message: "Choose someone else to message." };
    const clean = String(body || "").trim();
    if (!clean) return { ok: false, message: "Write a message first." };
    if (clean.length > 2000) return { ok: false, message: "Keep messages under 2,000 characters." };

    const st = requestStatusFor(recipientId);
    if (!st.canSend) {
      if (st.kind === "blocked_by_me") return { ok: false, message: "Unblock this person to send messages." };
      if (st.kind === "blocked_by_other") return { ok: false, message: "Messaging this person is currently unavailable." };
      if (st.kind === "incoming_request") return { ok: false, message: "Accept this message request before replying." };
      if (st.kind === "declined_by_me") return { ok: false, message: "Accept this message request to reply." };
      if (st.kind === "declined_by_other") return { ok: false, message: "Follow-up messages aren't available for this request." };
      if (st.kind === "request_waiting") return { ok: false, message: "You can send 1 follow-up message after 7 days if they haven't responded." };
      return { ok: false, message: "You've already sent your follow-up message. Wait for them to accept." };
    }

    const linkedAct = activityId && activity(activityId)?.source === "supabase" ? activityId : null;
    const { data, error } = await sb.rpc("send_direct_message", {
      p_recipient_id: recipientId,
      p_body: clean,
      p_activity_id: linkedAct,
    });
    if (error || !data || !data.ok) {
      await loadBlocks();
      save();
      return { ok: false, message: (error && error.message) || "Could not send message." };
    }
    const existing = conversation(data.conversationId);
    const members = (data.members || []).map((m) => ({ id: m.id, status: m.status, lastReadAt: m.lastReadAt || null }));
    const lastRead = {};
    members.forEach((m) => { if (m.lastReadAt) lastRead[m.id] = m.lastReadAt; });
    if (existing) {
      existing.activityId = existing.activityId || data.activityId || null;
      existing.members = members;
      existing.lastRead = lastRead;
      if (!existing.messages.some((m) => m.id === data.message.id)) existing.messages.push(data.message);
    } else {
      if (!Array.isArray(state.conversations)) state.conversations = [];
      state.conversations.push({
        id: data.conversationId,
        kind: "direct",
        activityId: data.activityId || null,
        createdAt: data.createdAt || nowIso(),
        members,
        lastRead,
        messages: [data.message],
        source: "supabase",
      });
    }
    save();
    return { ok: true, conversationId: data.conversationId, message: data.message };

    let c = findDirect(recipientId);
    const ts = nowIso();
    if (!c) {
      c = {
        id: uid(),
        kind: "direct",
        activityId: activityId || null,
        createdAt: ts,
        members: [
          { id: ME, status: "active", lastReadAt: ts },
          { id: recipientId, status: isFriend(recipientId) ? "active" : "requested", lastReadAt: null },
        ],
        lastRead: { [ME]: ts },
        messages: [],
        source: "local",
      };
      state.conversations.push(c);
    } else if (isFriend(recipientId) || memberStatus(c, ME) === "declined") {
      c.members.forEach((m) => (m.status = "active"));
    }
    const msg = { id: uid(), senderId: ME, body: clean, at: ts };
    c.messages.push(msg);
    c.lastRead = c.lastRead || {};
    c.lastRead[ME] = ts;
    const meM = c.members.find((m) => m.id === ME);
    if (meM) meM.lastReadAt = ts;
    save();
    return { ok: true, conversationId: c.id, message: msg };
  }
  async function send(convoId, body) {
    const c = conversation(convoId);
    if (!c) return { ok: false, message: "Conversation not found." };
    return sendDirectMessage({ recipientId: otherMember(c), body, activityId: c.activityId });
  }
  async function respondRequest(convoId, accept) {
    const c = conversation(convoId);
    if (!c) return { ok: false, message: "Message request not found." };
    if (isBlockedBetween(otherMember(c))) {
      return { ok: false, message: "Messaging this person is currently unavailable." };
    }
    const { data, error } = await sb.rpc("respond_message_request", { p_conversation_id: convoId, p_accept: !!accept });
    if (error || !data || !data.ok) {
      await loadBlocks();
      save();
      return { ok: false, message: (error && error.message) || "Could not update message request." };
    }
    const ts = nowIso();
    const m = c.members.find((x) => x.id === ME);
    if (m) {
      m.status = accept ? "active" : "declined";
      m.lastReadAt = ts;
    }
    c.lastRead = c.lastRead || {};
    c.lastRead[ME] = ts;
    save();
    return { ok: true, status: accept ? "active" : "declined" };
  }
  function openDirect(otherId) { return findDirect(otherId); }
  function shareActivityPeople() {
    const mine = new Set(myCommitmentIds().concat(hosting().map((a) => a.id)));
    const ids = new Set();
    state.rsvps.filter((r) => mine.has(r.activityId) && r.status === "committed" && r.profileId !== ME).forEach((r) => ids.add(r.profileId));
    (actCache || []).filter((a) => mine.has(a.id) && a.hostId !== ME).forEach((a) => ids.add(a.hostId));
    return [...ids];
  }

  // =====================================================================
  // Settings + profile
  // =====================================================================
  function setSetting(k, v) { state.settings[k] = v; if (k === "attendeeDisplay") state.profiles[ME].attendeeDisplay = v; save(); }
  // Signed in: saves to Supabase (public fields → profiles, private → profile_private).
  async function updateProfile(fields) {
    const pub = await sb.from("profiles").update({ first_name: fields.first, bio: fields.bio || null }).eq("id", ME);
    if (pub.error) return { ok: false, message: pub.error.message };
    const priv = await sb.from("profile_private").update({ last_name: fields.last, sex: fields.sex }).eq("profile_id", ME);
    if (priv.error) return { ok: false, message: priv.error.message };
    if (Array.isArray(fields.interests)) {
      const idOf = {}; (interestCache || []).forEach((i) => (idOf[i.name] = i.id));
      const before = Object.keys(myInterestIds);
      const add = fields.interests.filter((n) => !(n in myInterestIds) && idOf[n] != null);
      const remove = before.filter((n) => !fields.interests.includes(n));
      if (remove.length) {
        const r = await sb.from("profile_interests").delete().eq("profile_id", ME).in("interest_id", remove.map((n) => myInterestIds[n]));
        if (r.error) return { ok: false, message: r.error.message };
        remove.forEach((n) => delete myInterestIds[n]);
      }
      if (add.length) {
        const r = await sb.from("profile_interests").insert(add.map((n) => ({ profile_id: ME, interest_id: idOf[n] })));
        if (r.error) return { ok: false, message: r.error.message };
        add.forEach((n) => (myInterestIds[n] = idOf[n]));
      }
      fields = { ...fields, interests: Object.keys(myInterestIds) };
    }
    Object.assign(state.profiles[ME], fields);save();
    return { ok: true };
  }

  // Client-side image resize & compression (Canvas) to ~300x300 JPEG (approx 40-80 KB)
  function resizeImageToBlob(file, targetSize = 300, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        return reject(new Error("Please select an image file (JPEG, PNG, or WebP)."));
      }
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas context not available."));

          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const minSide = Math.min(w, h);
          const sx = (w - minSide) / 2;
          const sy = (h - minSide) / 2;

          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Image compression failed."));
          }, "image/jpeg", quality);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error("Could not load image file."));
      };
      img.src = objUrl;
    });
  }

  async function uploadAvatar(file) {
    try {
      const blob = await resizeImageToBlob(file, 300, 0.85);

      const filePath = `${ME}/avatar.jpg`;
      const { error: uploadError } = await sb.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return { ok: false, message: uploadError.message };
      }

      const { data: urlData } = sb.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;
      const urlWithVersion = `${publicUrl}?v=${Date.now()}`;

      const { error: dbError } = await sb.from("profiles")
        .update({ avatar_url: urlWithVersion })
        .eq("id", ME);

      if (dbError) {
        console.error("Profile update error:", dbError);
        return { ok: false, message: dbError.message };
      }

      if (state && state.profiles[ME]) {
        state.profiles[ME].avatarUrl = urlWithVersion;
        save();
        emit();
      }

      return { ok: true, url: urlWithVersion };
    } catch (err) {
      console.error("uploadAvatar failed:", err);
      return { ok: false, message: err.message || "Upload failed." };
    }
  }

  async function deleteAvatar() {
    try {
      const filePath = `${ME}/avatar.jpg`;
      const { error: removeError } = await sb.storage.from("avatars").remove([filePath]);
      if (removeError) {
        console.warn("Storage remove warning:", removeError);
      }

      const { error: dbError } = await sb.from("profiles")
        .update({ avatar_url: null })
        .eq("id", ME);

      if (dbError) {
        return { ok: false, message: dbError.message };
      }

      if (state && state.profiles[ME]) {
        state.profiles[ME].avatarUrl = null;
        save();
        emit();
      }

      return { ok: true };
    } catch (err) {
      console.error("deleteAvatar failed:", err);
      return { ok: false, message: err.message || "Failed to remove photo." };
    }
  }

  // =====================================================================
  // Signed-in user. Every page calls Store.init() first (via UI.mount).
  // Returns true (ready), false (not signed in), "noprofile", or "syncerror".
  // =====================================================================
  const PROVO = { lat: 40.2338, lng: -111.6585 }; // map/distance fallback until we geocode addresses
  function profileFromRows(p, pp) {
    pp = pp || {};
    return {
      id: p.id, username: p.username, first: p.first_name, last: pp.last_name || "", bio: p.bio || "",
      avatarUrl: p.avatar_url || null,
      memberSince: p.created_at, email: pp.email || "",
      sex: pp.sex || "", ageConfirmedAt: pp.age_confirmed_at || null,
      lat: PROVO.lat, lng: PROVO.lng, // distances are measured from central Provo; no home location is stored
    };
  }
  // Habits and check-ins are restored from the database.
  async function loadHabitData(stillCurrent) {
    const [h, c, m] = await Promise.all([
      sb.from("habits").select("id,title,goal_text,source_lesson_id,is_active,created_at,sort_order").order("sort_order"),
      sb.from("habit_checkins").select("habit_id,check_date"),
      sb.from("momentum_log").select("gained_on,reason").order("gained_on"),
    ]);
    if (m.error) console.error("Momentum log:", m.error.message);
    const err = h.error || c.error;
    if (err || !h.data || !c.data) { if (err) console.error(err); return false; }
    if (stillCurrent && !stillCurrent()) return true; // newer clicks are still saving; their refresh will follow
    state.habits = h.data.map((r) => ({ id: r.id, title: r.title, goalText: r.goal_text, lessonId: r.source_lesson_id, active: r.is_active, createdAt: r.created_at, sortOrder: r.sort_order }));
    state.checkins = c.data.map((r) => ({ habitId: r.habit_id, date: r.check_date }));
    if (!m.error && m.data) state.momentum = m.data.map((r) => ({ date: r.gained_on, reason: r.reason }));
    return true;
  }

  // Interests: the list comes from the `interests` table (admins edit it in Supabase → Table Editor).
  // Each user's picks live in `profile_interests` (migration 005).
  let interestCache = null;  // active interests: [{ id, name }] in admin-chosen order
  let myInterestIds = {};    // my picks: { name: interest_id }
  async function loadInterests() {
    const [list, mine] = await Promise.all([
      sb.from("interests").select("id,name").eq("is_active", true).order("name"), // alphabetical for the picker
      sb.from("profile_interests").select("interest_id, interest:interests(name)").eq("profile_id", ME),
    ]);
    if (list.error || !list.data) { console.error("Interests didn't load (has migration 005 been run?)", list.error); return false; }
    interestCache = list.data;
    if (!mine.error && mine.data) {
      myInterestIds = {};
      mine.data.forEach((r) => { if (r.interest) myInterestIds[r.interest.name] = r.interest_id; });
      state.profiles[ME].interests = Object.keys(myInterestIds);
    }
    return true;
  }
  // Names for the picker: active interests, plus any retired one you already picked (so it isn't lost).
  // Someone else's interests (readable by signed-in members since migration 012). Loaded once per profile.
  const interestsLoadedFor = {};
  function loadInterestsFor(id) {
    if (!id || id === ME || interestsLoadedFor[id]) return;
    interestsLoadedFor[id] = true;
    sb.from("profile_interests").select("interest:interests(name)").eq("profile_id", id).then(({ data, error }) => {
      if (error || !data) return;
      if (!state.profiles[id] && !remoteProfiles[id]) cacheRemoteProfile({ id });
      const p = state.profiles[id] || remoteProfiles[id];
      p.interests = data.map((r) => r.interest && r.interest.name).filter(Boolean).sort();
      emit();
    });
  }
  function interestOptions() {
    const active = (interestCache || []).map((i) => i.name);
    const mine = (state.profiles[ME].interests || []).filter((n) => !active.includes(n));
    return active.concat(mine);
  }

  let ready = null;
  function init() {
    if (ready) return ready;
    if (!configured) { // no keys in js/config.js
      loadError = "Momentum isn't connected to Supabase. Add the project URL and publishable key to js/config.js.";
      return (ready = Promise.resolve("syncerror"));
    }
    ready = (async () => {
      const { data } = await sb.auth.getSession();
      const session = data.session;
      if (!session) return false;
      let { data: p, error } = await sb.from("profiles").select("id,username,first_name,bio,avatar_url,created_at").eq("auth_user_id", session.user.id).maybeSingle();
      if (error) {
        const alt = await sb.from("profiles").select("id,username,first_name,bio,created_at").eq("auth_user_id", session.user.id).maybeSingle();
        if (!alt.error && alt.data) { p = alt.data; error = null; }
      }
      if (error || !p) { loadError = error ? error.message : "No profile found for this account."; return "noprofile"; }
      const { data: pp } = await sb.from("profile_private").select("*").eq("profile_id", p.id).maybeSingle();
      ME = p.id;
      KEY = "momentum.v1.user." + p.id; // this user's own browser data
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
      const me = profileFromRows(p, pp);
      state = restoreState(saved, { ...me, interests: [], attendeeDisplay: "first_name" });
      const old = { ...(state.profiles[ME] || {}) };
      ["phone", "address", "zip", "city", "state", "birthday"].forEach((k) => delete old[k]); // removed in migration 008: clear this browser's copy too
      state.profiles[ME] = { ...old, ...me, interests: old.interests || [], attendeeDisplay: state.settings.attendeeDisplay };
      if (state && state.settings) delete state.settings.messageRequestsFrom;
      if (!Array.isArray(state.blocks)) state.blocks = [];
      state.meId = ME; state.signedIn = true;
      const [habitsLoaded, lessonsLoaded] = await Promise.all([loadHabitData(), loadLessonData(), loadPosts(), loadInterests(), loadFriendships(), loadConversations(), loadBlocks(), loadCommitments()]);
      if (!habitsLoaded || !lessonsLoaded) { loadError = "We couldn't load your saved habits and lesson progress. Please reload to try again."; return "syncerror"; }
      persist();
      return true;
    })().catch(() => { loadError = "We couldn't reach your saved account data. Please reload to try again."; return "syncerror"; });
    return ready;
  }

  // =====================================================================
  // Accounts (Supabase Auth). Used by the sign-in / sign-up page.
  // Signup fields travel as "user metadata"; the database trigger from
  // migration 001 turns them into profiles + profile_private rows.
  // =====================================================================
  const siteBase = () => location.origin + location.pathname.replace(/[^/]*$/, ""); // where the email link lands
  const auth = {
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    signUp(email, password, profile) {
      return sb.auth.signUp({ email, password, options: { data: profile, emailRedirectTo: siteBase() } });
    },
    signIn(email, password) {
      return sb.auth.signInWithPassword({ email, password });
    },
    resendConfirmation(email) {
      return sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: siteBase() } });
    },
    async signOut() {
      let failed = false;
      try { failed = !!(await sb.auth.signOut()).error; } catch (e) { failed = true; }
      // Offline or server error: still sign out on this device by clearing the saved session.
      if (failed) { try { localStorage.removeItem(sb.auth.storageKey); } catch (e) { /* ignore */ } }
      try { Object.keys(localStorage).filter((k) => k.startsWith("momentum.shell.")).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    },
  };

  // Instant check, no network: is a login saved on this device, and whose?
  // null = can't tell (not connected, or no session storage): fall back to Store.init()'s check;
  // "" = nobody saved; otherwise the login's id. Store.init() still verifies the session with Supabase.
  function savedLogin() {
    if (!sb || !sb.auth || !sb.auth.storageKey) return null;
    try {
      const raw = localStorage.getItem(sb.auth.storageKey);
      if (!raw) return "";
      const s = JSON.parse(raw);
      return (s && s.user && s.user.id) || "saved";
    } catch (e) { return "saved"; }
  }

  window.Store = {
    get ME() { return ME; }, LESSON_COUNT, CANCELS_PER_MONTH, auth, init, savedLogin,
    get state() { return state; }, get loadError() { return loadError; },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    today, dayKey, addDays,
    // activities
    loadActivities, allActivities: () => actCache || [], loadTypes, types: () => typeCache || [], loadSuggestions, activitySuggestions, validateActivity, createActivity, activity, isPast, attendees, spotsTaken,
    myRsvp, myGuestInvite, isGoing, myCommitments, myCommitmentIds, hosting, conflictFor, commit, cancel, canCancel, hasStarted, canSeeAttendees, loadCommitments, CANCEL_HOURS,
    cancellationsLeft, plusOneInvites, respondPlusOne, checkIn, needsCheckIn, address: (id) => state.addresses[id] || null, loadAddress,
    report, saveReport,
    // people
    profile, fullName, isFriend, friends, friendshipWith, incomingRequests, sentRequests, acceptFriend, declineFriend,
    removeFriend, sendFriendRequest, cancelFriendRequest, loadFriendships, loadProfile, searchProfiles, sharedActivityId,
    // growth
    habits, archivedHabits, isHabitDone, toggleHabit, addHabit, removeHabit, archiveHabit: removeHabit, restoreHabit, editHabit, reorderHabits, isLessonDone, isLessonUnlocked, currentLesson,
    completeLesson, lessonGoal, lessonHabit, momentum, lastDays, stats, canStartLesson, LESSON_BLOCKED_MSG,
    canAddHabit, canArchiveHabit, deleteHabit, MAX_ACTIVE_HABITS, MAX_ARCHIVED_HABITS, MAX_ACTIVE_MSG, ARCHIVE_FULL_MSG,
    // social
    loadPosts, createPost, deletePost, setPostVisibility, encouraged, toggleEncourage, feed, historyFor,
    // messages
    loadConversations, conversations, conversation, findDirect, unread, unreadCount, unreadConversationsCount, incomingMessageRequests,
    isRequestToMe, isOutgoingPending, requestStatusFor, markRead, openDirect, sendDirectMessage, send, respondRequest,
    otherMember, memberStatus, shareActivityPeople,
    loadBlocks, blockUser, unblockUser, hasBlocked, isBlockedBy, isBlockedBetween, blockedUsers,
    // settings
    setSetting, updateProfile, uploadAvatar, deleteAvatar, interestOptions, loadInterestsFor,
  };
})();