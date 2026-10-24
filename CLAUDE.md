# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A team coordination platform ("Hub Pulse") for an institute run by 20 volunteers, built at a hackathon (Sat 2026-10-24 – Sun 2026-10-25). It replaces a Miro board, a hand-kept attendance spreadsheet and untracked hours with one platform that covers four areas:

1. **Tasks:** projects as boards, with tasks assigned to people. Each member sees "my tasks" across all projects; admins see everything and who finished what.
2. **Hours:** members log their hours against their tier's weekly commitment; admins see who is behind.
3. **Attendance:** members clock in to meetings quickly; admins record attendance and see everyone's record across all six meeting series.
4. **Admin analytics:** hours, attendance and tasks per member, across tiers, meeting series and time.

Requirements are in `BRIEF.md`, the agreed plan in `PLAN.md`, and the sandbox data in `SANDBOX.md`.

**Status:** the backend and frontend are connected and run on the seeded sandbox data. There are no integrations yet (no Google sign-in, Google Calendar, Slack or AI); sign-in is a demo email form (roster email, no password).

## Commands

Run from the repo root unless noted. Node 22+ and Docker are needed locally.

```bash
npm install                 # all workspaces
npm run db:up               # local PostgreSQL in Docker (docker-compose.yml)
cp backend/.env.example backend/.env
npm run db:migrate          # apply Prisma migrations (prisma migrate dev)
npm run db:seed             # load material/ into an empty database
npm run db:seed -- -- --reset   # wipe everything and seed again

npm run dev:backend         # API on http://localhost:4000 (tsx watch)
npm run dev:frontend        # Next.js on http://localhost:3000, /api proxied to the backend
npm run typecheck           # all workspaces
npm test                    # backend unit tests (vitest)
npx vitest run src/services/hours/rules.test.ts   # one test file (from backend/)
npx vitest run -t "pro-rates"                     # tests by name (from backend/)
```

After changing a file in `backend/prisma/schema/`, run `npm run db:migrate` (from the root) to migrate and regenerate the client.

## Folder tree

```
Team-coordination-platform/
├── BRIEF.md, SANDBOX.md, PLAN.md, SPECIFICATION.md
├── material/                  # organiser files: roster/hours/attendance .xlsx, meetings.ics (seed source of truth)
├── docker-compose.yml         # local PostgreSQL
├── package.json               # npm workspaces: shared, backend, frontend
├── shared/src/                # @hub-pulse/shared: the contract both sides compile against
│   ├── domain.ts              #   data model (Member, Task, Meeting, TimeEntry, …), TIER_HOURS
│   ├── rules.ts               #   rule constants (log window, clock-in window, drift thresholds)
│   └── api.ts                 #   request/response types for every /api route
├── backend/
│   ├── prisma/schema/         # one .prisma file per service, plus base.prisma (datasource) and migrations/
│   └── src/
│       ├── server.ts, app.ts  # one Express app; mounts every service under /api
│       ├── core/              # config, db, clock (Europe/Ljubljana), errors, validate (zod), auth (sessions)
│       ├── gateway/           # composes responses across services: /api/me, /api/members, /api/bootstrap
│       ├── services/
│       │   ├── members/       # people, tiers, roles, sandbox login
│       │   ├── tasks/         # projects, workstreams, tasks, server-written task history
│       │   ├── meetings/      # series + meetings, ICS parser/importer (calendar is read-only)
│       │   ├── attendance/    # clock-in, "can't come", admin bulk recording, attendance stats
│       │   ├── hours/         # time entries, weekly totals, pace, "Track time" timers
│       │   └── analytics/     # admin-only read model: member table, drifting/superstar, tier/series trends
│       └── seed/              # loads material/ + sample projects/tasks
└── frontend/                  # Next.js 14 app (see frontend/CLAUDE.md); types come from @hub-pulse/shared
```

## Architecture

- **One process, folders like microservices.** It deploys as a single Express app with one PostgreSQL database. Each folder in `backend/src/services/` holds its own `routes.ts`, logic, `rules.ts` (pure, unit-tested) and its own `prisma/schema/<service>.prisma`.
- **Service boundaries:**
  - **Imports:** a service imports other services only through their `index.ts`.
  - **Dependency order:** dependencies flow one way, `members → tasks/meetings → attendance → hours → analytics`, with `gateway` on top. Keep it that way so there are no import cycles.
  - **The gateway** only composes responses from services and holds no rules.
- **How the frontend talks to the backend:** `frontend/src/lib/store.tsx` loads everything from `GET /api/bootstrap`. Every `dispatch` updates the screen at once, then `persist()` sends the matching API call. Calls run one at a time, and when none are waiting the store reloads from the server, so the screen shows what the server kept. A refused change shows the server's error message and the reload undoes it. The store also reloads every 30 s. `lib/api.ts` is the typed client. Next forwards `/api` to the backend (`BACKEND_URL`, default `http://localhost:4000`).
- **The frontend clock follows the server.** `lib/time.ts` exports `DEMO_TODAY`, `CURRENT_WEEK`, `DEMO_NOW` and `WEEK_PACE` as live bindings set from the server's time. Read them at render time; never copy them into module-level constants.
- **The contract is `shared/`.** Change the types in `shared/src/api.ts` or `domain.ts` first; then the backend and frontend fail to compile where they disagree. The frontend's `src/lib/types.ts` re-exports them.
- **Auth:** every sign-in ends in the same httpOnly `hp_session` cookie backed by the `Session` table (`core/auth.ts`).
  - **Sandbox login:** sign in with a roster email and no password (`POST /api/auth/demo-login`). It only exists when `DEMO_MODE=true`.
  - **Admin rights:** come from `Member.isAdmin`.
  - **Google sign-in:** will plug into the members service and call `startSession`.
- **The server owns the rules.** Clients can't skip them:
  - **Task history:** every task change writes a history entry generated on the server (`tasks/history.ts`).
  - **Logging window:** members can log hours for today or yesterday, admins up to 6 days back.
  - **Clock-in:** opens 10 minutes before a meeting and stays open until it ends.
  - **"Can't come":** only before the meeting starts.
- **Time:** dates and times are Europe/Ljubljana (`core/clock.ts`). Time entries store a local date plus minutes after midnight, while meetings store UTC instants. `DEMO_NOW` moves the server clock to a fixed start moment, and the clock keeps running from there.

## Business rules

- **Pace:** the current week's commitment is pro-rated by working days (Wednesday = 3/5). Past weeks use the full commitment. Statuses are `met`, `on-track` and `behind`.
- **Attendance rate:** members who showed up ÷ (invited − excused). Only finished meetings count. A missing record counts as `missed` only once an admin has marked the meeting recorded.
- **Drifting away:** under 50% of the commitment in both of the last two finished weeks, *and* at least one missed meeting in those weeks.
- **Superstar:** not behind on pace, and this month either picked up at least 2 unowned tasks or added at least 2 ideas.
- **Task permissions:** members can edit any task, including handing it to someone else; the history is the safeguard. Only admins create projects. Admins and the project lead can add workstreams.

## Hard constraints

- **Google Calendar is read-only.** Meetings are imported by event UID through `importCalendarEvents`. Never create or edit events.
- **The core platform never writes to Slack.** Posting is an optional extra; see `material/Slack notes, for the extras.docx`.
- Use AI only where it makes a task easier.
- **Submission (Sun 2026-10-25, 14:00):** a public URL, the repository, an infrastructure page and one paragraph.

## Sample data notes

- **Tiers:** the roster says `Core`/`Impact`/`GO!`; the API uses `Shapers Core`/`Shapers Impact`/`ShapersGO`, with weekly commitments of 70/10/4 h.
- **Attendance state:** the sheet's `unexcused` is `missed` in the database and API.
- **IDs:**
  - Member IDs come from the email: `ana.kovac@…` → `ana-kovac`.
  - Meeting IDs are the event UID without its domain: `community-20260914`.
  - Series IDs are slugs: `summer-school`.
- **Imported hours:** the hours sheet has only weekly totals. The seed spreads each total over Monday–Friday on the member's series projects, or on Hub Operations (`ops`).
- **Hub Operations (`ops`):** also the fallback project for meeting time. The Community series is hub-wide (`projectId` null).
- **Sample projects and tasks:** the sandbox has none. The 4 projects and 33 tasks are invented in `backend/src/seed/sample-projects.ts`.
- **No weekend meetings.** Use e.g. `DEMO_NOW=2026-10-26T17:55` to demo a live clock-in.
- **UTF-8:** names contain č, š, ž, so keep files and data in UTF-8.
