# Shapers Hub

One place for a volunteer-run Global Shapers hub (20 people) to coordinate **tasks**, **hours** and **meeting attendance**. It replaces a Miro board, a hand-kept attendance sheet and untracked hours. Members see their own work; admins see the whole hub.

**Live:** https://hub-pulse-orcin.vercel.app

## What's in it

| Page | Members | Admins |
|---|---|---|
| **Today** | Their meetings (clock in, "can't come"), their tasks this week, hours against their weekly commitment | The same, plus calendar sync and the Slack card |
| **Projects** | Overview of projects and areas (join, leave, "I'm interested"), boards and timeline | Also create projects |
| **General tasks** | Small hub jobs anyone can take; whoever misses a meeting picks one within 14 days | Add jobs, see who still owes one |
| **Analytics** | Their own hours, tasks and attendance | The whole hub, plus who is drifting away and who stands out |
| **Team** | – | Members, tiers, attendance records |

The **super admin** only sees **Access**: who can sign in, who is an admin, Slack emails and the hub wifi.

## Run it locally

You need **Node.js 22+** and **Docker Desktop**.

```bash
npm install
cp backend/.env.example backend/.env   # set SUPER_ADMIN_PASSWORD if you want the super admin
npm run db:up                          # PostgreSQL in Docker
npm run db:migrate                     # create the tables
npm run db:seed                        # load the sample data from material/

npm run dev:backend                    # API on http://localhost:4000 (terminal 1)
npm run dev:frontend                   # app on http://localhost:3000 (terminal 2)
```

Sign in on http://localhost:3000 with a roster email, no password needed (demo mode):

- `ana.kovac@sandbox.example`: an admin
- `aljaz.hribar@sandbox.example`: a member
- The super admin: `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `backend/.env`

**Useful commands**

```bash
npm run typecheck                # all workspaces
npm test                         # backend unit tests
npm run db:seed -- -- --reset    # wipe the local database and seed again
```

If a page shows "Cannot find module", stop the frontend, delete `frontend/.next` and start it again.

## How the code is organised

```
shared/     Types and rules both sides compile against (the API contract). Change these first.
backend/    Express API + Prisma (PostgreSQL)
  src/services/<name>/   one folder per area: members, access, tasks, meetings, attendance, hours, analytics, slack
  src/gateway/           composes responses, e.g. /api/bootstrap (everything the app needs on load)
  prisma/schema/         one .prisma file per service, plus migrations/
  src/seed/              loads material/ and the sample projects
frontend/   Next.js 14 app
  src/lib/store.tsx      one shared state; every change updates the screen, then is saved through the API
  src/lib/api.ts         typed API client
  src/components/        screens and pieces
material/   The organisers' sample data (roster, hours, attendance, calendar). The seed reads it.
```

- **One app, folders like microservices.** Each backend service has its own routes, logic and schema. Services import each other only through their `index.ts`, in one direction: members → tasks/meetings → attendance → hours → analytics.
- **The server owns the rules.** The browser shows them, but the server enforces them.
- After changing a `.prisma` file, run `npm run db:migrate`.

## Rules worth knowing

- **Tiers and commitments:** Shapers Core 70 h, Shapers Impact 10 h, ShapersGO 4 h a week. This week's target is pro-rated by working days.
- **Logging hours:** members can log today or yesterday; admins up to 6 days back.
- **In the hub vs remote:** "in the hub" is only allowed from the Impact Hub wifi. The super admin saves its address on **Access › Save as hub wifi**; until one is saved, the check is off.
- **Clock-in:** opens 10 minutes before a meeting and stays open until it ends. "Can't come" works until it starts.
- **Missed meeting:** the member owes one General task within 14 days and gets a Slack message.
- **Google Calendar is read only.** Meetings are imported from it, never written back.
- **Slack is optional.** Without `SLACK_BOT_TOKEN` nothing is sent, and the app shows reminders itself while it is open.

## Deploy

The live app is the Vercel project `hub-pulse` with a Supabase PostgreSQL database. The Express API runs inside the Next.js app as one serverless function.

```bash
npx vercel deploy --prod
```

The build runs the database migrations and seeds an empty database by itself. Environment variables are set in Vercel (see `backend/.env.example` for the list). Never commit `.env` files.
