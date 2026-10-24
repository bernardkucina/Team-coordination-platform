# Hub Pulse

Tasks, hours and meeting attendance for a Global Shapers hub, with a member view and an admin (hub leadership) view.

Built with Next.js 14 (App Router) and TypeScript. Right now it runs on demo data in memory: every screen shares one state, so a task handed off on **Today** shows up on **Projects**, and a tracked meeting shows up in **Team › Attendance**. A page refresh resets everything.

## Run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # TypeScript check
npm run build      # production build
```

Use **Demo: view as Member / Admin** in the sidebar to switch roles.

## What's where

| Path | What it is |
|---|---|
| `src/lib/types.ts` | The data model: members, tiers, projects, tasks, meetings, attendance, time entries |
| `src/lib/data.ts` | Demo data (team and tasks from the Academy Project Miro board) |
| `src/lib/rules.ts` | Business rules: pace, superstars, attendance rate, when clock-in opens |
| `src/lib/store.tsx` | Shared state (React context + reducer). Every change goes through one action |
| `src/lib/time.ts` | Date and week helpers. `DEMO_TODAY` pins the demo to Fri 24 Oct 2026 |
| `src/app/*/page.tsx` | Routes: `/today`, `/projects`, `/analytics`, `/team` (admin only) |
| `src/components/` | Screens and pieces: hours card, tracking, board, timeline, task panel, team, analytics |

## Rules built in

- **Tiers:** ShapersGO 4 h/week, Shapers Impact 10 h/week, Shapers Core 70 h/week (`TIER_HOURS` in `types.ts`).
- **Behind:** below 5/7 of the weekly commitment by Friday.
- **Superstar:** on pace or ahead, and picked up at least 2 open tasks or added at least 2 ideas this month.
- **Logging hours:** members can log today or yesterday; admins up to 6 days back. Entries in that window can be edited.
- **Attendance rate:** showed up (in person or remote) ÷ (invited − excused). Excused absences never count against anyone.
- **Tasks:** one owner, any number of helpers. Every change (including drag and drop) is written to the task's activity history.

## Next steps

1. **Database and login:** Supabase (Postgres + Google sign-in). The reducer actions in `store.tsx` map one-to-one to the writes needed.
2. **Google Calendar (read only):** pull the six meeting series with the Calendar API (`calendar.readonly` scope) into `meetings`. Nothing is written back.
3. **Slack (read only, optional):** read channel links for tasks. Posting to Slack is an extra.
4. **Deploy:** push to GitHub and import the repo in Vercel.
