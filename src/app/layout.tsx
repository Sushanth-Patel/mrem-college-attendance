import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'MREM College Attendance System',
  description: 'Official Attendance Platform for Malla Reddy Engineering College & Management Sciences (MRECMS / MREM)',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MREM Attendance',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* CloudWatch Pulse Privacy-First Live Telemetry (Zero Cookies, Zero PII, OWASP Safe) */}
        <script
          defer
          src="https://cloudwatch-pulse-monitor.netlify.app/tracker.js"
          data-site="mrem-college-attendance.vercel.app"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
