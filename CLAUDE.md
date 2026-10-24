# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A team coordination platform for an institute run by 20 volunteers, built at a hackathon (Sat 2026-10-24 – Sun 2026-10-25). It replaces a Miro board, a hand-kept attendance spreadsheet and untracked hours with one platform that covers four areas:

1. **Tasks:** projects as boards, with tasks assigned to people. Each member sees "my tasks" across all projects; admins see everything and who finished what.
2. **Hours:** members log their hours against their tier's weekly commitment; admins see who is behind.
3. **Attendance:** members clock in to meetings quickly; admins record attendance and see everyone's record across all six meeting series.
4. **Admin analytics:** hours, attendance and tasks per member, across tiers, meeting series and time.

Full requirements are in `BRIEF.md`. The team's architecture intent is in `SPECIFICATION.md`.

**Status:** planning. No application code exists yet, so there are no build, lint or test commands. Add them here once the stack is chosen.

## Folder tree

The folders marked *(planned)* don't exist yet. They follow `SPECIFICATION.md`: a separate frontend and backend, deployed as one monolith but organised as microservices.

```
Team-coordination-platform/
├── CLAUDE.md                 # this file: project overview for Claude Code
├── BRIEF.md                  # the challenge: what to build, member/admin stories
├── SANDBOX.md                # sandbox data package + Google Calendar import steps
├── SPECIFICATION.md          # team's own architecture intent and open questions
├── material/                 # original organiser files: source of truth for sample data
│   ├── BRIEF, challenge.docx
│   ├── README, sandbox setup.docx
│   ├── SCHEDULE.docx         # hackathon timetable, submission deadline
│   ├── Slack notes, for the extras.docx
│   ├── Mentor slots, hackathon 2026-10-24.xlsx
│   ├── meetings.ics          # 55 meetings, 6 series → import into Google Calendar
│   ├── roster.xlsx           # 20 members: name, email, tier, weekly_hours, admin, series
│   ├── hours.xlsx            # one row per member per week
│   └── attendance flat.xlsx  # one row per member per meeting
├── frontend/                 # (planned) web client; talks to backend only through the API
└── backend/                  # (planned) single deployable monolith
    ├── services/
    │   ├── user/             # member-facing: my tasks, log hours, clock in, my attendance
    │   └── admin/            # admin-facing: projects/boards, assigning, attendance recording, analytics
    ├── shared/               # Google OAuth, database access, shared models, config
    └── integrations/
        ├── google-calendar/  # READ-ONLY meeting sync
        └── slack/            # read-only in core; posting only as an optional extra
```

## Architecture

- **Frontend and backend** are developed separately, so the API contract between them must be explicit.
- **Monolith with service boundaries.** All services run in one process, but each service under `backend/services/` should stay self-contained so it could be split out later. More services may be added beyond `user` and `admin`.
- **Auth** uses Google OAuth. There are two roles: admins see all projects and tasks, while members see only the boards and tasks assigned to them.
- **Undecided:** hosting, the database, and how to integrate Slack and Google Calendar.

## Hard constraints

- **Google Calendar is read-only.** Read the meetings from it. Never create or edit events.
- **The core platform never writes to Slack.** Reading is fine. Posting announcements and reminders is an optional extra; `material/Slack notes, for the extras.docx` covers the bot scopes, Socket Mode and an activity signal based on reactions, posts and presence.
- Use AI only where it makes a task easier.
- **Submission (Sun 2026-10-25, 14:00):** a public URL, the repository, an infrastructure page and one paragraph. Demos start at 15:00 and last 10 minutes per team.

## Domain model and sample data

- **Tiers and weekly hours:** Core 70, Impact 10, GO! 4. Three members are admins (`admin = yes`).
- **Meeting series:** Summer School, Grants, Shape Talks, Community, Shapers Tech, Shapers Voice. **Community includes everyone**; the other series have their own member lists (the roster's `series` column, separated by `; `).
- **Attendance states:** `present`, `remote`, `excused`, `unexcused`. Attendance exists for every meeting before 2026-10-24.
- **Hours:** `week_start` is the Monday. The week of 2026-10-19 is in progress, with data through Friday 2026-10-23.
- **Join key:** email (`@sandbox.example`) links the roster, hours, attendance, calendar events and Slack users.
- **`meetings.ics`:** times are Europe/Ljubljana (stored in UTC). The series is in `CATEGORIES` and in `DESCRIPTION` (`Series: …\nMembers: email, …`), and the UID pattern is `<series-slug>-YYYYMMDD@sandbox.example`.
- **File names:** `SANDBOX.md` refers to `.csv` files, but the actual files in `material/` are the `.xlsx` files shown in the tree above. Names contain Slovenian diacritics (č, š, ž), so preserve UTF-8.
