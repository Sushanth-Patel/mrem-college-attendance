import { getStudentDashboardData } from '@/lib/student/dashboard'
import { redirect } from 'next/navigation'
import AttendanceSlipView from './AttendanceSlipView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Attendance Clearance & Hall Ticket Slip | Student Portal',
  description: 'Official semester attendance clearance slip and examination eligibility certificate.',
}

export default async function StudentAttendanceSlipPage() {
  const data = await getStudentDashboardData().catch(() => null)

  if (!data) {
    redirect('/student/dashboard')
  }

  return <AttendanceSlipView data={data} />
}
