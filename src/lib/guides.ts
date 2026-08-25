/** Plain-language help content used by the public guide page and admin Help tab. */

export interface GuideEntry {
  q: string;
  a: string;
}

export interface GuideGroup {
  title: string;
  entries: GuideEntry[];
}

export const siteGuide: GuideGroup[] = [
  {
    title: "Booking a lesson",
    entries: [
      {
        q: "How do I book my first lesson?",
        a: "Open the Contact page, fill in your name and phone number, pick a package, then choose the days and start times that suit you. Tap Send and your booking goes straight to us on WhatsApp.",
      },
      {
        q: "Why is a time crossed out?",
        a: "That time is already taken by another learner. Pick any time that isn't crossed out.",
      },
      {
        q: "What is the booking reference?",
        a: "It's a short code like ADS-7K3Q9 that we both use to find your booking. Keep it, you can download the receipt from the same screen.",
      },
    ],
  },
  {
    title: "Paying with EcoCash",
    entries: [
      {
        q: "How do I pay?",
        a: "Open the Pay page, find your name, choose your package, send the money on EcoCash to the number shown, then type the confirmation reference and tap Submit Payment.",
      },
      {
        q: "When is my payment confirmed?",
        a: "We check every reference by hand against our EcoCash statement and message you on WhatsApp. Keep your EcoCash SMS until then.",
      },
      {
        q: "Can I get a receipt?",
        a: "Yes. After you submit, tap Download receipt on the confirmation screen. You can also ask us for one any time.",
      },
    ],
  },
  {
    title: "Writing a test",
    entries: [
      {
        q: "How do I open my test?",
        a: "We send you a private link on WhatsApp. Open it on your phone, type the last 4 digits of your phone number, then tap Start my test.",
      },
      {
        q: "How long do I get?",
        a: "The time allowed is shown before you start, and a clock counts down at the top while you write. When it reaches zero your answers are sent automatically.",
      },
      {
        q: "What if my phone drops the connection?",
        a: "Message us. Your link works once, but we can reset it or give you extra time.",
      },
      {
        q: "Where do I see my result?",
        a: "We send a results link on WhatsApp once your test is marked. It shows your score and a short note from the examiner.",
      },
    ],
  },
];

export const adminGuide: GuideGroup[] = [
  {
    title: "Every day",
    entries: [
      {
        q: "A new booking came in, what now?",
        a: "Open Enquiries. Tap the status that fits: Contacted once you've called, Scheduled once the lesson is set, Enrolled once they've signed up. Enrolled bookings show an 'Add to Students' button.",
      },
      {
        q: "Someone paid, how do I check it?",
        a: "Open Payments. Compare the reference with your EcoCash statement, then tap Confirmed or Not Found. Add a short note for yourself, and tap Receipt to print or save one for the learner.",
      },
    ],
  },
  {
    title: "Students",
    entries: [
      {
        q: "How do I add a walk-in student?",
        a: "Open Students and tap Add student. Fill in the name, phone number (required), package and date, then tap Save.",
      },
      {
        q: "How do I get a list of students?",
        a: "In Students, tap 'Export all (Excel)' for a spreadsheet, or 'Export all (PDF)' to print. Each student card also has its own Excel and PDF buttons with their payment history.",
      },
    ],
  },
  {
    title: "Tests",
    entries: [
      {
        q: "How do I build a test?",
        a: "Open Tests → Test bank → Add test. Give it a name and a time limit. Choose Multiple choice and type questions and answers (tap 'Mark correct' on the right one), or choose PDF paper and upload the paper plus an answer key.",
      },
      {
        q: "How do I send a test to a student?",
        a: "Tests → Assign a test. Pick the test and the student, tap 'Create the student's test link', then tap Send on WhatsApp. The learner types the last 4 digits of their phone to start.",
      },
      {
        q: "How do I mark and send results?",
        a: "Tests → Mark & send results. Multiple-choice tests are scored for you. Type the final result and a short note, tap Save result, then Send result on WhatsApp.",
      },
      {
        q: "A student lost their link or ran out of time.",
        a: "In Assign a test, use Reset link to create a fresh one, or add extra minutes in 'Extra time'.",
      },
    ],
  },
  {
    title: "The website",
    entries: [
      {
        q: "How do I change prices or packages?",
        a: "Open Packages, edit the name, price, number of lessons and what's included, then tap Save.",
      },
      {
        q: "How do I change the About page or the team?",
        a: "Use the About Page tab for the story, the four 'Why choose us' cards and any extra sections (use the arrows to reorder). Use Meet the Team for staff photos and bios.",
      },
      {
        q: "How do I change the phone number or WhatsApp messages?",
        a: "Open Site Settings. You can edit the phone number, address, opening hours, EcoCash number and the WhatsApp messages that get pre-filled for learners.",
      },
    ],
  },
];