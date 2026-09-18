import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { fetchStudentSubjectAttendance } from '@/lib/attendance/summary'

type ReportRow = {
  student_id: string
  subject_id: string
  periods_held: number
  periods_attended: number
  attendance_pct: number | null
}

async function fetchAttendanceRows(sectionId?: string): Promise<ReportRow[]> {
  await requireAdmin()
  const supabase = await createClient()

  let studentIds: string[] | undefined
  if (sectionId) {
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', sectionId)
    if (studentsError) throw studentsError
    studentIds = (students ?? []).map((student) => student.id)
    if (studentIds.length === 0) return []
  }

  const rows = await fetchStudentSubjectAttendance({ studentIds })
  return rows.map((row) => ({
    student_id: row.studentId,
    subject_id: row.subjectId,
    periods_held: row.periodsHeld,
    periods_attended: row.periodsAttended,
    attendance_pct: row.attendancePct,
  }))
}

export async function generateAttendanceExcel(sectionId?: string): Promise<Buffer> {
  const rows = await fetchAttendanceRows(sectionId)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Attendance')
  sheet.columns = [
    { header: 'Student ID', key: 'student_id', width: 40 },
    { header: 'Subject ID', key: 'subject_id', width: 40 },
    { header: 'Periods Held', key: 'periods_held', width: 15 },
    { header: 'Periods Attended', key: 'periods_attended', width: 18 },
    { header: 'Attendance %', key: 'attendance_pct', width: 15 },
  ]
  rows.forEach((row) => {
    sheet.addRow({
      ...row,
      attendance_pct: row.attendance_pct === null ? 'N/A' : row.attendance_pct,
    })
  })
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function generateAttendancePdf(sectionId?: string): Promise<Uint8Array> {
  const rows = await fetchAttendanceRows(sectionId)
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([842, 595])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawText('Attendance Report', { x: 40, y: 560, size: 18, font: titleFont })
  let y = 530
  page.drawText('Student ID | Subject ID | Held | Attended | %', { x: 40, y, size: 10, font: titleFont })
  y -= 16

  for (const row of rows.slice(0, 35)) {
    const text = `${row.student_id.slice(0, 8)}... | ${row.subject_id.slice(0, 8)}... | ${row.periods_held} | ${row.periods_attended} | ${row.attendance_pct === null ? 'N/A' : row.attendance_pct}`
    page.drawText(text, { x: 40, y, size: 9, font })
    y -= 14
    if (y < 40) break
  }

  return await pdf.save()
}
