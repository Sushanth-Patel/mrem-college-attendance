import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAdmin } from '@/lib/auth/guards'

export async function GET() {
  await requireAdmin()

  const workbook = new ExcelJS.Workbook()
  const students = workbook.addWorksheet('Student Import')
  students.columns = [
    { header: 'Hall Ticket No', key: 'roll_no', width: 20 },
    { header: 'Full Name', key: 'full_name', width: 30 },
    { header: 'Email Address', key: 'email', width: 34 },
    { header: "Father's Name", key: 'father_name', width: 28 },
    { header: 'Branch', key: 'branch', width: 24 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Section', key: 'section', width: 12 },
  ]
  students.addRow({
    roll_no: '21R21A0501',
    full_name: 'STUDENT FULL NAME',
    email: 'student@gmail.com',
    father_name: 'PARENT NAME',
    branch: 'CSE',
    year: 4,
    section: 'A',
  })
  students.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  students.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
  students.views = [{ state: 'frozen', ySplit: 1 }]

  const faculty = workbook.addWorksheet('Faculty Import')
  faculty.columns = [
    { header: 'Employee ID', key: 'employee_id', width: 18 },
    { header: 'Full Name', key: 'full_name', width: 30 },
    { header: 'Email Address', key: 'email', width: 34 },
    { header: 'Branch', key: 'branch', width: 24 },
  ]
  faculty.addRow({
    employee_id: 'EMP1001',
    full_name: 'FACULTY FULL NAME',
    email: 'faculty@gmail.com',
    branch: 'CSE',
  })
  faculty.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  faculty.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
  faculty.views = [{ state: 'frozen', ySplit: 1 }]

  const timetable = workbook.addWorksheet('Timetable Import')
  timetable.columns = [
    { header: 'Day', key: 'day', width: 14 },
    { header: 'Period', key: 'period', width: 10 },
    { header: 'Subject Code', key: 'subject_code', width: 18 },
    { header: 'Subject Name', key: 'subject_name', width: 38 },
    { header: 'Faculty Name', key: 'faculty_name', width: 30 },
    { header: 'Room', key: 'room_no', width: 18 },
    { header: 'Is Lab', key: 'is_lab', width: 10 },
  ]
  timetable.addRow({
    day: 'Monday',
    period: 1,
    subject_code: 'CS701PC',
    subject_name: 'Cryptography and Network Security',
    faculty_name: 'Faculty Name',
    room_no: 'APT 205',
    is_lab: 'NO',
  })
  timetable.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  timetable.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }
  timetable.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mrem-attendance-import-templates.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
