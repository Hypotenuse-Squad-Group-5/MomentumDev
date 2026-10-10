/* =====================================================================
   Lesson content. Edit text here.
   Lesson 1 is written out; 2 comes from the Momentum prototype; 3-5 are drafts.
   Stats marked "placeholder" need a real source before launch.
   ===================================================================== */
window.LESSONS = [
  {
    n: 1, title: "How your phone is engineered to hook you", minutes: 6,
    stats: [["96", "times a day a typical person checks their phone (placeholder: cite a source)"], ["4.8h", "average daily screen time (placeholder: cite a source)"], ["23m", "to fully refocus after an interruption (placeholder: cite a source)"]],
    html: `
      <p>Most social apps are free because your attention is what they sell. They earn money from ads, and more time in the app means more ads seen. That gives whole teams of designers one clear target: get you to open the app more often and stay longer.</p>
      <p>Getting pulled in doesn't mean you're weak. It means you're up against a system built to win. The good news is that once you can see the hooks, they get a lot easier to step around.</p>
      <div class="panel chart"><p class="label">Where a typical day of phone time goes (placeholder numbers)</p>
        <div class="bar-row"><span>Social media</span><div class="bar-track"><div class="bar" style="width:100%"></div></div><span>2h 20m</span></div>
        <div class="bar-row"><span>Video</span><div class="bar-track"><div class="bar" style="width:72%"></div></div><span>1h 40m</span></div>
        <div class="bar-row"><span>Messaging</span><div class="bar-track"><div class="bar" style="width:32%"></div></div><span>45m</span></div>
        <div class="bar-row"><span>Games</span><div class="bar-track"><div class="bar" style="width:21%"></div></div><span>30m</span></div>
        <div class="bar-row"><span>Everything else</span><div class="bar-track"><div class="bar" style="width:29%"></div></div><span>40m</span></div>
      </div>
      <h2>Hook 1: Unpredictable rewards</h2>
      <p>When you pull down to refresh, you don't know what you'll get. Maybe a new like, maybe a funny post, maybe nothing. That uncertainty is the point. Behavioral research going back to B.F. Skinner found that rewards on an unpredictable schedule produce the most persistent checking, more than rewards that arrive reliably. Your brain's dopamine system reacts strongly to the <i>chance</i> of a reward, which is why the urge to check can feel bigger than the payoff of actually checking.</p>
      <div class="panel chart"><p class="label">How long people keep checking after rewards stop (concept illustration)</p>
        <div class="bar-row"><span>Predictable</span><div class="bar-track"><div class="bar alt" style="width:30%"></div></div><span>Shorter</span></div>
        <div class="bar-row"><span>Unpredictable</span><div class="bar-track"><div class="bar" style="width:85%"></div></div><span>Longer</span></div>
      </div>
      <h2>Hook 2: No stopping points</h2>
      <p>A book has chapters. A TV episode ends. Those natural breaks give you a moment to ask, "Do I actually want to keep going?" Infinite scroll and autoplay remove those moments. Aza Raskin, the designer credited with inventing infinite scroll, has said publicly that he regrets how it gets used.</p>
      <h2>Hook 3: Social approval you can count</h2>
      <p>People are wired to care what the group thinks of them. Likes, views, and follower counts turn that into a number you can check over and over. Red notification badges are designed to feel unfinished until you clear them.</p>
      <h2>Hook 4: Triggers that move inside you</h2>
      <p>Many apps follow a loop that author Nir Eyal calls the Hook Model:</p>
      <div class="loop"><div><b>1. Trigger</b>A buzz, a badge, or a feeling like boredom</div><div><b>2. Action</b>You open the app</div><div><b>3. Unpredictable reward</b>Sometimes something good, sometimes not</div><div><b>4. Investment</b>You post, like, or follow, giving you reasons to come back</div></div>
      <p class="mt">At first the trigger comes from outside: a notification. Over time it moves inside. Boredom, loneliness, or a stressful moment become the cue, and the app becomes the automatic answer to a feeling.</p>
      <div class="callout"><b>What this means for you</b><br>Willpower alone is a weak defense against a product built by full-time teams. Changing your setup works better: fewer notifications, more stopping points, and something better to do with the time. That last part is what the rest of Momentum is for.</div>`,
    prompt: "Which hook gets you most? When does it usually happen, and what's one specific change you'll make this week to interrupt it?",
    placeholder: "Pull-to-refresh gets me most, usually right after class while I'm walking. This week I'll move social apps off my home screen and...",
    habitPlaceholder: "e.g. Social apps off my home screen",
  },
  {
    n: 2, title: "Notice your attention cues", minutes: 6,
    stats: [["3s", "from cue to reaching for your phone (placeholder: cite a source)"], ["70%", "of checks happen automatically (placeholder: cite a source)"], ["1", "cue to watch this week"]],
    html: `<p>Most phone checks aren't decisions. They're reactions. A buzz, a moment of boredom, or a lull in conversation acts as a cue, and your hand moves before your mind has weighed in.</p>
      <p>This week, your only job is to notice. Each time you catch a cue (a notification, a quiet moment, a feeling of restlessness), name it in your head. Awareness weakens the loop before you change a single habit.</p>
      <div class="callout"><b>Try this</b><br>Pick the one cue you see most often. Decide in advance what you'll do instead when it shows up.</div>`,
    prompt: "Write down the one cue you'll watch for this week, when it usually shows up, and what you'll do instead when you notice it.",
    placeholder: "The cue I'll watch for is...", habitPlaceholder: "e.g. Name the cue before I unlock",
  },
  { n: 3, title: "Comparison and your mood", minutes: 7, stats: [], html: `<p class="muted">Draft lesson. Content coming soon: how highlight reels distort what "normal" looks like, and how to notice comparison before it changes your mood.</p>`, prompt: "Who or what do you compare yourself to online, and how will you limit it this week?", placeholder: "", habitPlaceholder: "e.g. Mute three accounts" },
  { n: 4, title: "Screens, sleep, and focus", minutes: 6, stats: [], html: `<p class="muted">Draft lesson. Content coming soon: what late-night scrolling does to sleep and next-day focus, and how to build a wind-down routine.</p>`, prompt: "What will your phone's bedtime be, where will it sleep, and what will you do instead in the last 30 minutes of your day?", placeholder: "", habitPlaceholder: "e.g. Phone in the kitchen by 10:30" },
  { n: 5, title: "Setting up a phone that works for you", minutes: 8, stats: [], html: `<p class="muted">Draft lesson. Content coming soon: notification settings, home-screen layout, grayscale mode, and other changes that remove friction from good habits.</p>`, prompt: "List the three changes you'll make to your phone setup today, and why each one matters to you.", placeholder: "", habitPlaceholder: "e.g. Notifications off except messages" },
];
