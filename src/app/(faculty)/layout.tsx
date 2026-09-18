import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import SignOutButton from '@/components/SignOutButton'

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user
  try {
    user = await getCurrentUser()
    if (user.role !== 'faculty' && user.role !== 'admin') {
      redirect('/dashboard')
    }
  } catch {
    redirect('/login')
  }

  const isAdmin = user.role === 'admin'

  const facultyNavItems = [
    { href: '/today', label: "Today's Schedule", icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/take-attendance', label: 'Take Class Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { href: '/attendance-history', label: 'Past Classes & Corrections', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
    { href: '/summaries', label: 'My Class Summaries', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/detained', label: 'Detained Students', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  ]

  const adminNavItems = [
    { href: '/admin/dashboard', label: 'Admin Command', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { href: '/sections', label: 'Sections & Terms', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { href: '/subjects', label: 'Subjects & Units', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { href: '/timetable', label: 'Timetable Grid', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/calendar', label: 'Calendar & Holidays', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM9 16l2 2 4-4' },
    { href: '/roster', label: 'Roster CSV Upload', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { href: '/signup-requests', label: 'Signup Requests', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { href: '/reports', label: 'Reports & Exports', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/alerts', label: 'Low-Attendance Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { href: '/audit-log', label: 'Audit Trail', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFBFC] text-gray-900 flex flex-col md:flex-row">
      {/* Unified Staff Sidebar — Mobbin / Notion style */}
      <aside className="w-full md:w-64 sidebar-light p-5 flex flex-col justify-between md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="space-y-5">
          {/* Brand Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${
              isAdmin ? 'bg-violet-600' : 'bg-blue-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-sm text-gray-900 block">
                {isAdmin ? 'Staff & HoD Portal' : 'Faculty Portal'}
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-wider ${isAdmin ? 'text-violet-600' : 'text-blue-600'}`}>
                {isAdmin ? 'Admin Privileges Active' : 'Attendance & Marking'}
              </span>
            </div>
          </div>

          {/* Faculty Marking Navigation */}
          <div>
            <span className="section-label block">
              Faculty Marking
            </span>
            <nav className="space-y-0.5">
              {facultyNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                >
                  <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Integrated Admin Section (Visible when user is Admin/HoD) */}
          {isAdmin && (
            <div className="pt-3 border-t border-gray-100">
              <span className="section-label text-violet-500 block">
                Administration & HoD
              </span>
              <nav className="space-y-0.5">
                {adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-item-admin"
                  >
                    <svg className="w-4 h-4 text-violet-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>

        {/* User Card */}
        <div className="pt-4 border-t border-gray-100 mt-6 flex items-center justify-between text-sm">
          <div className="overflow-hidden pr-2">
            <p className="font-semibold text-gray-900 truncate text-xs">{user.fullName}</p>
            <p className={`text-[10px] font-medium truncate capitalize ${isAdmin ? 'text-violet-600' : 'text-blue-600'}`}>{user.role}</p>
          </div>
          <SignOutButton
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            showText={false}
            showIcon={true}
            title="Sign Out"
          />
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto w-full">
        {children}
      </main>
    </div>
  )
}
