/**
 * meetings service: meeting series and meetings, read from the calendar and never written back.
 * Other services import only from this file.
 */
export { meetingsRouter } from './routes';
export {
  toMeeting, listSeries, getSeries, listMeetingRows, getMeetingRow, isInvited, setRecorded, importCalendarEvents, addToHubWideSeries,
} from './service';
export { parseIcs, seriesNameOf, memberEmailsOf, meetingIdOf, type CalendarEvent } from './ics';
export { calendarStatus, syncCalendar, syncIfStale } from './sync';
