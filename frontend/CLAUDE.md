# Hub Pulse

Hackathon app for a Global Shapers hub: tasks, hours against each tier's weekly commitment, and meeting attendance, with a member view and an admin (hub leadership) view. Next.js 14 + TypeScript (strict). Data comes from the backend (`../backend`, see the root `CLAUDE.md`); run it with `npm run dev:backend` from the repo root, then `npm run dev:frontend`.

## Running it

Node lives in `~/.local/node` (no Homebrew on this Mac), so put it on the PATH first:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev        # http://localhost:3000
npm run typecheck  # run after every change
npm run build
```

## How the code is organised

- `src/lib/types.ts`: the data model. Start here.
- `src/lib/api.ts`: typed client for the backend API (`/api`, forwarded to the backend by `next.config.mjs`).
- `src/lib/rules.ts`: business rules (pace, superstars, attendance rate, clock-in window, how far back hours can be logged).
- `src/lib/store.tsx`: one shared state for all screens, loaded from `/api/bootstrap`. Every change is a reducer action that updates the screen and is then saved through `persist()`; the store reloads from the server once nothing is waiting.
- `src/app/<route>/page.tsx`: `/today`, `/projects`, `/analytics`, `/team` (admin only).
- `src/components/`: screens and pieces. Projects live in `components/projects/`.

## Rules to keep

- **Every task change goes through `change()` in `ProjectsView`** (or the `updateTask` action), so it is written to the task's activity history with who did it.
- **Members can edit priority, deadline and owner too.** The history is the safeguard, not permissions.
- **One owner per task, any number of helpers.**
- **Meetings come from Google Calendar and are read only.** Never create or edit them. Slack is read only too.
- **Members log time for today or yesterday only.** Admins can go back 6 days. See `MEMBER_LOG_DAYS_BACK`.
- **Colors come from the CSS variables in `globals.css`** (Nalepke brand kit, see `BRAND.md`). Don't hard-code hex colors in components; use `var(--…)`.
- **Areas are shared data.** `AREAS`, `areaById` and `areaByName` come from `@hub-pulse/shared` (via `@/lib/types`); a project's board rows are named after its areas.
- **Hub Operations (`ops`) is not shown as a project.** It only collects time outside projects (hours and meeting time fall back to it), so the overview and the board hide it.
- **The clock follows the server** (`setClock` in `time.ts`). `DEMO_TODAY`, `CURRENT_WEEK`, `DEMO_NOW` and `WEEK_PACE` are live bindings; read them at render time. To pin the demo to a moment, set `DEMO_NOW` on the backend.

## Change requests

Add new requests at the top in the same format. Mark them `[x]` when done and say what was built.

### 25 Oct 2026

- [x] **The new design (Nalepke) is the app.** The design prototype that lived in `hub-pulse/` (rounds 3 and 4 below plus the "New frontend" commit) was merged into this app with a three-way merge and the folder was deleted. Everything it showed from demo data now comes from the API: areas, project teams (**Join / Leave**), planned projects (**I'm interested**), member areas, task order, hub/remote hours per week and tasks finished per week (`pastWeeksHub`, `pastTasksDone`), Meet links from the calendar (`meetUrl`).
- [x] **Kept from this app on top of the design:** sign-in, the super admin's Access console (restyled in the new look), "Can't come", "Did you attend?", calendar sync, the Slack card, the reminder banner, the **Drifting away / Superstars** card on admin analytics, and Edit/Delete on logged hours.
- Not ported: the design's self check-in "I wasn't there" that created a **General task** due in 14 days (the backend stores a missed meeting you report as `excused` with a reason, and has no general-task rule yet), and its placeholder Meet links (only real calendar links are shown).
- [x] **Meeting reminders without Slack.** `MeetingReminder` (in the root layout, so on every page) shows a banner when one of your meetings opens for clock-in and you have not answered: **Clock in**, **Joining remotely**, **Not now**. With browser notifications allowed (**Turn on** at the bottom of the meetings card) it also notifies once per meeting. Only while the app is open; Slack covers the rest.

### 24 Oct 2026, round 4: analytics (in the design prototype)

What matters, in her words: hours logged, tasks finished, meeting attendance, how much was done remote vs live in the hub, and how I meet the weekly commitment.

- [x] **Hub vs remote is recorded.** Track time and "Add time manually" have an **In the hub / Remote** switch; tracked meetings take it from the clock-in (in person = hub). Every time entry has a `location`.
- [x] **My analytics** shows the five things: KPIs (hours, weeks at commitment with streak, tasks finished, attendance rate, % in the hub), hours per day, a week-by-week commitment list, and attendance by series with recent meetings.
- [x] **Admin analytics** got the same lens, plus leaderboards and a **Members** table on Team.
- [x] **Tasks remember when they were finished** (`doneAt`), so "tasks finished per week" counts real changes.

### 24 Oct 2026, round 3: real project data (in the design prototype)

- [x] **Projects overview from "PROJEKTI GS za Shapers GO".** Projects opens on **Overview**: the 7 running projects as cards (number, main area, tags, description, roles, team, task progress), a filter by area, and **Join / Leave** (you can't leave your last project). **Open board** jumps to that project.
- [x] **Academy Project stays** as an 8th project next to the 7 from the document.
- [x] **Board rows are areas.** Each project's rows are the areas working on it. Admins and the project lead can add an area to a project.
- [x] **Areas section.** The 7 areas with what they do; members can join an area directly. Strategy and Finance are Core-only.
- [x] **Planned projects** (Inkubator, Hekatoni, Shape Clash, Shape Cast …) with an **I'm interested** button.
- [x] **New project dialog** asks for main area, the areas that work on it, roles, lead and first tasks.

### 24 Oct 2026, round 2

**Today: member**
- [x] **My tasks first.** My tasks is the first card on Today, with the meetings below it.
- [x] **No suggested hours to log, just a "Track time" button.** The hours card now has a project picker and a **Track time** stopwatch (start/stop). The 0,5 h / 1 h / … chips are gone. "Forgot to track? Add time manually" is still there as a small link, because without it members could not enter yesterday's time.
- [x] **Attendance belongs inside the meeting, not in a separate view.** Click a meeting in "Today's meetings" to open it. Inside you get **Track time** (clocks you in and logs the hours when you stop) or **Joining remotely**.

**Today: admin**
- [x] **Record attendance works like the member side.** Same "Today's meetings" list. Opening a meeting shows your own Track time plus the attendance list for everyone, with "Mark the rest present" and "Save attendance". The separate "Record attendance" card is gone.
- [x] **My tasks below the meetings.** On the admin Today, meetings come first and My tasks sits right under them.

**Projects**
- [x] **"My tasks" and "All tasks" instead of the Workstream / Person buttons.** One switch, used by both Board and Timeline. The timeline is always grouped by workstream now, so a hand-off happens in the task panel (Owner field).
- [x] **See all projects at once, on Board and Timeline.** The project picker starts on **All projects**. The board shows each project as its own block of workstream rows, and the timeline prefixes lanes with the project name. Dragging a card into another project's row moves it there and is logged.
- [x] **"Add project" opens a window.** **+ New project** (admins) opens a dialog: name, description, project lead, workstreams (one per line) and first tasks, each with a workstream and an owner. Only the name is required, so it can still be done in one step.

**Prototype**
- [x] The design prototype (https://claude.ai/artifact/WHbpHMGxg1gsofaMLcKudH) was updated with all of round 2, so the shareable link matches the app.

### 24 Oct 2026, round 1

- [x] Hours list under the hours card with day, from–to and duration, plus Edit (today and yesterday only for members).
- [x] A running meeting shows at the top of the list while it is being tracked.
- [x] Moved from the design prototype to a real TypeScript app.

## Open questions

- Is Shapers Core really 70 h/week? It is set in `TIER_HOURS`.
- The six meeting series are placeholders: Hub Assembly, Leadership Board, Academy Weekly, Project Leads Sync, Onboarding Circle, Community Social.
- Should members be able to create projects too? Right now only admins see **+ New project**; members can add ideas.

## Next up

1. Supabase for data and Google sign-in (the reducer actions map to the writes needed).
2. Google Calendar API, read only, for the meeting series.
3. Git, GitHub, Vercel.
4. Gamification, once the MVP holds.
