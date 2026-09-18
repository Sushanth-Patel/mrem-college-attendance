'use client'

import Link from 'next/link'
import type { getStudentDashboardData } from '@/lib/student/dashboard'

type DashboardData = Awaited<ReturnType<typeof getStudentDashboardData>>

type Props = {
  data: DashboardData
}

export default function AttendanceSlipView({ data }: Props) {
  const {
    studentProfile,
    totalHeld,
    totalAttended,
    overallPct,
    overallDisplayPct,
    standingTier,
    standingLabel,
    subjectBreakdown,
  } = data

  const isEligible = overallPct !== null && overallPct >= 75
  const isCondonation = overallPct !== null && overallPct >= 65 && overallPct < 75
  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16 print:max-w-none print:p-0 print:m-0 print:pb-0 print-single-page">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-single-page {
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Floating Action Strip (Hidden during Print / PDF Export) */}
      <div className="flex items-center justify-between print:hidden p-3 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xs">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </Link>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
        >
          <span>🖨️</span>
          <span>Print / Save Official Slip (PDF)</span>
        </button>
      </div>

      {/* Official Physical / Printable Attendance Slip Certificate */}
      <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 shadow-lg print:border-none print:shadow-none print:p-0 print:m-0 space-y-4 print:space-y-2.5 text-slate-900 font-sans print-single-page">
        {/* College Header */}
        <div className="text-center border-b-2 border-slate-900 pb-3 print:pb-2 space-y-0.5">
          <h1 className="text-lg sm:text-xl print:text-base font-black uppercase tracking-tight text-slate-950 leading-tight">
            MALLA REDDY ENGINEERING COLLEGE AND MANAGEMENT SCIENCES
          </h1>
          <p className="text-[11px] print:text-[9.5px] font-bold text-slate-700 uppercase tracking-wide">
            (An UGC Autonomous Institution)
          </p>
          <p className="text-[10px] print:text-[8.5px] text-slate-600">
            Accredited by NBA &amp; NAAC | Approved by AICTE, New Delhi &amp; Affiliated to JNTUH, Hyderabad
          </p>
          <p className="text-[9.5px] print:text-[8px] text-slate-500 font-medium">
            Kistapur, Medchal, Medchal-Malkajgiri Dist - 501 401, Telangana
          </p>
        </div>

        {/* Certificate Title */}
        <div className="text-center py-2 print:py-1 bg-slate-50 border border-slate-200 rounded-xl print:bg-transparent print:border-b print:border-slate-400">
          <h2 className="text-xs print:text-[11px] font-black uppercase tracking-wider text-slate-900">
            Semester Attendance Clearance &amp; Hall Ticket Eligibility Slip
          </h2>
          <p className="text-xs print:text-[10px] font-bold text-indigo-900 mt-0.5 font-mono">
            Academic Year: {studentProfile.academicYear} • B.Tech {studentProfile.semester}
          </p>
        </div>

        {/* Student Details Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:gap-2 p-3 print:p-2 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs print:text-[10px] print:bg-transparent print:border-slate-300">
          <div>
            <span className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</span>
            <span className="font-bold text-slate-900 text-xs print:text-[10.5px] block mt-0.5">{studentProfile.fullName}</span>
          </div>
          <div>
            <span className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Roll No / Hall Ticket</span>
            <span className="font-mono font-black text-indigo-700 text-xs print:text-[10.5px] block mt-0.5">{studentProfile.rollNo}</span>
          </div>
          <div>
            <span className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Branch &amp; Section</span>
            <span className="font-bold text-slate-800 text-xs print:text-[10.5px] block mt-0.5">{studentProfile.branchCode} - Sec {studentProfile.sectionName}</span>
          </div>
          <div>
            <span className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Attestation Date</span>
            <span className="font-mono font-bold text-slate-800 text-xs print:text-[10.5px] block mt-0.5">{currentDateStr}</span>
          </div>
        </div>

        {/* Course-Wise Attendance Matrix (All Timetable Subjects Enrolled) */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden print:border-slate-400 print:rounded-lg">
          <table className="w-full text-left text-xs print:text-[10px] border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[9.5px] print:text-[8.5px] font-bold border-b border-slate-300 print:bg-slate-200">
              <tr>
                <th className="py-2 print:py-1 px-3 print:px-2 text-center w-10 border-r border-slate-200">S.No</th>
                <th className="py-2 print:py-1 px-3 print:px-2 border-r border-slate-200">Course Code</th>
                <th className="py-2 print:py-1 px-3 print:px-2 border-r border-slate-200">Registered Course Title</th>
                <th className="py-2 print:py-1 px-3 print:px-2 text-center border-r border-slate-200">Conducted</th>
                <th className="py-2 print:py-1 px-3 print:px-2 text-center border-r border-slate-200">Attended</th>
                <th className="py-2 print:py-1 px-3 print:px-2 text-right border-r border-slate-200">Percentage</th>
                <th className="py-2 print:py-1 px-3 print:px-2 text-center">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjectBreakdown.map((sub, idx) => (
                <tr key={sub.subjectId} className="even:bg-slate-50/50">
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 text-center font-mono border-r border-slate-200 text-slate-500">{idx + 1}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 font-mono font-bold text-indigo-700 border-r border-slate-200">{sub.subjectCode}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 font-semibold text-slate-900 border-r border-slate-200">{sub.subjectName}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 text-center font-mono border-r border-slate-200">{sub.periodsHeld}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-200">{sub.periodsAttended}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 text-right font-mono font-bold border-r border-slate-200">{sub.displayPct}</td>
                  <td className="py-1.5 print:py-0.5 px-3 print:px-2 text-center">
                    {sub.isShortage ? (
                      <span className="font-bold text-rose-700 text-[9.5px]">Shortage</span>
                    ) : (
                      <span className="font-bold text-emerald-700 text-[9.5px]">Eligible</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Cumulative Aggregate Row */}
              <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 print:bg-slate-200">
                <td colSpan={3} className="py-2 print:py-1 px-3 print:px-2 text-right uppercase tracking-wider text-[10px] border-r border-slate-300">
                  Cumulative Academic Aggregate:
                </td>
                <td className="py-2 print:py-1 px-3 print:px-2 text-center font-mono text-xs print:text-[10px] border-r border-slate-300">{totalHeld}</td>
                <td className="py-2 print:py-1 px-3 print:px-2 text-center font-mono text-xs print:text-[10px] text-emerald-800 border-r border-slate-300">{totalAttended}</td>
                <td className="py-2 print:py-1 px-3 print:px-2 text-right font-mono text-sm print:text-xs font-black text-slate-950 border-r border-slate-300">
                  {overallDisplayPct}
                </td>
                <td className="py-2 print:py-1 px-3 print:px-2 text-center">
                  <span
                    className={`font-black text-[10px] uppercase ${
                      isEligible ? 'text-emerald-700' : isCondonation ? 'text-amber-700' : 'text-rose-700'
                    }`}
                  >
                    {standingLabel}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calculation Note */}
        <div className="p-2.5 print:p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10.5px] print:text-[9px] text-slate-600 flex items-center justify-between">
          <span>
            <strong>Calculation Method:</strong> Aggregate is computed as total classes attended ({totalAttended}) divided by all subjects&apos; conducted classes ({totalHeld}):
          </span>
          <span className="font-mono font-black text-slate-900 text-xs print:text-[9.5px] ml-2">
            ({totalAttended} / {totalHeld || 1}) × 100 = {overallDisplayPct}
          </span>
        </div>

        {/* Official Standing Verdict Banner */}
        <div
          className={`p-3 print:p-2 rounded-xl border text-xs print:text-[9.5px] flex items-center justify-between ${
            isEligible
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : isCondonation
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div>
            <span className="font-black uppercase tracking-wider text-[10px] print:text-[8.5px] block">
              Official Examination Eligibility Status
            </span>
            <p className="mt-0.5 font-medium leading-snug">
              {isEligible
                ? 'Candidate satisfies the minimum 75.0% attendance requirement under autonomous university regulations. Eligible for Semester End Examinations (SEE).'
                : isCondonation
                ? 'Candidate is in the condonation range (65.0% - 74.9%). Requisite medical/duty documentation and condonation approval required.'
                : 'Candidate is below 65.0% aggregate attendance threshold. Detained from semester end examinations under JNTUH/Autonomous guidelines.'}
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4 font-mono font-black text-lg print:text-sm">
            {overallDisplayPct}
          </div>
        </div>

        {/* Attestation & Signature Blocks (Student, Class Teacher, HoD, Principal) */}
        <div className="pt-5 print:pt-3 grid grid-cols-4 gap-3 print:gap-2 text-center text-xs print:text-[9.5px]">
          <div className="space-y-3 print:space-y-1">
            <div className="h-8 print:h-5 font-bold text-slate-900 flex items-end justify-center text-xs print:text-[9.5px]">
              {studentProfile.fullName}
            </div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 text-[11px] print:text-[9px]">
              Candidate Signature
            </div>
          </div>
          <div className="space-y-3 print:space-y-1">
            <div className="h-8 print:h-5 font-bold text-slate-700 flex items-end justify-center text-xs print:text-[9.5px]">
              Mrs. K. Parameswari
            </div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 text-[11px] print:text-[9px]">
              Class In-Charge
            </div>
          </div>
          <div className="space-y-3 print:space-y-1">
            <div className="h-8 print:h-5 font-bold text-slate-700 flex items-end justify-center text-xs print:text-[9.5px]">
              Mr. G. Chakrapani
            </div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 text-[11px] print:text-[9px]">
              Head of Department (HoD)
            </div>
          </div>
          <div className="space-y-3 print:space-y-1">
            <div className="h-8 print:h-5 font-bold text-slate-700 flex items-end justify-center text-xs print:text-[9.5px]">
              Dr. M. Sreedhar Reddy
            </div>
            <div className="border-t border-slate-400 pt-1 font-bold text-slate-700 text-[11px] print:text-[9px]">
              Principal, MREM (A)
            </div>
          </div>
        </div>

        {/* Verification Footer */}
        <div className="pt-2 print:pt-1 border-t border-slate-200 text-[9.5px] print:text-[8px] text-slate-400 flex items-center justify-between">
          <span>Official Digital Verification • MREM Autonomous College Attendance System</span>
          <span>Generated: {currentDateStr}</span>
        </div>
      </div>
    </div>
  )
}
