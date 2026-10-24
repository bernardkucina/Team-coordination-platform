# Plan: Team coordination platform

Agreed on Saturday 2026-10-24 after reviewing `BRIEF.md`, `SANDBOX.md` and `SPECIFICATION.md`. Submission deadline: **Sunday 2026-10-25, 14:00**.

## Product scope

The platform has four parts: **tasks, hours, attendance and admin analytics**.

### Tasks
- Members see all projects, edit and hand off their own tasks, and have a **"My tasks"** view across all projects.
- Admins create projects in one step and assign or reassign any task.
- A task has a title, a project, one assignee, a priority (low/medium/high), a due date and a status (to do/in progress/done).
- Every change is recorded in a **task history** saying who changed what and when. Admins use it to see who finished what, and when.

### Hours
- A member logs a date, a number of hours and an optional note or project.
- Weeks start on **Monday**, matching the sample data.
- **"Behind" for the current week is pro-rated by working days.** On Wednesday, for example, an Impact member is expected to have 6 of their 10 hours. Past weeks are compared against the full commitment.
- Weekly commitments: Core 70, Impact 10, GO! 4.

### Attendance
- **Clock-in:** a member taps "I'm here" or "Remote" from 15 minutes before a meeting starts until 30 minutes after.
- **Excused absence:** a member marks "can't come" before a meeting, which records them as excused.
- **No record:** a series member with no record after the meeting counts as unexcused.
- **Admin edits:** an admin can bulk-edit any meeting's attendance in one table.

### Admin panel
- **Analytics:**
  - **Member table:** this week's hours vs commitment, 6-week average, attendance rate, tasks done, and a **"drifting away" flag**. The flag goes up, for example, when someone is under 50% of their hours for two weeks *and* has missed meetings.
  - **Tier view:** each tier's hours compliance over time.
  - **Series view:** each meeting series' attendance trend week by week.
  - **Member page:** one member's full history of hours, attendance and tasks.
- **Members:** edit a member's tier and admin role, and mark someone inactive.
- **Projects and tasks:** create a project in one step, and assign or reassign any task.
- **Attendance:** the bulk table for recording or correcting any meeting.
- **Calendar:** a "Sync now" button and the time of the last sync.

## Technical setup

### Stack and repo
- **TypeScript everywhere**, in one npm workspaces repository:
  - `frontend/`: React with Vite.
  - `backend/`: Node.
  - `shared/`: API request and response types that both sides import, so an API change breaks the build instead of the demo.
- **Database:** PostgreSQL with **Prisma** for the schema, migrations and seed script.

### Backend structure
- One deployable app, with modules split by feature: `members/auth`, `tasks`, `hours`, `attendance`, `meetings`, `analytics`.
- **Admin is a role checked inside each module**, not a separate service. More modules can be split out later if needed.

### Hosting
- **Railway**, as one service with PostgreSQL in the same project.
- The backend serves the built React app, so everything runs on **one domain**. This avoids cross-domain cookie and CORS problems with Google sign-in.
- Set up the public domain on Saturday so it can be registered in the Google OAuth settings early.

### Login
- **Sandbox picker:** choose any of the 20 roster members and log in as them. It's only available when `DEMO_MODE=true`.
- **Real Google sign-in** for two dedicated demo accounts:
  - The **admin** account is linked to Ana Kovač (Core, admin).
  - The **member** account is linked to Žiga Krajnc (Impact).
  - Any other Google account is rejected with "not a member".
  - The Google OAuth app stays in **Testing** mode with only these two accounts added as test users, so Google doesn't need to review it.
- **Admin rights** come from the roster's `admin` column, not from Google.
- **Both login methods** end in the same httpOnly session cookie, so the rest of the app doesn't care how someone signed in.

### Google Calendar
- Import `material/meetings.ics` into a **public** Google Calendar, then read it with an **API key**, without OAuth. The platform never creates or edits events.
- Copy the events into the database **keyed by event UID**, so attendance records point at a stable meeting ID.
- Sync when the server starts, every 15 minutes, and when an admin clicks "Sync now".

### Seed data
- Load `roster.xlsx`, `hours.xlsx` and `attendance flat.xlsx` from `material/`, which gives six weeks of history.
- Create **3–4 sample projects** (for example Summer School 2027, Grant applications and Shape Talks season) with **about 30 tasks** spread across members. Some are already done, with completion dates over the past six weeks.

## Build order

| When | What |
| --- | --- |
| **Sat by ~15:00** | App deployed to the public URL, database seeded, both login methods working |
| **Saturday afternoon and evening** | Tasks |
| **Saturday evening** | Hours |
| **Sunday morning** | Calendar sync and attendance, then analytics |
| **Sun by 13:30** | Infrastructure page and submission paragraph |
| **Only with time to spare** | Extras (below) |

Deployment and login come first because they're the riskiest, with the Google settings and the public URL. Analytics comes last because it needs data from the other three parts.

## Extras (only if the core is finished)

- **Weekly summary for admins:** Claude summarises the hours, attendance and task data, for example who is drifting away and which series is losing attendance. It only reads data and never changes it.
- **Slack:** meeting reminders, or an activity signal from posts, reactions and presence. **The core platform never writes to Slack.**

## Risks

- **Time is the main risk.** If Sunday gets tight, cut the "drifting away" flag and the tier trends before cutting attendance.
