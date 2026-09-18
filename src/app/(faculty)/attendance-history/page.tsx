import { getFacultyAttendanceHistory } from '@/lib/faculty/history'
import FacultyAttendanceHistory from './FacultyAttendanceHistory'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Past Classes & Attendance Corrections | Faculty Portal',
  description: 'View conducted attendance sessions and correct student attendance records.',
}

export default async function AttendanceHistoryPage() {
  const { sessions, filterOptions } = await getFacultyAttendanceHistory()

  return <FacultyAttendanceHistory sessions={sessions} filterOptions={filterOptions} />
}
