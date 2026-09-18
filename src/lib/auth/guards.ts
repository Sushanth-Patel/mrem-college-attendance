import { getCurrentUser } from '@/lib/auth/session'
import type { UserRole } from '@/lib/auth/types'

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Permission denied for this resource')
  }
  return user
}

export async function requireAdmin() {
  return requireRole(['admin'])
}

export async function requireFaculty() {
  return requireRole(['faculty'])
}

export async function requireStudent() {
  return requireRole(['student'])
}
