import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'

export default async function DashboardRouterPage() {
  const user = await getCurrentUser()

  if (user.role === 'admin') {
    redirect('/admin/dashboard')
  }
  if (user.role === 'faculty') {
    redirect('/faculty/dashboard')
  }
  redirect('/student/dashboard')
}
