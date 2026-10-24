/** attendance service: who showed up to which meeting. Other services import only from this file. */
export { attendanceRouter } from './routes';
export { listRecords, markSelf, setSelfMode } from './service';
export { attendanceStats, meetingPhase, canClockIn, canExcuse, type StatsMeeting } from './rules';
