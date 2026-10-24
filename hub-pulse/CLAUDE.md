# Hub Pulse

Hackathon app for a Global Shapers hub: tasks, hours against each tier's weekly commitment, and meeting attendance, with a member view and an admin (hub leadership) view. Next.js 14 + TypeScript (strict). Demo data lives in memory and resets on refresh.

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
- `src/lib/sandbox.json`: generated from `../material` (roster, hours, meetings.ics, attendance) by `python3 scripts/import_sandbox.py`. Don't edit by hand; rerun the script.
- `src/lib/data.ts`: builds the demo data: the 20 sandbox members, areas and projects from "PROJEKTI GS za Shapers GO", tasks, meetings, attendance and this week's time entries.
- `src/lib/rules.ts`: business rules (pace, superstars, attendance rate, clock-in window, how far back hours can be logged).
- `src/lib/store.tsx`: one shared state for all screens. Every change is a reducer action.
- `src/app/<route>/page.tsx`: `/today`, `/projects`, `/analytics`, `/team` (admin only).
- `src/components/`: screens and pieces. Projects live in `components/projects/`.

## Rules to keep

- **Every task change goes through `change()` in `ProjectsView`** (or the `updateTask` action), so it is written to the task's activity history with who did it.
- **Members can edit priority, deadline and owner too.** The history is the safeguard, not permissions.
- **One owner per task, any number of helpers.**
- **Meetings come from Google Calendar and are read only.** Never create or edit them. Slack is read only too.
- **Members log time for today or yesterday only.** Admins can go back 6 days. See `MEMBER_LOG_DAYS_BACK`.
- **Colors come from the CSS variables in `globals.css`** (Nalepke brand kit, see `BRAND.md`). Don't hard-code hex colors in components; use `var(--…)`.
- **The demo is pinned to Thursday 22 Oct 2026, 19:10** (`DEMO_TODAY`, `DEMO_NOW`), while the Shapers Voice meeting from the sandbox calendar is happening. Saturday 24 Oct has no meetings, so Track meeting would have nothing to show.
- **Demo logins:** member Žiga Krajnc (Impact), admin Ana Kovač (Core), as in `../PLAN.md`.
- **Projects have areas as board rows.** Each project has one main area; the areas working on it are its workstreams. Planned projects (`status: 'planned'`) have no board.

## Change requests

Add new requests at the top in the same format. Mark them `[x]` when done and say what was built.

### 24 Oct 2026, round 4: analytics

What matters, in her words: hours logged, tasks finished, meeting attendance, how much was done remote vs live in the hub, and how I meet the weekly commitment.

- [x] **Hub vs remote is now recorded.** Track time and "Add time manually" have an **In the hub / Remote** switch; tracked meetings take it from the clock-in (in person = hub). Every time entry has a `place`.
- [x] **My analytics** shows exactly the five things: KPIs (hours, weeks at commitment with streak, tasks finished, attendance rate, % in the hub), hours per week stacked hub/remote with the commitment line, a week-by-week commitment list (met / short / on pace), tasks finished per week with the latest ones, and attendance by series with recent meetings.
- [x] **Admin analytics** got the same lens: a hub % KPI, tasks finished over the last weeks, the delivered-hours chart split hub/remote, and a **Members** table (this week, weeks at commitment, hours, tasks, attendance, hub/remote).
- [x] **Tasks remember when they were finished** (`doneAt`), so "tasks finished per week" counts real changes.
- Note: the sandbox hours don't say where people worked, so the hub/remote split of past weeks and past tasks-per-week are generated per person in `data.ts` (`hubShare`, `TASKS_PER_WEEK`). Everything logged in the app is real.

### 24 Oct 2026, round 3: real project data

- [x] **Projects overview from "PROJEKTI GS za Shapers GO".** Projects now opens on **Overview**: the 7 running projects as cards (number, main area, tags, description, roles, team, task progress), a filter by area, and **Join / Leave** (you can't leave your last project, because everyone stays in at least one). **Open board** jumps to that project on **Board & timeline**.
- [x] **Academy Project stays** as an 8th project next to the 7 from the document.
- [x] **Board rows are areas.** Each project's rows are the areas working on it (e.g. Shape Talk: Voice, Tech, Culture). Academy's old Miro workstreams were mapped onto areas. Admins can add an area to a project.
- [x] **Areas section.** The 7 areas with what they do; members can join an area directly. Strategy and Finance are Core-only; Voice and Tech are marked as meeting on their own.
- [x] **Planned projects** (Inkubator, Hekatoni, Shape Clash, Shape Cast …) with an **I'm interested** button.
- [x] **New project dialog** now asks for main area, the areas that work on it, roles, lead and first tasks.
- [x] **Real sandbox people and history.** The 20 roster members, their 6 weeks of hours, the 6 meeting series from meetings.ics and the attendance records replace the made-up data.
- [x] **Pace is pro-rated by working days** (Thursday = 80 % of the commitment), as in `../PLAN.md`.

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

- Which tasks each project really has: the ones in `data.ts` are examples built from the roles in the projects document.
- Which areas work on each project: chosen from the project descriptions, please correct.
- Should members be able to create projects too? Right now only admins see **+ New project**; members can add ideas.

## Next up

1. Supabase for data and Google sign-in (the reducer actions map to the writes needed).
2. Google Calendar API, read only, for the meeting series.
3. Git, GitHub, Vercel.
4. Gamification, once the MVP holds.
