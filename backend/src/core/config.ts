const bool = (value: string | undefined): boolean => value === 'true' || value === '1';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** Enables email-only sign-in for roster members (no password). */
  demoMode: bool(process.env.DEMO_MODE),
  /** Optional Europe/Ljubljana start time for the server clock, e.g. "2026-10-26T17:55". */
  demoNow: process.env.DEMO_NOW || null,
  cookieSecure: bool(process.env.COOKIE_SECURE),
  sessionDays: 14,
  /**
   * The super admin is made up: it is not a member and not in the database. It signs in with this email and
   * password and can only manage access. Without SUPER_ADMIN_PASSWORD the super admin cannot sign in.
   */
  superAdmin: {
    name: 'super admin',
    email: (process.env.SUPER_ADMIN_EMAIL || 'super.admin@hub-pulse.app').toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || null,
  },
  /**
   * The calendar's public iCal address (Google Calendar: Settings › your calendar › "Public address in iCal format").
   * Read only: the platform never writes to the calendar. Without it, meetings come from the seed only.
   */
  calendarIcsUrl: process.env.CALENDAR_ICS_URL || null,
  /** Sync again when the last sync is older than this. */
  calendarSyncMinutes: Number(process.env.CALENDAR_SYNC_MINUTES ?? 15),
  /** Serve the built Next.js frontend from this process (one app, one port), as in production. */
  serveFrontend: bool(process.env.SERVE_FRONTEND),
} as const;
