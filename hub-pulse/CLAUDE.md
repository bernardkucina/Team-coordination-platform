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
- `src/lib/data.ts`: demo data (team and tasks from the Academy Project Miro board).
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
- **Colors come from the CSS variables in `globals.css`** (Global Shapers palette). Don't hard-code new blues.
- **The demo is pinned to Friday 24 Oct 2026, 12:40** (`DEMO_TODAY`, `DEMO_NOW`) so "happening now" is stable.

## Change requests

Add new requests at the top in the same format. Mark them `[x]` when done and say what was built.

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
