export type UserRole = 'student' | 'faculty' | 'admin'

export type AuthenticatedUser = {
  id: string
  role: UserRole
  fullName: string
  email: string
}
