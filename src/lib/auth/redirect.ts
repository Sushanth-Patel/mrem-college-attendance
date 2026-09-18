import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/auth/types'

export function redirectByRole(role: UserRole) {
  if (role === 'admin') {
    redirect('/admin/dashboard')
  }
  if (role === 'faculty') {
    redirect('/faculty/dashboard')
  }
  redirect('/student/dashboard')
}
