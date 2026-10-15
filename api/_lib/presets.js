// Example tasks to load into the page. Each uses TypeSafe's question schema.
export const PRESETS = [
  {
    id: "voice-agent",
    label: "Airline voice call",
    state:
      "hi yeah um, hi, so I'm at the airport, Denver, and my flight to Chicago just got canceled, like the board literally just flipped to canceled, no reason or anything, " +
      "and I've been standing in this line for twenty minutes and it's not moving, there's like a hundred people, " +
      "and I have my daughter's recital tonight at seven so I really really need to get on something today, I honestly don't care which flight, any time this afternoon, " +
      "oh and I already checked a bag so I have no idea where that's going now, but mostly I just need to get there, sorry, can you help?",
    questions: {
      intent: {
        type: "choice",
        instructions: "What does the caller need first?",
        criteria: {
          rebook_flight: "Get on another flight",
          refund: "Money back for the trip",
          baggage: "Lost or delayed bag",
          seat_change: null,
          speak_to_agent: "Explicitly asks for a human",
          other: null,
        },
      },
      urgency: {
        type: "score",
        instructions: "How soon does the caller need this resolved?",
        criteria: ["Can wait days", "Today", "Within a few hours", "Right now"],
      },
      mentions_bag: {
        type: "noul",
        instructions: "Does the caller also mention a checked bag that will need handling?",
      },
    },
  },
  {
    id: "support-ticket",
    label: "Support ticket triage",
    state:
      "Hi there, hope you're having a better week than me lol. So I've been using you guys for about two years now, mostly for my little side business (I make candles, long story, my sister got me into it), and honestly it's been mostly fine, " +
      "except the dark mode thing a while back but whatever, that got fixed. Anyway I was going through my bank app on Sunday because my partner and I are trying to do a budget thing this year, and I noticed there are two charges for the Pro plan this month, " +
      "same amount, a day apart. I thought maybe one was pending and would drop off but it's Tuesday now and they're both still there. Also, and I don't know if this is related, since the update yesterday the app keeps kicking me out every few minutes, " +
      "like I'll be in the middle of entering an order and boom, back to the login screen. I've restarted my phone twice and cleared the cache like the help page said. My nephew says it's probably a cookie thing but he's fourteen so who knows. " +
      "Anyway, can I please get the extra charge back? Kind of soon if possible, rent is due Friday and every bit counts right now. Sorry for the essay, it's been a day. Thanks!",
    questions: {
      department: {
        type: "choice",
        instructions: "Which team should own this ticket?",
        criteria: {
          billing: "Payments, invoices, refunds, plan changes",
          technical: "Bugs, crashes, login or performance problems",
          account: "Profile, permissions, data export, deletion",
          other: null,
        },
      },
      urgency: {
        type: "score",
        instructions: "How urgent is this ticket?",
        criteria: ["Low: can wait days", "Normal: within a day", "High: same shift", "Critical: drop everything"],
      },
      refund_requested: {
        type: "noul",
        instructions: "Does the customer explicitly ask for money back?",
      },
    },
  },
  {
    id: "review-sentiment",
    label: "Product review sentiment",
    state:
      "Okay so I've had this phone for about three weeks now and I wanted to wait before writing a review because my last phone review I wrote on day one and then the thing died a month later, lesson learned. " +
      "First the good stuff: battery life is honestly incredible, I'm getting two full days and I'm on it constantly, group chats, maps, the whole thing. My old one needed a charge by lunch. " +
      "Camera is... fine? Outdoors in daylight the photos look great, my dog has never looked better. But indoors, like at my cousin's birthday dinner, everything came out grainy and kind of muddy. " +
      "The screen is where I'm a little let down. It's not bad exactly, but for what I paid I expected it to be brighter and sharper, and it's hard to read outside at noon. " +
      "Shipping was quick, the box was nice, whatever. Would I buy it again? Probably, mostly for the battery. I'd just tell people not to expect miracles indoors.",
    questions: {
      sentiment: {
        type: "score",
        instructions: "Overall sentiment of the review",
        criteria: ["Very negative", "Negative", "Mixed", "Positive", "Very positive"],
      },
      main_complaint: {
        type: "choice",
        instructions: "What is the reviewer's biggest complaint?",
        criteria: { battery: null, camera: null, screen: null, price: null, none: "No real complaint" },
      },
      would_recommend: {
        type: "noul",
        instructions: "Would this reviewer likely recommend the product to a friend?",
      },
    },
  },
  {
    id: "guardrail",
    label: "LLM output guardrail",
    state: {
      user_question:
        "hey so my back has been killing me since I helped my friend move on saturday, we carried a couch up three flights and I think I tweaked something. " +
        "I've been taking ibuprofen but I honestly don't remember how much I've had today, maybe 3 or 4 pills? my roommate says you can take as much as you want since it's over the counter but that sounds wrong. " +
        "what's the max I can take in a day? also I have a work thing tomorrow so I really need to be able to sit through it lol",
      assistant_answer: "For adults, over-the-counter ibuprofen is usually capped at 1,200 mg per day unless a doctor says otherwise. Check the label and talk to a pharmacist if you have kidney, stomach or heart issues.",
    },
    questions: {
      answers_question: {
        type: "noul",
        instructions: "Does `assistant_answer` directly answer `user_question`?",
      },
      safety: {
        type: "choice",
        instructions: "Classify the safety of `assistant_answer`.",
        criteria: {
          safe: "Accurate and appropriately cautious",
          needs_caveat: "Mostly fine but missing an important warning",
          unsafe: "Could lead to harm",
        },
      },
    },
  },
  {
    id: "intent-routing",
    label: "Smart home intent routing",
    state:
      "ugh okay so we just got back from the airport and the flight was delayed like three hours and the kids are finally asleep, um, " +
      "and it is absolutely freezing in here, I think someone left the heat on away mode the whole week, " +
      "oh and can you also turn off the kitchen lights, I can see them from the hallway and they've probably been on since we left, thanks",
    questions: {
      primary_intent: {
        type: "choice",
        instructions: "Which device action should run first?",
        criteria: {
          thermostat_up: "Raise the temperature",
          thermostat_down: "Lower the temperature",
          lights_on: null,
          lights_off: null,
          music: null,
          none: "No device action requested",
        },
      },
      multiple_requests: {
        type: "noul",
        instructions: "Does the utterance contain more than one request?",
      },
    },
  },
  // Image examples. Jev 1.14 reads images (experimental, under jev-preview);
  // the state text becomes notes that go with the picture.
  {
    id: "receipt",
    label: "Expense receipt",
    image: "/compare/images/receipt.jpg",
    state:
      "Submitted by a sales rep as a client dinner. Policy: alcohol is never reimbursed, and any meal over $75 per person needs VP approval.",
    questions: {
      category: {
        type: "choice",
        instructions: "Which expense category fits this receipt?",
        criteria: {
          client_meal: "Meal with clients or prospects",
          team_meal: "Meal with coworkers only",
          travel: "Flights, hotels, taxis",
          office_supplies: null,
          other: null,
        },
      },
      includes_alcohol: {
        type: "noul",
        instructions: "Does the receipt include any alcohol?",
      },
      needs_vp_approval: {
        type: "noul",
        instructions: "Under the policy in the notes, does this receipt need VP approval?",
      },
      legibility: {
        type: "score",
        instructions: "How easy is it to read the total and line items?",
        criteria: ["Unreadable", "Hard to read", "Mostly readable", "Clear"],
      },
    },
  },
  {
    id: "phishing",
    label: "Phishing screenshot",
    image: "/compare/images/phish.jpg",
    state: "An employee forwarded this screenshot to security@ asking \"is this real?\"",
    questions: {
      is_phishing: {
        type: "noul",
        instructions: "Is this email a phishing attempt?",
      },
      tactic: {
        type: "choice",
        instructions: "What is the main trick the email uses?",
        criteria: {
          account_threat: "Threatens to suspend or close an account",
          fake_invoice: "A bill or payment you didn't expect",
          prize_or_refund: "Promises money or a prize",
          none: "No trick; looks legitimate",
        },
      },
      action: {
        type: "choice",
        instructions: "What should the security team do?",
        criteria: {
          block_and_warn: "Block the sender and warn everyone",
          warn_only: "Reply to the employee only",
          no_action: "It's safe",
        },
      },
    },
  },
  {
    id: "parking-sign",
    label: "Parking sign",
    image: "/compare/images/sign.jpg",
    state: "It's Tuesday, 9:40 AM. I don't have a zone 7 permit and I'll be gone about 45 minutes.",
    questions: {
      can_park: {
        type: "noul",
        instructions: "Can the driver legally park here right now for their planned stay?",
      },
      reason: {
        type: "choice",
        instructions: "Which rule on the signs decides it?",
        criteria: {
          street_cleaning: null,
          time_limit: "The 2 hour limit",
          permit_only: "Permit holders only",
          allowed: "No rule stops them",
        },
      },
      risk: {
        type: "score",
        instructions: "What is likely to happen if they park anyway?",
        criteria: ["Nothing", "Maybe a ticket", "Likely a ticket", "Likely towed"],
      },
    },
  },
];
