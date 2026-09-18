'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

type Props = {
  user: {
    fullName: string
    email: string
  }
  avatarUrl: string | null
}

export default function StudentHeaderNav({ user, avatarUrl }: Props) {
  const pathname = usePathname()

  // If on the official attendance slip page, do not render the portal navigation header at all
  if (pathname === '/student/slip') {
    return null
  }

  const navItems = [
    { href: '/student/dashboard', label: 'My Attendance' },
    { href: '/history', label: 'Day-by-Day Log' },
    { href: '/student/slip', label: 'Attendance Slip' },
    { href: '/student/profile', label: 'My Profile' },
  ]

  return (
    <header className="glass-header px-6 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-50 print:hidden">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-sm text-gray-900 block leading-tight">Student Academic Portal</span>
          <span className="text-[10px] text-indigo-600 font-semibold tracking-wider uppercase">MREM Autonomous</span>
        </div>
      </div>

      <nav className="flex items-center gap-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}

        <div className="h-5 w-px bg-gray-200 mx-2" />

        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user.fullName}
              className="w-8 h-8 rounded-full object-cover border border-indigo-300 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
              {user.fullName?.slice(0, 2).toUpperCase() || 'ST'}
            </div>
          )}
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-gray-900 leading-tight">{user.fullName}</p>
            <p className="text-[10px] text-gray-500 font-mono leading-tight">{user.email}</p>
          </div>
          <SignOutButton
            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition text-xs flex items-center gap-1"
            showIcon={true}
            showText={false}
            title="Sign Out"
          />
        </div>
      </nav>
    </header>
  )
}
