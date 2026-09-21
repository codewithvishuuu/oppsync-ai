# OppSync AI — Project Description (Submission Form)

## WHAT
OppSync AI is a student opportunity discovery agent.

## HOW
It scans Gmail, uses Gemini to extract structured opportunities (internships, hackathons, scholarships, competitions, jobs, workshops, certifications, fellowships), lets the user approve/reject them in a web interface, and sends approved opportunities to Notion (database) and Google Calendar (deadline events).

## WHY
Students receive many opportunity emails and can miss deadlines. OppSync turns those scattered emails into an organized, actionable workflow — without automatically writing anything without user consent.

## Key Features
- Gmail opportunity scanning with smart pre-filtering
- Gemini AI extraction with structured output
- User approval/rejection workflow
- Notion + Google Calendar integration
- Deduplication and idempotency
- Prompt-injection defense
- Policy-controlled actions

## Tech Stack
Next.js, Python, Gemini, Swytchcode Runtime SDK, Gmail, Google Calendar, Notion

## Test Suite
82 unit tests covering models, validation, dedup, AI extraction, workflow, security, and performance.
