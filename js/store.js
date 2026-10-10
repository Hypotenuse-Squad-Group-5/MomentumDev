/* =====================================================================
   Momentum: data layer ("Store")

   Every page reads and writes data ONLY through this file. That's what
   lets us move one feature at a time from the browser to Supabase:
     - Activities: Supabase when js/config.js has keys (THE VERTICAL SLICE),
                   otherwise this browser.
     - Everything else: this browser (localStorage), shaped like the
                   database tables in database/schema.sql so it can move next.

   Points ("the single tracking unit"), mirroring the point_events table:
     habit +10 · lesson +25 · rsvp +15 · attended +25 · first post of the day +5
     cancelled rsvp -15
   ===================================================================== */
(function () {
  const KEY = "momentum.v1";
  const POINTS = { habit: 10, lesson: 25, rsvp: 15, attended: 25, post: 5, rsvp_cancelled: -15 };
  const CANCELS_PER_MONTH = 2;
  const BUFFER_MIN = 30;

  // Fixed IDs that match the seed rows in database/schema.sql
  const P = {
    chase: "aaaaaaaa-0000-4000-8000-000000000001", mia: "aaaaaaaa-0000-4000-8000-000000000002",
    jake: "aaaaaaaa-0000-4000-8000-000000000003", taylor: "aaaaaaaa-0000-4000-8000-000000000004",
    alex: "aaaaaaaa-0000-4000-8000-000000000005", jordan: "aaaaaaaa-0000-4000-8000-000000000006",
    riley: "aaaaaaaa-0000-4000-8000-000000000007", sam: "aaaaaaaa-0000-4000-8000-000000000008",
  };
  const A = (n) => "bbbbbbbb-0000-4000-8000-0000000000" + String(n).padStart(2, "0");
  const ME = P.chase;

  // ---------- small helpers ----------
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
  const nowIso = () => new Date().toISOString();
  const dayKey = (d) => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const today = () => dayKey(new Date());
  const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
  function at(days, hhmm) { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); d.setDate(d.getDate() + days); return d.toISOString(); }
  function ago(days, hours = 0) { return new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString(); }

  // =====================================================================
  // SEED (demo content). Everything here is placeholder user content.
  // =====================================================================
  function seed() {
    const profiles = {};
    const addP = (key, first, last, city, lat, lng, bio, interests, extra = {}) =>
      (profiles[P[key]] = { id: P[key], username: key, first, last, city, lat, lng, bio: bio || "", interests: interests || [], attendeeDisplay: "first_name", ...extra });
    addP("chase", "Chase", "Example", "Provo, UT", 40.2338, -111.6585, "Student in Provo. Trying to swap scrolling for actually doing things.", ["Pickleball", "Reading", "Hiking"],
      { email: "chase@example.com", phone: "(555) 555-0123", address: "100 Example St", birthday: "2004-05-14", gender: "Man" });
    addP("mia", "Mia", "Thompson", "Provo, UT", 40.245, -111.662, "Board game collector, amateur puzzle champion, always hosting something.", ["Board games", "Puzzles", "Cooking"]);
    addP("jake", "Jake", "Rivera", "Provo, UT", 40.221, -111.644, "Trying to spend more weekends outside than on my couch.", ["Hiking", "Climbing", "Volleyball"]);
    addP("taylor", "Taylor", "Brooks", "Orem, UT", 40.2969, -111.6946, "Climber. Will teach you to fall safely.", ["Climbing"]);
    addP("alex", "Alex", "Park", "Provo, UT", 40.228, -111.673);
    addP("jordan", "Jordan", "Kim", "Provo, UT", 40.251, -111.649);
    addP("riley", "Riley", "Shaw", "Springville, UT", 40.1652, -111.6107, "", [], { attendeeDisplay: "hidden" });
    addP("sam", "Sam", "Lee", "Provo, UT", 40.239, -111.669);

    const act = (n, host, type, title, name, desc, bring, days, from, to, loc, city, lat, lng, min, max, createdDaysAgo) => ({
      id: A(n), hostId: P[host], type, title, activityName: name, description: desc, bring,
      startsAt: at(days, from), endsAt: at(days, to), location: loc, city, lat, lng, min, max,
      visibility: "public", createdAt: ago(createdDaysAgo),
    });
    const activities = [
      act(1, "mia", "Indoors · Relaxed", "Board Game Night", "board games", "Codenames, Ticket to Ride, and whatever you bring. Snacks provided, competitiveness optional.", "A snack to share", 2, "19:00", "21:30", "Downtown Provo", "Provo", 40.235, -111.659, 4, 12, 3),
      act(2, "alex", "Outdoors · Relaxed", "Sunset picnic at Kiwanis Park", "picnic", "Blankets, sandwiches, and watching the sun go down over the lake. Come hungry.", "Something to sit on", 1, "18:30", "20:00", "Kiwanis Park, Provo", "Provo", 40.248, -111.643, 3, 10, 2),
      act(3, "jordan", "Outdoors · Active", "Pickup volleyball", "volleyball", "Sand courts, rotating teams, all skill levels. We keep score loosely.", "", 7, "20:00", "22:00", "Provo sand courts", "Provo", 40.256, -111.65, 6, 20, 4),
      act(4, "taylor", "Indoors · Active", "Beginner rock climbing", "rock climbing", "Never climbed before? Good, neither have most of us. We'll rent shoes, learn the basics from the front desk, and spend a couple hours on the easy walls.", "About $15 for a day pass", 5, "19:00", "21:00", "Climbing gym, Orem", "Orem", 40.297, -111.695, 4, 8, 6),
      act(5, "jake", "Outdoors · Active", "Bridal Veil Falls hike", "hiking", "Easy to moderate hike, then breakfast burritos after. Beginners welcome. We go at the slowest person's pace.", "Water, good shoes, a jacket", 9, "09:00", "12:00", "Provo Canyon", "Provo Canyon", 40.335, -111.601, 3, 15, 5),
      act(6, "riley", "Indoors · Relaxed", "Journaling & hot cocoa", "journaling", "Quiet hour of writing with a few prompts if you want them, then cocoa and conversation.", "A notebook", 4, "19:00", "20:30", "Springville library area", "Springville", 40.165, -111.611, 3, 8, 3),
      act(7, "sam", "Learning & creative", "Coffee & sketching", "sketching", "Bring a notebook or borrow supplies. No talent required, just show up and draw what's in front of you.", "", 6, "11:00", "12:30", "Cafe near Center Street", "Provo", 40.234, -111.661, 3, 6, 1),
      act(8, "jordan", "Food & social", "Late-night ice cream run", "ice cream", "Quick ice cream run after the evening winds down. In and out in 45 minutes.", "", 2, "21:45", "22:30", "University Ave, Provo", "Provo", 40.242, -111.658, 3, 10, 1),
      act(9, "mia", "Food & social", "Potluck & card games", "potluck", "Bring a dish, stay for cards.", "A dish to share", -5, "18:00", "21:00", "North Provo", "Provo", 40.258, -111.66, 3, 15, 10),
      act(10, "chase", "Outdoors · Active", "Pickleball in the park", "pickleball", "Casual doubles. Extra paddles available.", "Paddle if you have one", -12, "10:00", "12:00", "Provo city park", "Provo", 40.23, -111.652, 4, 8, 16),
    ];
    const addresses = {};
    activities.forEach((a) => (addresses[a.id] = "123 Example St, " + a.city + ", UT"));

    const r = (n, who, extra = {}) => ({ id: uid(), activityId: A(n), profileId: P[who], status: "committed", createdAt: ago(2), cancelledAt: null, attended: null, ...extra });
    const rsvps = [
      r(1, "chase"), r(5, "chase"), r(9, "chase", { attended: true, createdAt: ago(8) }), r(10, "chase", { createdAt: ago(16) }),
      r(1, "jake"), r(1, "sam"), r(1, "riley"), r(4, "alex"), r(5, "mia"), r(2, "sam"), r(3, "jake"), r(3, "mia"), r(9, "jake"), r(9, "sam"),
    ];
    const rsvpOf = (n, who) => rsvps.find((x) => x.activityId === A(n) && x.profileId === P[who]).id;
    const guests = [
      { id: uid(), rsvpId: rsvpOf(1, "jake"), guestProfileId: null, guestFirstName: "Alex", status: "accepted", createdAt: ago(2) },
      // An incoming +1 invite for Chase (shows the "accept a +1" side)
      { id: uid(), rsvpId: rsvpOf(3, "jake"), guestProfileId: ME, guestFirstName: null, status: "pending", createdAt: ago(0, 5) },
    ];

    const friendships = [
      { id: uid(), requesterId: ME, addresseeId: P.mia, status: "accepted", metAt: A(9), since: ago(40) },
      { id: uid(), requesterId: P.jake, addresseeId: ME, status: "accepted", metAt: A(10), since: ago(12) },
      { id: uid(), requesterId: P.sam, addresseeId: ME, status: "pending", metAt: null, since: ago(1) },
    ];

    const posts = [
      { id: uid(), authorId: P.mia, caption: "Hosting game night this weekend and there are still spots. Bring a snack, leave your phone in your pocket.", photos: 1, activityId: A(1), visibility: "friends", createdAt: ago(0, 3) },
      { id: uid(), authorId: P.mia, caption: "Finished the 1,000-piece puzzle from game night. Three weeks, zero screens. Weirdly proud of this one.", photos: 1, activityId: null, visibility: "friends", createdAt: ago(1) },
      { id: uid(), authorId: ME, caption: "One week of charging my phone in the kitchen overnight. Sleeping better, and I finished my first book in months.", photos: 2, activityId: null, visibility: "friends", createdAt: ago(2) },
      { id: uid(), authorId: P.jake, caption: "First time bouldering outdoors. Fell off the same route about fifteen times. Would fall again.", photos: 3, activityId: null, visibility: "friends", createdAt: ago(4) },
    ];
    const reports = [
      { id: uid(), activityId: A(9), authorId: P.mia, body: "Twelve people showed up, double what I expected. Someone's homemade salsa started a full debate. Doing this again next month.", createdAt: ago(4) },
    ];

    const msg = (who, body, hoursAgo) => ({ id: uid(), senderId: who, body, at: ago(0, hoursAgo) });
    const conversations = [
      { id: uid(), kind: "direct", activityId: A(1), members: [{ id: ME, status: "active" }, { id: P.mia, status: "active" }], lastRead: { [ME]: ago(1) },
        messages: [msg(P.mia, "Hey! Glad you're coming to game night", 26), msg(ME, "Wouldn't miss it", 25), msg(P.mia, "Are you bringing Codenames?", 2)] },
      { id: uid(), kind: "activity_group", activityId: A(1), members: [ME, P.mia, P.jake, P.sam, P.riley].map((id) => ({ id, status: "active" })), lastRead: { [ME]: ago(1) },
        messages: [msg(P.jake, "Parking is on the north side", 9), msg(P.mia, "I'll have chips and salsa", 5)] },
      { id: uid(), kind: "direct", activityId: null, members: [{ id: ME, status: "active" }, { id: P.jake, status: "active" }], lastRead: { [ME]: nowIso() },
        messages: [msg(P.jake, "You in for the hike?", 70), msg(ME, "See you at the trailhead", 69)] },
      { id: uid(), kind: "direct", activityId: null, members: [{ id: P.sam, status: "active" }, { id: ME, status: "requested" }], lastRead: {},
        messages: [msg(P.sam, "Hey, I think we were both at the potluck. Want to grab a spot at sketching on Thursday?", 20)] },
    ];

    const habits = [
      { id: "cccccccc-0000-4000-8000-000000000001", title: "Phone charges across the room by 10:30 PM", goalText: null, lessonNumber: null, active: true, createdAt: ago(20) },
      { id: "cccccccc-0000-4000-8000-000000000002", title: "No phone for the first 30 minutes after waking up", goalText: null, lessonNumber: null, active: true, createdAt: ago(20) },
    ];
    const checkins = [];
    const points = [];
    for (let i = 1; i <= 6; i++) { const d = addDays(today(), -i); checkins.push({ habitId: habits[0].id, date: d }); points.push({ id: uid(), kind: "habit", points: POINTS.habit, ref: habits[0].id, date: d, at: ago(i) }); }
    for (let i = 1; i <= 3; i++) { const d = addDays(today(), -i); checkins.push({ habitId: habits[1].id, date: d }); points.push({ id: uid(), kind: "habit", points: POINTS.habit, ref: habits[1].id, date: d, at: ago(i) }); }
    rsvps.filter((x) => x.profileId === ME).forEach((x) => points.push({ id: uid(), kind: "rsvp", points: POINTS.rsvp, ref: x.id, date: dayKey(x.createdAt), at: x.createdAt }));
    points.push({ id: uid(), kind: "attended", points: POINTS.attended, ref: rsvpOf(9, "chase"), date: addDays(today(), -4), at: ago(4) });
    points.push({ id: uid(), kind: "post", points: POINTS.post, ref: posts[2].id, date: addDays(today(), -2), at: ago(2) });

    return {
      version: 1, seededAt: nowIso(), meId: ME, signedIn: false,
      profiles, friendships, activityTypes: ["Outdoors · Relaxed", "Outdoors · Active", "Indoors · Relaxed", "Indoors · Active", "Food & social", "Learning & creative"],
      activities, addresses, rsvps, guests, reports, posts, encouragements: [], conversations,
      lessonsDone: [], habits, checkins, points,
      settings: {
        postVisibility: "friends", activityVisibility: "public", friendsListVisibility: "friends",
        attendeeDisplay: "first_name", messageRequestsFrom: "anyone",
        notifyActivity: true, notifyHabits: true, notifyFriends: true, notifyMessages: true,
        remindersByEmail: false, checkinTime: "21:30", pauseBeforeOpen: false, weeklySummary: true,
      },
    };
  }

  // =====================================================================
  // State, persistence, live updates
  // =====================================================================
  let state;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
    if (!state || state.version !== 1) { state = seed(); persist(); }
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } }
  const listeners = new Set();
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  function save() { persist(); emit(); }
  // Another tab changed something: reload and re-render (keeps every open page in sync)
  window.addEventListener("storage", (e) => { if (e.key === KEY) { load(); emit(); } });
  load();

  // =====================================================================
  // Supabase (the vertical slice: activities only, for now)
  // =====================================================================
  const cfg = window.MOMENTUM_CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  let actCache = null, typeCache = null, loadError = null;

  function fromRow(row) {
    return {
      id: row.id, hostId: row.host_id, hostName: row.host ? row.host.first_name : null,
      type: row.type ? row.type.name : "", title: row.title, activityName: row.activity_name,
      description: row.description, bring: row.what_to_bring || "", startsAt: row.starts_at, endsAt: row.ends_at,
      location: row.general_location, city: row.city, lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null, min: row.min_participants, max: row.max_participants,
      visibility: row.visibility, createdAt: row.created_at, source: "supabase",
    };
  }

  async function loadActivities(force) {
    if (actCache && !force) return actCache;
    loadError = null;
    if (live) {
      const { data, error } = await sb.from("activities")
        .select("*, host:profiles!activities_host_id_fkey(first_name,last_name), type:activity_types(name)")
        .order("starts_at");
      if (error) { loadError = error.message; console.error(error); actCache = []; }
      else actCache = data.map(fromRow);
    } else {
      actCache = state.activities.map((a) => ({ ...a, source: "local" }));
    }
    return actCache;
  }

  async function loadTypes() {
    if (typeCache) return typeCache;
    if (live) {
      const { data, error } = await sb.from("activity_types").select("id,name").order("id");
      typeCache = error ? [] : data;
    } else typeCache = state.activityTypes.map((name, i) => ({ id: i + 1, name }));
    return typeCache;
  }

  // Server-side rules the DB also enforces, checked here first for friendly messages.
  function validateActivity(f) {
    const errs = {};
    const req = ["title", "typeId", "activityName", "date", "start", "end", "location", "city", "address", "min", "max", "description"];
    req.forEach((k) => { if (!String(f[k] ?? "").trim()) errs[k] = "Required."; });
    if (f.title && f.title.length > 60) errs.title = "Keep it under 60 characters.";
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
    if (live) {
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
    } else {
      id = uid();
      state.activities.push({
        id, hostId: ME, type: typeName, title: f.title.trim(), activityName: f.activityName.trim(), description: f.description.trim(),
        bring: f.bring.trim(), startsAt: starts, endsAt: ends, location: f.location.trim(), city: f.city.trim(),
        lat: me.lat + (Math.random() - 0.5) * 0.01, lng: me.lng + (Math.random() - 0.5) * 0.01,
        min: Number(f.min), max: Number(f.max), visibility: f.visibility, createdAt: nowIso(),
      });
    }
    state.addresses[id] = f.address.trim(); // host can always see their own address
    actCache = null;
    save();
    return { ok: true, id };
  }

  // =====================================================================
  // People + friends
  // =====================================================================
  function profile(id) { return state.profiles[id] || { id, first: "Someone", last: "", city: "" }; }
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
  function acceptFriend(fid) { const f = state.friendships.find((x) => x.id === fid); if (!f) return; f.status = "accepted"; f.since = nowIso(); f.metAt = f.metAt || sharedActivityId(f.requesterId); save(); }
  function declineFriend(fid) { state.friendships = state.friendships.filter((x) => x.id !== fid); save(); }
  function removeFriend(id) { const f = friendshipWith(id); if (f) { state.friendships = state.friendships.filter((x) => x !== f); save(); } }
  function sendFriendRequest(id) { if (friendshipWith(id)) return; state.friendships.push({ id: uid(), requesterId: ME, addresseeId: id, status: "pending", metAt: sharedActivityId(id), since: nowIso() }); save(); }

  // =====================================================================
  // Activities: RSVPs, +1s, cancellations, check-ins
  // =====================================================================
  const activity = (id) => (actCache || []).find((a) => a.id === id) || null;
  const isPast = (a) => new Date(a.endsAt) < new Date();
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
  function hosting() { return (actCache || []).filter((a) => a.hostId === ME); }

  // Who's going: committed people + their +1s (pending friend invites don't hold a spot)
  function attendees(activityId) {
    const list = [];
    state.rsvps.filter((r) => r.activityId === activityId && r.status === "committed").forEach((r) => {
      list.push({ kind: "member", profileId: r.profileId });
      const g = state.guests.find((x) => x.rsvpId === r.id);
      if (g && g.status === "accepted") list.push(g.guestProfileId ? { kind: "member", profileId: g.guestProfileId, plusOneOf: r.profileId } : { kind: "guest", name: g.guestFirstName, plusOneOf: r.profileId });
    });
    return list;
  }
  function spotsTaken(activityId) { return attendees(activityId).length + 1; } // +1 = host
  function cancellationsUsed() {
    const now = new Date();
    return state.rsvps.filter((r) => r.profileId === ME && r.status === "cancelled" && r.cancelledAt &&
      new Date(r.cancelledAt).getMonth() === now.getMonth() && new Date(r.cancelledAt).getFullYear() === now.getFullYear()).length;
  }
  function cancellationsLeft() { return Math.max(0, CANCELS_PER_MONTH - cancellationsUsed()); }
  function canCancel(activityId) {
    const a = activity(activityId); const r = myRsvp(activityId);
    if (!a || !r || r.status !== "committed") return { ok: false, reason: "You're not committed to this activity." };
    if (new Date(a.startsAt) - new Date() < 24 * 36e5) return { ok: false, reason: "Commitments can't be cancelled within 24 hours of the start." };
    if (cancellationsLeft() === 0) return { ok: false, reason: "You've used both cancellations for this month." };
    return { ok: true };
  }
  // PL-14: no overlap and no starting within 30 minutes of another commitment
  function conflictFor(a) {
    const buf = BUFFER_MIN * 6e4;
    const s = new Date(a.startsAt).getTime(), e = new Date(a.endsAt).getTime();
    return myCommitments().find((o) => o.id !== a.id && s < new Date(o.endsAt).getTime() + buf && e > new Date(o.startsAt).getTime() - buf) || null;
  }

  function addPoints(kind, ref) { const p = { id: uid(), kind, points: POINTS[kind], ref, date: today(), at: nowIso() }; state.points.push(p); return p.points; }

  function commit(activityId, plusOne) {
    const a = activity(activityId);
    if (!a) return { ok: false, message: "That activity couldn't be found." };
    if (!state.signedIn) return { ok: false, code: "login", message: "Sign in to commit to an activity." };
    if (isPast(a)) return { ok: false, message: "This activity has already happened." };
    if (a.hostId === ME) return { ok: false, message: "You're hosting this one." };
    if (isGoing(activityId)) return { ok: false, message: "You're already committed." };
    const conflict = conflictFor(a);
    if (conflict) return { ok: false, code: "conflict", conflict, message: "This overlaps or starts within 30 minutes of " + conflict.title + "." };
    const need = 1 + (plusOne && plusOne.type === "guest" ? 1 : 0);
    if (spotsTaken(activityId) + need > a.max) return { ok: false, message: need > 1 ? "There's only room for one more person, so you can't bring a guest." : "This activity is full." };

    let r = myRsvp(activityId);
    if (r) { r.status = "committed"; r.createdAt = nowIso(); } else { r = { id: uid(), activityId, profileId: ME, status: "committed", createdAt: nowIso(), cancelledAt: null, attended: null }; state.rsvps.push(r); }
    state.guests = state.guests.filter((g) => g.rsvpId !== r.id);
    if (plusOne && plusOne.type === "friend") state.guests.push({ id: uid(), rsvpId: r.id, guestProfileId: plusOne.profileId, guestFirstName: null, status: "pending", createdAt: nowIso() });
    if (plusOne && plusOne.type === "guest") state.guests.push({ id: uid(), rsvpId: r.id, guestProfileId: null, guestFirstName: plusOne.name.trim(), status: "accepted", createdAt: nowIso() });
    const pts = addPoints("rsvp", r.id);
    save();
    return { ok: true, points: pts };
  }

  function cancel(activityId) {
    const c = canCancel(activityId); if (!c.ok) return { ok: false, message: c.reason };
    const r = myRsvp(activityId);
    r.status = "cancelled"; r.cancelledAt = nowIso();
    state.guests = state.guests.filter((g) => g.rsvpId !== r.id);
    const pts = addPoints("rsvp_cancelled", r.id);
    save();
    return { ok: true, points: pts, left: cancellationsLeft() };
  }

  // Incoming +1 invites (a friend asked me along)
  function plusOneInvites() {
    return state.guests.filter((g) => g.guestProfileId === ME && g.status === "pending").map((g) => {
      const r = state.rsvps.find((x) => x.id === g.rsvpId); return { guest: g, rsvp: r, activity: r && activity(r.activityId) };
    }).filter((x) => x.activity && !isPast(x.activity));
  }
  function respondPlusOne(guestId, accept) {
    const g = state.guests.find((x) => x.id === guestId); if (!g) return { ok: false };
    if (!accept) { g.status = "declined"; save(); return { ok: true }; }
    const r = state.rsvps.find((x) => x.id === g.rsvpId); const a = activity(r.activityId);
    const conflict = conflictFor(a);
    if (conflict) return { ok: false, message: "This overlaps or starts within 30 minutes of " + conflict.title + "." };
    if (spotsTaken(a.id) + 1 > a.max) { g.status = "expired"; save(); return { ok: false, message: "The activity filled up before you accepted. Committed people get priority." }; }
    g.status = "accepted";
    const pts = addPoints("rsvp", g.id);
    save();
    return { ok: true, points: pts };
  }

  function checkIn(activityId, attended) {
    const r = myRsvp(activityId); if (!r || r.attended !== null) return { ok: false };
    r.attended = !!attended;
    const pts = attended ? addPoints("attended", r.id) : 0;
    save();
    return { ok: true, points: pts };
  }
  function needsCheckIn() { return myCommitments().filter((a) => isPast(a) && myRsvp(a.id) && myRsvp(a.id).attended === null); }

  function report(activityId, authorId) { return state.reports.find((r) => r.activityId === activityId && r.authorId === authorId) || null; }
  function saveReport(activityId, body) {
    let r = report(activityId, ME);
    if (r) r.body = body; else state.reports.push({ id: uid(), activityId, authorId: ME, body, createdAt: nowIso() });
    save();
  }

  // =====================================================================
  // Habits, lessons, streaks, points
  // =====================================================================
  const habits = () => state.habits.filter((h) => h.active);
  const isHabitDone = (habitId, d = today()) => state.checkins.some((c) => c.habitId === habitId && c.date === d);
  function toggleHabit(habitId) {
    const d = today();
    if (isHabitDone(habitId, d)) {
      state.checkins = state.checkins.filter((c) => !(c.habitId === habitId && c.date === d));
      state.points = state.points.filter((p) => !(p.kind === "habit" && p.ref === habitId && p.date === d));
      save(); return { done: false, points: -POINTS.habit };
    }
    const streakBefore = streak().current;
    state.checkins.push({ habitId, date: d });
    const pts = addPoints("habit", habitId);
    save();
    return { done: true, points: pts, streakUp: streak().current > streakBefore };
  }
  function addHabit(title, extra = {}) {
    const h = { id: uid(), title: title.trim(), goalText: null, lessonNumber: null, active: true, createdAt: nowIso(), ...extra };
    state.habits.push(h); save(); return h;
  }
  function removeHabit(habitId) { const h = state.habits.find((x) => x.id === habitId); if (h) { h.active = false; save(); } }

  const LESSON_COUNT = 5;
  const isLessonDone = (n) => state.lessonsDone.some((l) => l.n === n);
  const isLessonUnlocked = (n) => n === 1 || isLessonDone(n - 1);
  function currentLesson() { for (let n = 1; n <= LESSON_COUNT; n++) if (!isLessonDone(n)) return n; return null; }
  function completeLesson(n, goalText, habitTitle) {
    if (!isLessonUnlocked(n)) return { ok: false, message: "Finish the previous lesson first." };
    if (isLessonDone(n)) return { ok: false, message: "You've already finished this lesson." };
    const words = goalText.trim().split(/\s+/).filter(Boolean).length;
    if (words < 30) return { ok: false, message: "Write at least 30 words to finish this lesson." };
    if (!habitTitle.trim()) return { ok: false, message: "Give your daily habit a short name." };
    state.lessonsDone.push({ n, at: nowIso(), goal: goalText.trim() });
    state.habits.push({ id: uid(), title: habitTitle.trim(), goalText: goalText.trim(), lessonNumber: n, active: true, createdAt: nowIso() });
    const pts = addPoints("lesson", "lesson-" + n);
    save();
    return { ok: true, points: pts };
  }
  function lessonGoal(n) { const l = state.lessonsDone.find((x) => x.n === n); return l ? l.goal : null; }

  // Streak = consecutive days with at least one habit checked. Today counts once done;
  // until then, the streak is still "alive" from yesterday.
  function streak() {
    const days = new Set(state.checkins.map((c) => c.date));
    let cur = 0, d = today();
    if (!days.has(d)) d = addDays(d, -1);
    while (days.has(d)) { cur++; d = addDays(d, -1); }
    const sorted = [...days].sort(); let best = 0, run = 0, prev = null;
    sorted.forEach((k) => { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
    return { current: cur, longest: Math.max(best, cur), doneToday: days.has(today()) };
  }
  function lastDays(n) {
    const out = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(today(), -i); out.push({ date: d, count: state.checkins.filter((c) => c.date === d).length }); } return out;
  }
  function stats() {
    const s = streak();
    const total = state.points.reduce((t, p) => t + p.points, 0);
    const weekStart = addDays(today(), -6);
    const week = state.points.filter((p) => p.date >= weekStart).reduce((t, p) => t + p.points, 0);
    const byKind = {}; state.points.forEach((p) => { byKind[p.kind] = byKind[p.kind] || { count: 0, points: 0 }; byKind[p.kind].count++; byKind[p.kind].points += p.points; });
    const countsByDay = {}; state.checkins.forEach((c) => (countsByDay[c.date] = (countsByDay[c.date] || 0) + 1));
    const goalsMetDays = Object.values(countsByDay).filter((n) => n >= Math.max(1, habits().length)).length;
    return {
      streak: s.current, longest: s.longest, doneToday: s.doneToday, points: total, weekPoints: week, byKind,
      habitsChecked: state.checkins.length, goalsMetDays, lessonsDone: state.lessonsDone.length,
      attended: state.rsvps.filter((r) => r.profileId === ME && r.attended === true).length,
      upcoming: myCommitments().filter((a) => !isPast(a)).length,
      posts: state.posts.filter((p) => p.authorId === ME).length,
    };
  }
  function pointHistory(limit = 12) { return [...state.points].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit); }

  // =====================================================================
  // Posts + feed
  // =====================================================================
  function createPost({ caption, photos, activityId, visibility }) {
    if (!photos || photos < 1) return { ok: false, message: "Add at least one photo." };
    if (photos > 5) return { ok: false, message: "Posts can have up to 5 photos." };
    if (!caption.trim()) return { ok: false, message: "Add a caption." };
    if (caption.length > 500) return { ok: false, message: "Captions can be up to 500 characters." };
    const p = { id: uid(), authorId: ME, caption: caption.trim(), photos, activityId: activityId || null, visibility, createdAt: nowIso() };
    state.posts.push(p);
    const firstToday = !state.points.some((x) => x.kind === "post" && x.date === today());
    const pts = firstToday ? addPoints("post", p.id) : 0;
    save();
    return { ok: true, points: pts };
  }
  function setPostVisibility(id, v) { const p = state.posts.find((x) => x.id === id); if (p) { p.visibility = v; save(); } }
  function encouraged(postId) { return state.encouragements.some((e) => e.postId === postId && e.profileId === ME); }
  function toggleEncourage(postId) {
    if (encouraged(postId)) state.encouragements = state.encouragements.filter((e) => !(e.postId === postId && e.profileId === ME));
    else state.encouragements.push({ postId, profileId: ME, at: nowIso() });
    save();
  }
  // 10 most recent posts + activities from friends. No reshuffle, newest first.
  function feed() {
    const fr = new Set(friends().map((f) => f.id));
    const items = [];
    state.posts.filter((p) => fr.has(p.authorId)).forEach((p) => items.push({ kind: "post", at: p.createdAt, post: p }));
    (actCache || []).filter((a) => fr.has(a.hostId) && a.visibility !== "private").forEach((a) => items.push({ kind: "activity", at: a.createdAt, activity: a }));
    return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
  }
  function historyFor(profileId) {
    const items = state.posts.filter((p) => p.authorId === profileId).map((p) => ({ kind: "post", at: p.createdAt, post: p }));
    const going = profileId === ME ? new Set(myCommitmentIds()) : new Set(state.rsvps.filter((r) => r.profileId === profileId && r.status === "committed").map((r) => r.activityId));
    (actCache || []).filter((a) => a.hostId === profileId || going.has(a.id)).forEach((a) => items.push({ kind: "activity", at: a.startsAt, activity: a, hosting: a.hostId === profileId }));
    return items.sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  // =====================================================================
  // Messages (SN-4)
  // =====================================================================
  const memberStatus = (c, id) => (c.members.find((m) => m.id === id) || {}).status;
  function conversations() {
    return state.conversations.filter((c) => c.members.some((m) => m.id === ME) && memberStatus(c, ME) !== "declined")
      .sort((a, b) => new Date(last(b).at || 0) - new Date(last(a).at || 0));
  }
  const last = (c) => c.messages[c.messages.length - 1] || {};
  const isRequestToMe = (c) => memberStatus(c, ME) === "requested";
  function unread(c) { const l = last(c); return !!l.at && l.senderId !== ME && (!c.lastRead[ME] || new Date(l.at) > new Date(c.lastRead[ME])); }
  function unreadCount() { return conversations().filter((c) => unread(c) || isRequestToMe(c)).length; }
  function conversation(id) { return state.conversations.find((c) => c.id === id) || null; }
  function markRead(id) { const c = conversation(id); if (c && unread(c)) { c.lastRead[ME] = nowIso(); save(); } }
  // Direct chat. Started from an activity ("Message host")? It skips the request step.
  function openDirect(otherId, activityId) {
    let c = state.conversations.find((x) => x.kind === "direct" && x.members.length === 2 && x.members.some((m) => m.id === ME) && x.members.some((m) => m.id === otherId));
    if (c) { if (activityId) c.activityId = activityId; save(); return c; }
    const needsRequest = !isFriend(otherId) && !activityId;
    c = { id: uid(), kind: "direct", activityId: activityId || null, members: [{ id: ME, status: "active" }, { id: otherId, status: needsRequest ? "requested" : "active" }], lastRead: { [ME]: nowIso() }, messages: [] };
    state.conversations.push(c); save(); return c;
  }
  function send(convoId, body) {
    const c = conversation(convoId); if (!c || !body.trim()) return;
    c.messages.push({ id: uid(), senderId: ME, body: body.trim(), at: nowIso() }); c.lastRead[ME] = nowIso(); save();
  }
  function respondRequest(convoId, accept) { const c = conversation(convoId); const m = c && c.members.find((x) => x.id === ME); if (m) { m.status = accept ? "active" : "declined"; c.lastRead[ME] = nowIso(); save(); } }
  function otherMember(c) { return (c.members.find((m) => m.id !== ME) || {}).id; }
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
  function updateProfile(fields) { Object.assign(state.profiles[ME], fields); save(); }
  function signIn() { state.signedIn = true; save(); }
  function signOut() { state.signedIn = false; save(); }
  function reset() { state = seed(); actCache = null; persist(); emit(); }

  window.Store = {
    ME, POINTS, LESSON_COUNT, CANCELS_PER_MONTH,
    get state() { return state; }, get live() { return live; }, get loadError() { return loadError; },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    today, dayKey, addDays,
    // activities
    loadActivities, allActivities: () => actCache || [], loadTypes, validateActivity, createActivity, activity, isPast, attendees, spotsTaken,
    myRsvp, myGuestInvite, isGoing, myCommitments, myCommitmentIds, hosting, conflictFor, commit, cancel, canCancel,
    cancellationsLeft, plusOneInvites, respondPlusOne, checkIn, needsCheckIn, address: (id) => state.addresses[id] || null,
    report, saveReport,
    // people
    profile, fullName, isFriend, friends, friendshipWith, incomingRequests, sentRequests, acceptFriend, declineFriend,
    removeFriend, sendFriendRequest, sharedActivityId,
    // growth
    habits, isHabitDone, toggleHabit, addHabit, removeHabit, isLessonDone, isLessonUnlocked, currentLesson,
    completeLesson, lessonGoal, streak, lastDays, stats, pointHistory,
    // social
    createPost, setPostVisibility, encouraged, toggleEncourage, feed, historyFor,
    // messages
    conversations, conversation, unread, unreadCount, isRequestToMe, markRead, openDirect, send, respondRequest,
    otherMember, memberStatus, shareActivityPeople,
    // settings
    setSetting, updateProfile, signIn, signOut, reset,
  };
})();
