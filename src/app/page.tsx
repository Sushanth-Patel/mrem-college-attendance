import Link from 'next/link'
import { Reveal, TiltCard, CountUp } from '@/components/motion'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC] text-gray-900 flex flex-col justify-between font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. Top Navbar — Minimalistic Mobbin Standard */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 sm:px-12 py-3.5 flex items-center justify-between sticky top-0 z-50">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-sm text-gray-900 block leading-tight">
              MREM College
            </span>
            <span className="text-[10px] text-blue-700 font-semibold tracking-wide uppercase block">
              UGC Autonomous • JNTUH
            </span>
          </div>
        </Link>

        {/* Center Menu Links */}
        <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
          <Link href="/" className="px-3 py-1.5 rounded-lg text-blue-700 bg-blue-50 transition">
            Home
          </Link>
          <a href="#about" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition">
            About Institution
          </a>
          <a href="#features" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition">
            Academic Features
          </a>
          <a href="#contact" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition">
            Contact
          </a>
        </nav>

        {/* Single Primary Action Button */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm hover:shadow active:scale-95"
          >
            Enter Portal &rarr;
          </Link>
        </div>
      </header>

      {/* 2. Hero Section — Campus background at normal visibility */}
      <section className="relative min-h-[580px] lg:min-h-[640px] flex items-center overflow-hidden">
        {/* Campus photo at normal visibility */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/mrem_campus_hero.jpg')" }}
        />
        {/* Soft left gradient so text has pristine contrast while the campus image is fully visible on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-white/20" />

        <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-16 lg:py-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Hero Content — Exact layout as when the form was beside it */}
          <Reveal className="lg:col-span-7 text-left" staggerChildren="[data-hero-stagger]">
            <div data-hero-stagger className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/90 backdrop-blur-sm border border-blue-200 rounded-full text-xs font-semibold text-blue-700 mb-5 shadow-xs">
              <span>EAMCET Code: MREM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>UGC Autonomous • NAAC Accredited</span>
            </div>
            <h1 data-hero-stagger className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] max-w-2xl text-gray-900">
              MREM College{' '}
              <span className="text-blue-600">Attendance System</span>
            </h1>
            <p data-hero-stagger className="mt-5 text-base sm:text-lg text-gray-700 max-w-xl font-normal leading-relaxed">
              Smart, Simple &amp; Secure Attendance Management for Malla Reddy Engineering College and Management Sciences.
            </p>

            {/* CTA Buttons */}
            <div data-hero-stagger className="flex flex-wrap items-center gap-3 mt-8">
              <Link href="/login" className="btn-primary text-sm px-7 py-3 rounded-xl shadow-md hover:shadow-lg transition active:scale-95">
                Enter Portal &rarr;
              </Link>
              <a href="#features" className="btn-secondary text-sm px-6 py-3 rounded-xl bg-white/90 backdrop-blur-sm shadow-xs hover:bg-white">
                Learn More
              </a>
            </div>

            {/* Stat Badges */}
            <div data-hero-stagger className="flex flex-wrap items-center gap-4 mt-10">
              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-sm border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-900 leading-none block">5000+</span>
                  <span className="text-xs text-gray-500 font-medium">Students</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-sm border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-bold text-gray-900 leading-none block">300+</span>
                  <span className="text-xs text-gray-500 font-medium">Faculty Members</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right side is open with no form, revealing the college campus */}
        </div>
      </section>

      {/* 3. Features Section — Clean Card Grid */}
      <section id="features" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center mb-14">
          <span className="badge-blue text-xs">
            Academic Excellence
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3">
            Built for Academic Precision
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mt-3 leading-relaxed">
            Designed specifically for MREM faculty and students to streamline classroom operations and ensure total attendance transparency.
          </p>
        </div>

        <Reveal staggerChildren="[data-feature-card]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 */}
            <TiltCard data-feature-card maxTilt={4} lift={4} className="card-surface-hover p-6 text-left relative">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Real-Time Class Logs</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Instant attendance updates for all 7 daily periods with immediate percentage computation.
              </p>
            </TiltCard>

            {/* Card 2 */}
            <TiltCard data-feature-card maxTilt={4} lift={4} className="card-surface-hover p-6 text-left relative">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Hall Ticket Eligibility</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Official single-page printable attendance slip with verified signatures of Class In-Charge, HoD, and Principal.
              </p>
            </TiltCard>

            {/* Card 3 */}
            <TiltCard data-feature-card maxTilt={4} lift={4} className="card-surface-hover p-6 text-left relative">
              <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Department Allocations</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Faculty opt-in request workflows with dynamic new subject registration and Admin approvals.
              </p>
            </TiltCard>

            {/* Card 4 */}
            <TiltCard data-feature-card maxTilt={4} lift={4} className="card-surface-hover p-6 text-left relative">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-2">Audit History</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Clear human-readable audit trail of every attendance modification with complete transparency.
              </p>
            </TiltCard>
          </div>
        </Reveal>
      </section>

      {/* 4. About Section */}
      <section id="about" className="py-20 px-6 sm:px-12 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="badge-blue text-xs">
              About MREM
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 mb-5">
              Malla Reddy Engineering College &amp; Management Sciences
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Malla Reddy Engineering College and Management Sciences (MREM), established under the esteemed Malla Reddy Group of Institutions, is an autonomous institution affiliated with JNTUH and approved by AICTE.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              This dedicated Attendance Management Portal guarantees strict adherence to UGC academic regulations, JNTUH 75% attendance threshold monitoring, and seamless digital class logging across all 10 engineering departments.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="https://mrem.ac.in/"
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm"
              >
                Visit Official Website →
              </a>
              <Link
                href="/login"
                className="btn-secondary text-sm"
              >
                Access Portal
              </Link>
            </div>
          </div>

          <Reveal className="grid grid-cols-2 gap-4" staggerChildren="[data-stat-card]" from="scale">
            <TiltCard data-stat-card maxTilt={4} lift={3} className="card-surface p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1"><CountUp value={10} /></div>
              <div className="text-xs font-semibold text-gray-900">Departments</div>
              <div className="text-[11px] text-gray-500 mt-1">CSE, AIML, DS, CS, IT, ECE, EEE, MECH, CIVIL, MBA</div>
            </TiltCard>
            <TiltCard data-stat-card maxTilt={4} lift={3} className="card-surface p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1"><CountUp value={7} /></div>
              <div className="text-xs font-semibold text-gray-900">Daily Periods</div>
              <div className="text-[11px] text-gray-500 mt-1">09:30 AM to 04:10 PM IST</div>
            </TiltCard>
            <TiltCard data-stat-card maxTilt={4} lift={3} className="card-surface p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1"><CountUp value={75} suffix="%" /></div>
              <div className="text-xs font-semibold text-gray-900">Threshold Alert</div>
              <div className="text-[11px] text-gray-500 mt-1">Mandatory JNTUH attendance minimum</div>
            </TiltCard>
            <TiltCard data-stat-card maxTilt={4} lift={3} className="card-surface p-6 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1"><CountUp value={100} suffix="%" /></div>
              <div className="text-xs font-semibold text-gray-900">Digital Verification</div>
              <div className="text-[11px] text-gray-500 mt-1">Complete edit history &amp; integrity</div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* 5. Footer */}
      <footer id="contact" className="bg-gray-50 text-gray-900 pt-14 pb-8 px-6 sm:px-12 border-t border-gray-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-gray-200 text-sm">
          {/* Col 1: About MREM */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">About MREM</h4>
            <p className="text-gray-600 text-xs leading-relaxed">
              Malla Reddy Engineering College &amp; Management Sciences (MREM), UGC Autonomous, Affiliated to JNTUH, Approved by AICTE, Accredited by NAAC.
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Quick Links</h4>
            <ul className="space-y-2 text-gray-600 text-xs">
              <li>
                <a href="#about" className="hover:text-gray-900 transition">About College</a>
              </li>
              <li>
                <a href="#features" className="hover:text-gray-900 transition">Features</a>
              </li>
              <li>
                <a href="https://mrem.ac.in/" target="_blank" rel="noreferrer" className="hover:text-gray-900 transition">Official Website</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Portals</h4>
            <ul className="space-y-2 text-gray-600 text-xs">
              <li>
                <Link href="/login?role=student" className="hover:text-gray-900 transition">Student Portal</Link>
              </li>
              <li>
                <Link href="/login?role=faculty" className="hover:text-gray-900 transition">Faculty Portal</Link>
              </li>
              <li>
                <Link href="/login?role=admin" className="hover:text-gray-900 transition">Admin &amp; HoD Portal</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact */}
          <div>
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Contact Campus</h4>
            <div className="space-y-2.5 text-gray-600 text-xs">
              <p className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Kistapur, Medchal, Hyderabad, Telangana – 501401</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>info@mrem.ac.in</span>
              </p>
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>040-23792146 / 9346009999</span>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="max-w-6xl mx-auto pt-6 text-center text-[11px] text-gray-500">
          &copy; {new Date().getFullYear()} Malla Reddy Engineering College and Management Sciences (MREM). All rights reserved.
        </div>
      </footer>
    </div>
  )
}
