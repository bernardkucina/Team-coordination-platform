/** Business rule constants that the frontend and the backend must agree on. */

/** Members can log hours for today and this many days back. */
export const MEMBER_LOG_DAYS_BACK = 1;
/** Days after a missed meeting to pick a General task. */
export const MAKEUP_DAYS = 14;
/** Admins can log and edit hours this many days back. */
export const ADMIN_LOG_DAYS_BACK = 6;
/** Clock-in opens this many minutes before a meeting starts and stays open until it ends. */
export const CLOCK_IN_OPENS_MIN = 10;
/** Working days per week used to pro-rate the current week's commitment (Mon–Fri). */
export const WORKING_DAYS = 5;
/** "Drifting away": below this share of the commitment in each of the last two finished weeks... */
export const DRIFT_HOURS_SHARE = 0.5;
/** ...and missed at least this many meetings in those two weeks. */
export const DRIFT_MISSED_MEETINGS = 1;
