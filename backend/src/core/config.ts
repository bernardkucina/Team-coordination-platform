const bool = (value: string | undefined): boolean => value === 'true' || value === '1';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** Enables the sandbox login picker. */
  demoMode: bool(process.env.DEMO_MODE),
  /** Optional Europe/Ljubljana start time for the server clock, e.g. "2026-10-26T17:55". */
  demoNow: process.env.DEMO_NOW || null,
  cookieSecure: bool(process.env.COOKIE_SECURE),
  sessionDays: 14,
} as const;
