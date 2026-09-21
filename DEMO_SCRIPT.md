# OppSync AI — Demo Script (60-90 seconds)

## Setup
- OppSync running at http://localhost:3000
- Gmail has recent opportunity emails
- Notion "OppSync Opportunities" database open
- Google Calendar open

---

## Demo Walkthrough

### [0:00-0:10] Introduction
"OppSync AI is a student opportunity discovery agent. It scans your Gmail for internship, hackathon, and scholarship emails, extracts structured data using Gemini, and lets you approve or reject each one. Approved opportunities go straight to Notion and Google Calendar."

### [0:10-0:20] Scan
[Click "Scan Recent Emails"]
"Let me scan my recent emails. The agent uses a local pre-filter to skip non-relevant emails, then sends only opportunity-related emails to Gemini for extraction."

[Opportunity cards appear]
"Here are the opportunities Gemini found — each with name, organization, type, deadline, and confidence score."

### [0:20-0:35] Reject
[Click Reject on Card A]
"I'll reject this one — it's not relevant."
[Shows: ✕ Rejected]
"Rejected. No Notion page created. No Calendar event. The approve/reject buttons disappear."

### [0:35-0:50] Approve
[Click Approve on Card B]
"Now I'll approve this internship opportunity."
[Shows: ✓ Approved]
"Approved. Let me check Notion..."

### [0:50-0:60] Notion Verification
[Switch to Notion — show the new record]
"Here it is in the OppSync Opportunities database — name, organization, type, deadline, URL, status, and source email ID all populated."

### [0:60-0:70] Calendar Verification
[Switch to Google Calendar — show the event]
"And here's the deadline event in Google Calendar."

### [0:70-0:80] Key Features
"Two things that make this robust:
1. Deduplication — approving the same opportunity twice won't create duplicates
2. Security — email content is treated as untrusted data, so prompt injection attacks can't force auto-approval"

### [0:80-0:90] Wrap Up
"OppSync turns scattered opportunity emails into an organized, actionable workflow. Built with Next.js, Python, Gemini, and the Swytchcode Runtime SDK."

---

## Key Screens to Capture
1. Main UI with opportunity cards
2. Approve/Reject in action
3. Notion database with the approved record
4. Google Calendar with the deadline event
