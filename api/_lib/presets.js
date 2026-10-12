// Example tasks to load into the page. Each uses TypeSafe's question schema.
export const PRESETS = [
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
    state: "Battery life is incredible, easily two days. The camera is fine in daylight but noisy indoors. Honestly for the price I expected a better screen. Would I buy it again? Probably.",
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
      user_question: "What's the max dose of ibuprofen I can take in a day?",
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
    state: "it's freezing in here and can you also turn off the kitchen lights",
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
];
