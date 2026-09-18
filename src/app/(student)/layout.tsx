import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import SignOutButton from '@/components/SignOutButton'
import StudentHeaderNav from './StudentHeaderNav'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user
  try {
    user = await getCurrentUser()
    if (user.role !== 'student') {
      redirect('/dashboard')
    }
  } catch {
    redirect('/login')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const navItems = [
    { href: '/student/dashboard', label: 'My Attendance' },
    { href: '/history', label: 'Day-by-Day Log' },
    { href: '/student/slip', label: 'Attendance Slip' },
    { href: '/student/profile', label: 'My Profile' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-gray-900 flex flex-col">
      <StudentHeaderNav
        user={{ fullName: user.fullName, email: user.email }}
        avatarUrl={userProfile?.avatar_url || null}
      />

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
