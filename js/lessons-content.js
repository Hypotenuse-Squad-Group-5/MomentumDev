/* Six-lesson curriculum. Practice activities do not write progress or database records. */
window.LESSON_CONTENT_VERSION = 2;
window.LESSONS = [
  {
    "n": 1,
    "title": "Habits & Goals",
    "summary": "Turn a good intention into a small action you can repeat.",
    "minutes": 8,
    "stats": [],
    "html": "<h2>A habit starts with a situation</h2><p>A habit is a response that becomes more automatic through repetition in a familiar context. The cue could be finishing class, sitting on the couch, or waiting in line. Notice what happens just before you reach for your phone, then choose a response you can actually practice.</p><p>In an everyday habit study, automaticity developed at different rates across people and behaviors. There is no universal 21-day deadline. A missed opportunity does not mean you must abandon the plan. <a href=\"#lesson-sources\">Read the habit research below.</a></p><h2>Make the next action visible</h2><p>“Use my phone less” gives you a direction, but no next step. Try: “After lunch, I will put my phone in my bag and walk outside for five minutes.” Name a cue, an action, and a place. Choose a smaller fallback for a packed day.</p><div class=\"callout\"><b>A useful plan has four parts</b><p class=\"mb0\">When this happens → I will do this → I will make it easier this way → If plans change, I will try this smaller version.</p></div><h2>Change the setup</h2><p>Put a book where you usually scroll. Place walking shoes by the door. Decide what your phone is for during this window: directions and calls might still be useful. The aim is an intentional choice that fits your life.</p>",
    "prompt": "Describe one phone habit you want to change. What is the cue, what small action will replace it, and what will you do on a difficult day?",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Five-minute walk after lunch",
    "sources": [
      {
        "label": "Lally et al. (2010) · Habit formation in everyday life",
        "url": "https://doi.org/10.1002/ejsp.674",
        "note": "Repeated behaviors in a consistent context became more automatic; formation times varied. This was not a study of phone use."
      },
      {
        "label": "Sheeran, Listrom & Gollwitzer (2024) · If–then planning, 642 tests",
        "url": "https://doi.org/10.1080/10463283.2024.2334563",
        "note": "A meta-analysis supports specific if–then plans for goal pursuit. The exercises here are practical adaptations, not tested interventions."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "After dinner you usually open a feed without thinking. Which goal gives you the clearest next action?",
        "options": [
          "I will be more disciplined.",
          "After dinner, I will leave my phone on the counter and read two pages.",
          "I will never scroll again."
        ],
        "answer": 1,
        "explanation": "The second plan names a familiar cue and an observable, manageable action. You can tell whether you did it."
      },
      {
        "type": "planner",
        "title": "Build your first if–then plan",
        "intro": "Start small enough to try today.",
        "fields": [
          {
            "id": "cue",
            "label": "When will you act?",
            "placeholder": "After I finish lunch",
            "options": null,
            "type": "text"
          },
          {
            "id": "action",
            "label": "What small action will you take?",
            "placeholder": "Walk outside for five minutes",
            "options": null,
            "type": "text"
          },
          {
            "id": "setup",
            "label": "What will make it easier?",
            "placeholder": "Leave my shoes by the door",
            "options": null,
            "type": "text"
          },
          {
            "id": "fallback",
            "label": "What is your smaller fallback?",
            "placeholder": "Stand outside for one minute",
            "options": null,
            "type": "text"
          }
        ],
        "template": "When {cue}, I will {action}. I will make it easier by choosing this setup: {setup}. On a difficult day, my smaller version is: {fallback}. I will review what worked after a week.",
        "habit": "Practice my after-lunch plan"
      }
    ]
  },
  {
    "n": 2,
    "title": "Your Phone’s Pull",
    "summary": "Recognize design hooks and choose a boundary that serves you.",
    "minutes": 8,
    "stats": [],
    "html": "<h2>Notice the invitation to keep going</h2><p>Autoplay starts the next video before you decide. A feed without an endpoint gives you few natural stopping places. Badges and alerts repeatedly invite you back. These are features you can change or work around; you do not have to treat every alert as a task.</p><h2>Ask what the use is doing for you</h2><p>A conversation with a distant friend can be supportive. A late-night feed may leave you restless. Content, context, and what phone use displaces all matter. Look at your mood before and after a session, rather than treating every minute on every app as identical.</p><p>The Surgeon General’s youth advisory describes both benefits and risks of social media, plus gaps in what researchers know. It focuses on children and adolescents, not all adults. Associations between use and symptoms do not, by themselves, show what caused what.</p><h2>What an experiment can tell us</h2><p>In a 2025 randomized trial, blocking mobile internet for two weeks improved attention and reported mental health and well-being. Participants could still call, text, and use internet on other devices. That supports testing meaningful boundaries, but does not prove a small setting change will have the same effect.</p><div class=\"callout\"><b>Run a personal experiment</b><p class=\"mb0\">Choose one nonessential interruption to remove. Notice whether you feel more present, and keep the online connections that help you.</p></div>",
    "prompt": "Which feature draws you in, what useful connection do you want to preserve, and what boundary will you test this week?",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Nonessential notifications off",
    "sources": [
      {
        "label": "Castelo et al. (2025) · Randomized mobile-internet blocking trial",
        "url": "https://pubmed.ncbi.nlm.nih.gov/39967678/",
        "note": "Two weeks of mobile-internet blocking improved measured attention and reported well-being and mental health. This substantial intervention is not equivalent to switching off one notification."
      },
      {
        "label": "U.S. Surgeon General (2023) · Social media and youth mental health",
        "url": "https://www.hhs.gov/surgeongeneral/reports-and-publications/youth-mental-health/social-media/index.html",
        "note": "The advisory discusses benefits, risks, and evidence gaps for children and adolescents. Its findings should not automatically be generalized to every college student."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "You need messages from your study group, but badges keep pulling you into a feed. What is a useful first experiment?",
        "options": [
          "Turn off nonessential feed alerts while keeping the study-group contact available.",
          "Assume all screen time has the same effect.",
          "Rely on willpower every time a badge appears."
        ],
        "answer": 0,
        "explanation": "A targeted boundary reduces an unwanted cue while preserving the connection you actually need."
      },
      {
        "type": "planner",
        "title": "Design a boundary",
        "intro": "Pick a change you can observe, rather than a promise to be perfect.",
        "fields": [
          {
            "id": "hook",
            "label": "What pulls you in?",
            "placeholder": "",
            "options": [
              "Autoplay",
              "Notification badges",
              "An endless feed",
              "Checking for reactions"
            ],
            "type": "text"
          },
          {
            "id": "boundary",
            "label": "What boundary will you try?",
            "placeholder": "Disable autoplay and stop after one video",
            "options": null,
            "type": "text"
          },
          {
            "id": "keep",
            "label": "What useful access will you preserve?",
            "placeholder": "Calls and my study group",
            "options": null,
            "type": "text"
          },
          {
            "id": "review",
            "label": "What will you notice?",
            "placeholder": "Whether I return to homework more easily",
            "options": null,
            "type": "text"
          }
        ],
        "template": "The feature I want to interrupt is {hook}. My experiment is: {boundary}. I will preserve access to {keep}. During the next week I will notice {review}, and adjust the boundary to fit what I learn.",
        "habit": "Check my chosen phone boundary"
      }
    ]
  },
  {
    "n": 3,
    "title": "Scroll Less, Sleep Better",
    "summary": "Give your evening a stopping point and a gentler landing.",
    "minutes": 8,
    "stats": [],
    "html": "<h2>When checking stops helping</h2><p>Doomscrolling means repeatedly consuming upsetting content even when you want to stop. Staying informed and repeatedly refreshing are different actions. Ask: “Did I get the information I came for?” Choose a check-in window and a stopping cue before opening a feed.</p><h2>Protect time for sleep</h2><p>Late scrolling can push bedtime later. An engaging conversation or upsetting story can also make it harder to wind down. A night-mode display does not create a stopping point or reserve time for rest.</p><p>CDC recommends at least seven hours of sleep for adults ages 18–60 and turning off electronic devices at least 30 minutes before bedtime. Needs vary; the planner below is a scheduling exercise, not a measure of sleep quality.</p><h2>Prepare an alternative before the urge</h2><p>Choose something easy and low-key: a paper book, stretching, packing your bag, or a familiar quiet routine. Put the phone somewhere that supports your plan while keeping necessary calls or accessibility tools available.</p><div class=\"callout\"><b>If you find yourself scrolling again</b><p class=\"mb0\">Use that moment as your new stopping cue. Close the feed, try the smallest part of your routine, and adjust tomorrow’s setup. If sleep problems persist, talk with a healthcare professional.</p></div>",
    "prompt": "What will signal the end of scrolling, when will your wind-down start, where will your phone be, and what is your fallback?",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Start my phone-free wind-down",
    "sources": [
      {
        "label": "CDC · About sleep",
        "url": "https://www.cdc.gov/sleep/about/",
        "note": "Adults ages 18–60 generally need at least seven hours; CDC recommends turning off electronic devices at least 30 minutes before bed."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "You switched on night mode but still scroll until 2 a.m. What does night mode leave unresolved?",
        "options": [
          "Nothing; the color setting guarantees good sleep.",
          "It does not stop the feed or protect enough time in bed.",
          "It means you should stop using every device permanently."
        ],
        "answer": 1,
        "explanation": "A display setting does not reserve time to rest. A planned stopping point and wind-down routine address that missing piece."
      },
      {
        "type": "planner",
        "title": "Plan tonight’s wind-down",
        "intro": "Set a realistic bedtime and choose what you will do before it.",
        "fields": [
          {
            "id": "bedtime",
            "label": "Planned bedtime",
            "placeholder": "",
            "options": null,
            "type": "time"
          },
          {
            "id": "wake",
            "label": "Planned wake-up time",
            "placeholder": "",
            "options": null,
            "type": "time"
          },
          {
            "id": "parking",
            "label": "Where will your phone stay?",
            "placeholder": "Charging on the desk",
            "options": null,
            "type": "text"
          },
          {
            "id": "replacement",
            "label": "What will you do instead?",
            "placeholder": "Read a paper book",
            "options": null,
            "type": "text"
          },
          {
            "id": "fallback",
            "label": "If you get pulled back in?",
            "placeholder": "Close the app and stretch for one minute",
            "options": null,
            "type": "text"
          }
        ],
        "template": "My planned bedtime is {bedtime} and my wake-up time is {wake}. I will start winding down at least 30 minutes before bed, leave my phone at {parking}, and {replacement}. If I start scrolling again, I will {fallback}.",
        "habit": "Start my evening wind-down",
        "kind": "sleep"
      }
    ]
  },
  {
    "n": 4,
    "title": "Find Your Offline",
    "summary": "Find what you are reaching for, then choose an offline alternative.",
    "minutes": 10,
    "stats": [],
    "html": "<h2>Look for the need beneath the check</h2><p>Sometimes you want connection. Sometimes you need a break, stimulation, or a moment of comfort. A cue might be an alert, but it can also be waiting for a bus or feeling stuck on an assignment. Naming the situation gives you a chance to choose a different response.</p><h2>Use “offline dopamine” as shorthand</h2><p>Here it means finding enjoyable or meaningful alternatives to automatic checking. It is not a diagnosis, a dopamine score, or a way to “reset” your brain. You do not need to remove all pleasure or earn the right to rest.</p><p>The mobile-internet blocking trial found that participants spent more time in activities such as in-person socializing, exercise, and nature. These changes may help explain benefits; the study does not tell us which activity is right for you.</p><h2>Match the alternative to the moment</h2><p>If you want company, a solo productivity task may not meet the need. If you are exhausted, a busy social plan may be too much. Choose one realistic option, adapt it for your body and environment, and notice how you feel afterward.</p><div class=\"callout\"><b>Notice → name → choose</b><p class=\"mb0\">“I’m waiting for class and want connection. I can say hello to someone nearby.” A short choice is enough to practice; you do not have to fill every quiet moment.</p></div>",
    "prompt": "Describe a common attention cue, the need you think is underneath it, an offline alternative, and an easier fallback. How will you check whether it helps?",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Pause and name what I need",
    "sources": [
      {
        "label": "Castelo et al. (2025) · Randomized mobile-internet blocking trial",
        "url": "https://pubmed.ncbi.nlm.nih.gov/39967678/",
        "note": "Two weeks of mobile-internet blocking improved measured attention and reported well-being and mental health. This substantial intervention is not equivalent to switching off one notification."
      },
      {
        "label": "Lally et al. (2010) · Habit formation in everyday life",
        "url": "https://doi.org/10.1002/ejsp.674",
        "note": "Repeated behaviors in a consistent context became more automatic; formation times varied. This was not a study of phone use."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "You keep checking messages because you feel lonely. Which alternative best matches that need?",
        "options": [
          "Add another task to your to-do list.",
          "Reach out to someone for a short conversation or walk.",
          "Judge yourself for wanting company."
        ],
        "answer": 1,
        "explanation": "Connection is a reasonable need. A small invitation or conversation may fit it better than simply staying busy."
      },
      {
        "type": "planner",
        "title": "Find an offline alternative",
        "intro": "This is a reflection tool. Choose the need that feels closest today.",
        "fields": [
          {
            "id": "cue",
            "label": "What happens before you reach for your phone?",
            "placeholder": "Waiting between classes",
            "options": null,
            "type": "text"
          },
          {
            "id": "need",
            "label": "What might you need?",
            "placeholder": "",
            "options": [
              "Connection",
              "Rest",
              "Movement",
              "Curiosity",
              "A sense of progress"
            ],
            "type": "text"
          },
          {
            "id": "action",
            "label": "What will you try?",
            "placeholder": "Say hello to a classmate",
            "options": null,
            "type": "text"
          },
          {
            "id": "fallback",
            "label": "What is the easiest version?",
            "placeholder": "Ask one person how their day is going",
            "options": null,
            "type": "text"
          },
          {
            "id": "review",
            "label": "How will you tell if it helped?",
            "placeholder": "Notice whether I feel more connected afterward",
            "options": null,
            "type": "text"
          }
        ],
        "template": "When {cue}, I will pause and name my need for {need}. Instead of opening a feed automatically, I will {action}. If that is too much, I will {fallback}. I will {review} and keep or adjust the alternative based on my experience.",
        "habit": "Pause, name my need, choose an alternative",
        "kind": "needs"
      }
    ]
  },
  {
    "n": 5,
    "title": "Build Real Connection",
    "summary": "Practice a fairer interpretation and a manageable step toward connection.",
    "minutes": 10,
    "stats": [],
    "html": "<h2>A post leaves out the surrounding day</h2><p>A feed can show you other people’s celebrations without their ordinary, awkward, or difficult moments. When you notice “everyone else has it figured out,” separate the visible fact from the story you added. You can appreciate someone’s good moment without treating it as a verdict on your life.</p><h2>Make room for an imperfect beginning</h2><p>Changing routines can feel unfamiliar. Try a small invitation with a clear activity and an easy way to decline. Shared activities give you something to do together when conversation pauses. Your goal can be showing up for ten minutes, rather than making an instant best friend.</p><h2>Connection is about quality</h2><p>CDC describes supportive relationships as important for mental and physical health, including coping with stress. That does not mean every social event feels good or that more invitations are always better. Choose respectful people, comfortable settings, and a pace you can sustain.</p><p>Ordinary nerves and social anxiety disorder are not the same thing. If fear persists or interferes with school, relationships, or daily activities, NIMH describes effective treatments and ways to seek care. A lesson exercise is not a substitute for that support.</p><div class=\"callout\"><b>Make the success yours to control</b><p class=\"mb0\">“I asked someone to walk with me” is an action you can take. Whether they are free is outside your control. A decline is information about this invitation, not a measurement of your worth.</p></div>",
    "prompt": "What comparison or social worry do you notice, what is a fairer interpretation, and what small offline step will you try? Include a fallback if the first plan does not work.",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Make one low-pressure invitation",
    "sources": [
      {
        "label": "CDC · Social connection",
        "url": "https://www.cdc.gov/social-connectedness/about/",
        "note": "Supportive relationships matter for mental and physical health. A single hangout does not guarantee a health benefit."
      },
      {
        "label": "NIMH · Social anxiety disorder",
        "url": "https://www.nimh.nih.gov/health/publications/social-anxiety-disorder-more-than-just-shyness",
        "note": "Describes persistent social anxiety and evidence-based care. The activities here are not treatment or a diagnostic test."
      },
      {
        "label": "U.S. Surgeon General (2023) · Social media and youth mental health",
        "url": "https://www.hhs.gov/surgeongeneral/reports-and-publications/youth-mental-health/social-media/index.html",
        "note": "The advisory discusses benefits, risks, and evidence gaps for children and adolescents. Its findings should not automatically be generalized to every college student."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "A classmate posts a group photo. You think, “Everyone has close friends except me.” Which response separates fact from assumption?",
        "options": [
          "That photo proves I am the only person who feels lonely.",
          "I see one group moment. I do not know everyone’s whole social life.",
          "I need to post something better immediately."
        ],
        "answer": 1,
        "explanation": "The photo shows a moment, not a complete account of anyone’s relationships. A fairer interpretation leaves space for your next step."
      },
      {
        "type": "planner",
        "title": "Reframe and take one small step",
        "intro": "You can acknowledge a feeling without treating a prediction as a fact.",
        "fields": [
          {
            "id": "thought",
            "label": "What thought shows up?",
            "placeholder": "They will think my invitation is awkward",
            "options": null,
            "type": "text"
          },
          {
            "id": "fact",
            "label": "What do you actually know?",
            "placeholder": "We talked after class once",
            "options": null,
            "type": "text"
          },
          {
            "id": "reframe",
            "label": "What is a fairer interpretation?",
            "placeholder": "They might be busy, but I can still ask",
            "options": null,
            "type": "text"
          },
          {
            "id": "step",
            "label": "What small step feels manageable?",
            "placeholder": "",
            "options": [
              "Say hello after class",
              "Ask a familiar person for a short walk",
              "Invite someone to a shared activity"
            ],
            "type": "text"
          },
          {
            "id": "fallback",
            "label": "If the first invitation does not work?",
            "placeholder": "Suggest another day or ask someone else",
            "options": null,
            "type": "text"
          }
        ],
        "template": "When I notice the thought “{thought}”, I will separate it from what I know: {fact}. A fairer interpretation is: {reframe}. My next manageable step is to {step}. If the first plan does not work, I will {fallback}.",
        "habit": "Practice one small step toward connection"
      }
    ]
  },
  {
    "n": 6,
    "title": "Make Plans That Stick",
    "summary": "Make an invitation concrete and give yourself a plan for next time.",
    "minutes": 10,
    "stats": [],
    "html": "<h2>Give “we should hang out” a shape</h2><p>A useful invitation says who, what, when, where, and how long. Choose a low-cost activity with a clear end time. Check transport, access needs, and whether the location works for the people you invite. A short walk, cards, or a picnic can be enough.</p><h2>Agree on phones together</h2><p>Offer a boundary rather than taking someone’s phone away: “Want to keep phones in our bags for the first half hour?” Leave room for caregiving, health, accessibility, and urgent contact. One person can keep directions available. Ask before taking or sharing photos.</p><h2>Prepare for the ordinary obstacles</h2><p>Have an indoor option if weather changes. Make rescheduling easy. If someone cannot attend, you can still take a walk or invite a different person. Specific if–then plans can help turn intentions into actions; this invitation framework is a practical adaptation of planning research.</p><h2>Keep the part that worked</h2><p>Afterward, ask what made the time enjoyable and what got in the way. Repeat a small version before making the plan bigger. A regular check-in can help you adjust your environment, invitations, and phone boundaries as your schedule changes.</p><div class=\"callout\"><b>Your next week</b><p class=\"mb0\">Choose one invitation, one phone boundary, and one time to review the plan. A changed plan is still a chance to practice making an intentional choice.</p></div>",
    "prompt": "Describe your next phone-free hangout, your agreed phone boundary, a backup plan, and when you will review what worked. What small daily habit will support it?",
    "placeholder": "Describe when you will act, what you will do, and how you will make it easier. Include a fallback for a difficult day.",
    "habitPlaceholder": "e.g. Check my next offline plan",
    "sources": [
      {
        "label": "Sheeran, Listrom & Gollwitzer (2024) · If–then planning, 642 tests",
        "url": "https://doi.org/10.1080/10463283.2024.2334563",
        "note": "A meta-analysis supports specific if–then plans for goal pursuit. The exercises here are practical adaptations, not tested interventions."
      },
      {
        "label": "CDC · Social connection",
        "url": "https://www.cdc.gov/social-connectedness/about/",
        "note": "Supportive relationships matter for mental and physical health. A single hangout does not guarantee a health benefit."
      }
    ],
    "activities": [
      {
        "type": "quiz",
        "title": "Try a scenario",
        "question": "A friend needs their phone for a family responsibility. What is a considerate phone-free agreement?",
        "options": [
          "Require everyone to hand over their phones.",
          "Agree on fewer optional checks while keeping necessary access.",
          "Cancel because the hangout cannot be perfectly phone-free."
        ],
        "answer": 1,
        "explanation": "The point is shared attention. A flexible agreement can preserve necessary access and respect everyone’s responsibilities."
      },
      {
        "type": "planner",
        "title": "Build an invitation you can use",
        "intro": "Fill in the details, then copy the draft or add the plan to your reflection. Nothing is sent for you.",
        "fields": [
          {
            "id": "who",
            "label": "Who will you invite?",
            "placeholder": "Maya and Jordan",
            "options": null,
            "type": "text"
          },
          {
            "id": "activity",
            "label": "What will you do?",
            "placeholder": "Play cards",
            "options": null,
            "type": "text"
          },
          {
            "id": "when",
            "label": "When and for how long?",
            "placeholder": "Saturday at 3 p.m. for 45 minutes",
            "options": null,
            "type": "text"
          },
          {
            "id": "where",
            "label": "Where will you meet?",
            "placeholder": "The library courtyard",
            "options": null,
            "type": "text"
          },
          {
            "id": "boundary",
            "label": "What phone agreement will you suggest?",
            "placeholder": "Phones in bags except for necessary calls",
            "options": null,
            "type": "text"
          },
          {
            "id": "backup",
            "label": "What is your backup?",
            "placeholder": "Meet in the student center if it rains",
            "options": null,
            "type": "text"
          },
          {
            "id": "review",
            "label": "When will you review what worked?",
            "placeholder": "Sunday evening",
            "options": null,
            "type": "text"
          }
        ],
        "template": "I will invite {who} to {activity} at {where}, {when}. I will suggest this phone agreement: {boundary}, with necessary access respected. My backup plan is: {backup}. I will review what worked on {review} and choose one part to repeat.",
        "habit": "Check and prepare my next offline plan",
        "kind": "hangout"
      }
    ]
  }
];
