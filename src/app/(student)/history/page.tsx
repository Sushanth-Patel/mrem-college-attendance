import { getStudentDashboardData } from '@/lib/student/dashboard'
import StudentHistoryClient from './StudentHistoryClient'

export const dynamic = 'force-dynamic'

export default async function StudentHistoryPage() {
  const data = await getStudentDashboardData().catch(() => null)

  const history = data && 'allHistory' in data ? data.allHistory : []
  const rollNo = data && 'studentProfile' in data ? data.studentProfile.rollNo : undefined
  const studentName = data && 'studentProfile' in data ? data.studentProfile.fullName : undefined

  return (
    <StudentHistoryClient
      history={history}
      rollNo={rollNo}
      studentName={studentName}
    />
  )
}
