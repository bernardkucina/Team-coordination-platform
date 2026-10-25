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
│       │   ├── members/       # people, tiers, sign-in (members and super admin)
│       │   ├── access/        # super admin only: who can sign in, who is admin
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
  - **Sign-in:** one form, `POST /api/auth/login`. Roster members sign in with their email and no password, only while `DEMO_MODE=true`.
  - **The super admin** is made up: it has no `Member` row and appears in no list. It signs in on the same form with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`; without a password there is no super admin. Its session has `superAdmin = true`, so `requireAuth` answers 403 everywhere except `/api/access/*` (`services/access`). There it adds people, makes them admin or member, and switches access off and on, which also signs them out. The last active admin can't be demoted. Admins can only change tiers (`PATCH /api/members/:id`).
  - **Admin rights:** come from `Member.isAdmin`.
  - **Google sign-in:** will plug into the members service and call `startSession`.
- **The server owns the rules.** Clients can't skip them:
  - **Task history:** every task change writes a history entry generated on the server (`tasks/history.ts`).
  - **Logging window:** members can log hours for today or yesterday, admins up to 6 days back.
  - **Clock-in:** opens 10 minutes before a meeting and stays open until it ends.
  - **"Can't come":** only before the meeting starts.
- **Frontend dates:** `frontend/src/lib/time.ts` counts week numbers from a fixed anchor (19 Oct 2026 = week 43) and adds days by calendar date, not 24-hour steps, so 25 October (when the clocks go back) is handled correctly. Don't reintroduce `CURRENT_WEEK`-relative or millisecond date arithmetic.
- **Time:** dates and times are Europe/Ljubljana (`core/clock.ts`). Time entries store a local date plus minutes after midnight, while meetings store UTC instants. `DEMO_NOW` moves the server clock to a fixed start moment, and the clock keeps running from there.

## Deploy (Vercel)

- **Live:** https://hub-pulse-orcin.vercel.app (Vercel project `hub-pulse`, team `bernard-2911`), deployed from this folder with `npx vercel deploy --prod`. `.vercelignore` keeps local `.env` files and build output out of the upload.
- **Region:** the project's default function region is set to `fra1` (Frankfurt), next to the Supabase database in `eu-central-1`. `regions` in `vercel.json` alone was ignored; with the functions in `iad1`, every request was about 3 times slower.
- **Supabase:** created through the Vercel Marketplace (`hub-pulse-db`). `DATABASE_URL` and `DIRECT_URL` were set from its `POSTGRES_PRISMA_URL` (plus `connection_limit=1`) and `POSTGRES_URL_NON_POOLING`.
- **Resetting the live data:** run the seed locally with `--reset`, with both `DATABASE_URL` and `DIRECT_URL` set to the non-pooling URL.
- **One Next.js app:** on Vercel the whole platform is the Next.js app in `frontend/`. The Express backend runs inside it as one serverless function, `frontend/src/pages/api/[...path].ts`, which calls `createApp()` from `@hub-pulse/backend/app`. The backend code is the same as when it runs standalone.
- **Vercel project settings:** Root Directory `frontend` (with files outside it included). `frontend/vercel.json` runs `npm ci` and `npm run vercel-build` from the repo root. That script runs `prisma generate`, then `prisma migrate deploy`, then `db:seed -- --if-empty`, then `next build`.
- **Database:** Supabase via the Vercel Marketplace.
  - `DATABASE_URL` is the transaction pooler (port 6543) with `?pgbouncer=true&connection_limit=1`.
  - `DIRECT_URL` is the session pooler (port 5432), used for migrations.
  - Prisma's `binaryTargets` include `rhel-openssl-3.0.x`, and `@prisma/nextjs-monorepo-workaround-plugin` copies the engine into the function.
- **Other variables:** `DEMO_MODE`, `COOKIE_SECURE=true`, `SUPER_ADMIN_PASSWORD`, and optionally `SUPER_ADMIN_EMAIL`.
- **Serverless limits:**
  - `DEMO_NOW` restarts at every cold start, so leave it empty on Vercel.
  - The sign-in rate limit is per function instance.
- **Local development:** `frontend/.env.development` sets `BACKEND_URL`, so `npm run dev:frontend` forwards `/api` to `npm run dev:backend`. Without it, Next.js runs the API itself; that needs the backend env variables in the shell.
- **Docker:** the root `Dockerfile` and `railway.json` are the alternative deploy, Express serving the frontend in one container. It needs `DIRECT_URL` as well.

## Business rules

- **Pace:** the current week's commitment is pro-rated by working days (Wednesday = 3/5). Past weeks use the full commitment. Statuses are `met`, `on-track` and `behind`.
- **Attendance rate:** members who showed up ÷ (invited − excused). Only finished meetings count. A missing record counts as `missed` only once an admin has marked the meeting recorded.
- **Drifting away:** under 50% of the commitment in both of the last two finished weeks, *and* at least one missed meeting in those weeks.
- **Superstar:** not behind on pace, and this month either picked up at least 2 unowned tasks or added at least 2 ideas.
- **My meetings (Today):** members see their next meetings from the calendar, happening now first, **never more than 3**. Admins see today's meetings (also at most 3) with the calendar sync status and a "Sync now" button.
- **Can't come:** possible until the meeting starts, with an optional reason, and can be taken back (`DELETE /api/meetings/:id/attendance/self`).
- **Did you attend?:** for meetings you didn't clock in to, answerable for 7 days after the meeting ends and only until an admin records you (`POST .../attendance/report`). The answers are in person, online, or not attended. Not attended needs a reason and is stored as `excused`; an admin can still change it.
- **Hub vs remote:** every time entry and work timer records `location: 'hub' | 'remote'`. Meeting time follows how you joined (in person counts as hub). The hours sheet has no location, so the seed assigns about one day in three remote; imported rows aren't real data.
- **Hub wifi:** members can log time "in the hub" (Track time, manual entries) only from the Impact Hub wifi's public addresses: `HubAddress` rows saved by the super admin ("Save as hub wifi" on Access) plus `HUB_IPS`. Checked on the server (`hours/routes.ts`, client address from `core/network.ts`); with no address saved the check is off. Admins correcting someone else's hours are not checked. Meetings joined in person still count as hub.
- **Make-up duty (General tasks):** a member recorded as `missed` by an admin, or answering "I didn't attend", owes one General task (project `general`, hidden from the board, listed on the Projects overview) picked within `MAKEUP_DAYS` (14). `MakeupDuty` rows, `services/attendance/makeup.ts`; Slack sends a DM when one starts (`attendance.missed` event). Recording them present again removes a duty not yet picked; "can't come" never starts one.
- **Projects and areas:** every project has a main area (one of the 7 `AREAS` in `shared/src/domain.ts`) and its board rows are the areas working on it. A project has a lead, a team (`members`), role cards (`roles`), tags and a tagline. Projects are `active` or `planned`; planned ones have no board and take "I'm interested" instead.
- **Join / Leave:** members join or leave active projects themselves; nobody can leave their last active project (`ops` doesn't count). Members join areas directly too; Strategy and Finance are Core only.
- **Calendar sync:** `services/meetings/sync.ts` reads `CALENDAR_ICS_URL` (Google Calendar's public iCal address), read only. It updates meetings by UID, adds series members from the `Members:` emails in event descriptions, and removes future meetings that left the calendar and have no attendance. It runs on "Sync now" and on `/api/bootstrap` when the last sync is older than `CALENDAR_SYNC_MINUTES` (default 15). Status: `GET /api/calendar/status`.
- **Slack (optional extras, `services/slack`):** nothing is sent without `SLACK_BOT_TOKEN`, and a Slack failure never fails a change. Members are found by `Member.slackEmail` (set by the super admin, because the roster emails aren't real), falling back to the roster email; the Slack user id is cached.
  - **Without Slack:** the app itself reminds you while it is open: a banner on every page and a browser notification when your meeting opens for clock-in (`frontend/src/components/MeetingReminder.tsx`).
  - **Meeting messages:** sent with `chat.scheduleMessage`: a reminder 10 minutes before (clock-in buttons) and a follow-up when the meeting ends ("did you attend?"). They're scheduled for the next 72 hours whenever the calendar syncs and by the daily cron, and tracked in `SlackMessage`. A member with any attendance record gets neither message, so "can't come" or clocking in cancels them.
  - **Buttons and the reason form:** they post to `/api/slack/interactions`, which is checked with `SLACK_SIGNING_SECRET`.
  - **Other messages:** "you were added" DMs come from domain events (`core/events.ts`: `project.memberAdded`). The daily summary goes to project leads, and the monthly report goes to everyone on the 1st, with hub numbers for admins.
  - **Daily job:** `GET /api/cron/daily`, Vercel Cron at 05:00 UTC, protected by `CRON_SECRET`.
  - **Admins:** the Slack card on Today runs the jobs on demand.
  - **Setting up the Slack app:** create it from `slack-app-manifest.json`.
  - **Testing without Slack:** set `SLACK_API_URL` to point at a fake server.
- **Task permissions:** members can edit any task, including handing it to someone else; the history is the safeguard. Only admins create projects. Admins and the project lead can add an area (board row) to a project. Anyone can reorder a to-do list (`PUT /api/tasks/order`, not written to the history).

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
- **Imported hours:** the hours sheet has only weekly totals. The seed spreads each total over Monday–Friday on the member's active projects, or on Hub Operations (`ops`).
- **Hub Operations (`ops`):** also the fallback project for meeting time. The frontend hides it from the project overview and board. Shape Talks belongs to p02 and Summer School to p03; the other series are hub-wide (`projectId` null).
- **Projects and tasks:** the sandbox has none. `backend/src/seed/sample-projects.ts` holds the 7 projects from "PROJEKTI GS za Shapers GO" (p01–p07), the Academy Project, 8 planned projects and 63 tasks, ported from the design prototype.
- **No weekend meetings.** Use e.g. `DEMO_NOW=2026-10-26T17:55` to demo a live clock-in.
- **UTF-8:** names contain č, š, ž, so keep files and data in UTF-8.
