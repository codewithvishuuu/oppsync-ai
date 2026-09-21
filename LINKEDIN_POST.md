# LinkedIn Post Draft

---

I just built OppSync AI — a student opportunity discovery agent that turns scattered Gmail emails into an organized workflow.

The problem: Students receive dozens of internship, hackathon, and scholarship emails every week. Most get buried. Deadlines are missed.

The solution:
→ Scans Gmail for opportunity-related emails
→ Uses Gemini to extract structured data (name, org, type, deadline, URL)
→ Presents a clean review interface
→ Approved opportunities go to Notion + Google Calendar

What I learned building it:
- How to bridge Next.js and Python in a single agent
- Prompt-injection defense is real — email content must be treated as untrusted input
- Idempotency matters more than you think (no duplicate Notion pages or Calendar events)
- Smart pre-filtering saves AI costs — skip non-relevant emails before calling Gemini

Tech stack: Next.js, Python, Gemini, Swytchcode Runtime SDK, Gmail, Google Calendar, Notion

Built for @Swytchcode Campus Ambassador Task 3.

#AI #StudentOpportunities #BuildInPublic #Swytchcode #Gemini

---

**Note:** Replace @Swytchcode with the actual tag. Adjust the opening hook if needed for your voice.
