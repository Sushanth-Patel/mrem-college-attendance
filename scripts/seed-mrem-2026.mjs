import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const password = process.env.MREM_SEED_PASSWORD
const facultyEmail = process.env.MREM_FACULTY_EMAIL
const facultyPassword = process.env.MREM_FACULTY_PASSWORD
const facultyName = process.env.MREM_FACULTY_NAME || 'Faculty Member'

if (!password || !facultyEmail || !facultyPassword) {
  throw new Error('MREM_SEED_PASSWORD, MREM_FACULTY_EMAIL, and MREM_FACULTY_PASSWORD environment variables are required')
}

async function must(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function ensureAuthUser(email, userPassword, metadata) {
  const users = await must(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'list auth users')
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    await must(
      supabase.auth.admin.updateUserById(existing.id, { password: userPassword, email_confirm: true, user_metadata: metadata }),
      `update auth user ${email}`
    )
    return existing.id
  }
  const created = await must(
    supabase.auth.admin.createUser({ email, password: userPassword, email_confirm: true, user_metadata: metadata }),
    `create auth user ${email}`
  )
  return created.user.id
}

function clean(value) {
  return String(value ?? '').trim()
}

function dayName(value) {
  return clean(value).toLowerCase()
}

const studentsBook = new ExcelJS.Workbook()
await studentsBook.xlsx.readFile('student_details.xlsx')
const studentSheet = studentsBook.worksheets[0]
const students = []
for (let row = 2; row <= Math.min(studentSheet.rowCount, 61); row += 1) {
  const values = studentSheet.getRow(row).values.slice(1)
  const rollNo = clean(values[0]).replace(/\s+/g, '').toUpperCase()
  if (rollNo) {
    students.push({
      rollNo,
      fullName: clean(values[1]),
      fatherName: clean(values[2]),
      collegeName: clean(values[3]),
      branch: clean(values[4]),
      email: clean(values[5]).toLowerCase(),
    })
  }
}
if (students.length !== 60) throw new Error(`Expected 60 students, found ${students.length}`)

const branch = await must(supabase.from('branches').select('id').eq('code', 'CSE').maybeSingle(), 'find CSE branch')
if (!branch) throw new Error('CSE branch was not found')
const section = await must(
  supabase.from('sections').select('id, term_start_date').eq('branch_id', branch.id).eq('year_of_study', 4).eq('academic_year', '2026-27').eq('section_name', 'A').eq('is_active', true).maybeSingle(),
  'find CSE Year 4 Section A'
)
if (!section) throw new Error('CSE Year 4 Section A (2026-27) was not found')

const facultyId = await ensureAuthUser(facultyEmail, facultyPassword, { full_name: facultyName, role: 'faculty' })
await must(
  supabase.from('profiles').upsert({ id: facultyId, role: 'faculty', full_name: facultyName, email: facultyEmail, is_active: true }),
  'upsert faculty profile'
)
const faculty = await must(
  supabase.from('faculty').upsert({ id: facultyId, employee_id: 'FAC001', branch_id: branch.id }).select('id').single(),
  'upsert faculty record'
)

const studentRecords = []
for (const student of students) {
  const id = await ensureAuthUser(student.email, password, { full_name: student.fullName, role: 'student' })
  await must(
    supabase.from('profiles').upsert({ id, role: 'student', full_name: student.fullName, email: student.email, is_active: true }),
    `upsert profile ${student.rollNo}`
  )
  studentRecords.push({
    id,
    roll_no: student.rollNo,
    section_id: section.id,
    joining_date: section.term_start_date || '2026-07-06',
    account_status: 'active',
  })
  await must(
    supabase.from('roster_students').upsert({
      roll_no: student.rollNo,
      full_name: student.fullName,
      email: student.email,
      section_id: section.id,
      matched: true,
      needs_review: false,
      reviewed: true,
      father_name: student.fatherName || null,
      college_name: student.collegeName || null,
    }, { onConflict: 'roll_no' }),
    `upsert roster ${student.rollNo}`
  )
}
await must(supabase.from('students').upsert(studentRecords, { onConflict: 'roll_no' }), 'upsert student records')

const timetableBook = new ExcelJS.Workbook()
await timetableBook.xlsx.readFile('Malla_Reddy_IV-I_Sem_Class_Time_Table_2026-27.xlsx')
const timetableSheet = timetableBook.worksheets[0]
const subjectRows = []
for (let row = 17; row <= 24; row += 1) {
  const values = timetableSheet.getRow(row).values.slice(1)
  if (clean(values[0]) && clean(values[1])) subjectRows.push({
    code: clean(values[0]),
    name: clean(values[1]),
    subjectType: clean(values[1]).toLowerCase().includes('lab') ? 'lab' : clean(values[1]).toLowerCase().includes('project') ? 'project' : 'theory',
  })
}

const subjectIds = new Map()
for (const subject of subjectRows) {
  let record = await must(
    supabase.from('subjects').select('id').eq('branch_id', branch.id).eq('year_of_study', 4).eq('semester', 'odd').eq('code', subject.code).maybeSingle(),
    `find subject ${subject.code}`
  )
  if (!record) {
    record = await must(
      supabase.from('subjects').insert({
        branch_id: branch.id, year_of_study: 4, semester: 'odd', code: subject.code, name: subject.name,
        subject_type: subject.subjectType, credits: subject.subjectType === 'project' ? 3 : 3,
      }).select('id').single(),
      `create subject ${subject.code}`
    )
  }
  subjectIds.set(subject.code, record.id)
  await must(
    supabase.from('section_subjects').upsert({ section_id: section.id, subject_id: record.id }),
    `assign subject ${subject.code}`
  )
}

const grid = []
// The timetable grid uses faculty-friendly abbreviations that do NOT match
// subject codes or full names (see the legend in rows 17–26 of the sheet).
// Map each grid label to its subject code; null = non-academic (Library/Sports),
// which stay on the timetable for schedule reference but track no attendance (PRD §5.2).
const GRID_LABEL_TO_SUBJECT_CODE = {
  'C&NS': 'CS701PC',
  'CC': 'CS744PE',
  'CD': 'CS702PC',
  'BCT': 'CS754PE',
  'SID': 'CE722OE',
  'C&NS LAB': 'CS703PC',
  'CD LAB': 'CS704PC',
  'PROJECT STAGE-I': 'CS705PC',
  'LIBRARY': null,
  'LIB': null,
  'SPORTS': null,
}

const normalizeSubjectText = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const header = timetableSheet.getRow(6).values.slice(1)
const periodColumns = header
  .map((value, index) => ({ index, time: clean(value) }))
  .filter((entry) => entry.index > 0 && entry.time && entry.index !== 3 && entry.index !== 6)
  .map((entry, index) => ({ ...entry, period: index + 1 }))
for (let row = 7; row <= 12; row += 1) {
  const values = timetableSheet.getRow(row).values.slice(1)
  const day = dayName(values[0])
  for (const entry of periodColumns) {
    const label = clean(values[entry.index])
    if (!label || ['BREAK', 'LUNCH'].includes(label.toUpperCase())) continue
    const upperLabel = label.toUpperCase()
    let subject
    if (Object.hasOwn(GRID_LABEL_TO_SUBJECT_CODE, upperLabel)) {
      // Legend label: map directly to its subject code (null = non-academic slot)
      const aliasCode = GRID_LABEL_TO_SUBJECT_CODE[upperLabel]
      subject = aliasCode ? subjectRows.find((item) => item.code === aliasCode) : null
    } else {
      // Unknown label: fall back to exact/normalized code or name matching
      subject =
        subjectRows.find((item) => item.code === upperLabel) ||
        subjectRows.find((item) => normalizeSubjectText(item.name) === normalizeSubjectText(upperLabel)) ||
        subjectRows.find((item) => normalizeSubjectText(item.name).startsWith(normalizeSubjectText(upperLabel)))
    }
    if (!subject && !Object.hasOwn(GRID_LABEL_TO_SUBJECT_CODE, upperLabel)) {
      console.warn(`WARN: grid label "${label}" matched no subject; entry will have no subject_id`)
    }
    grid.push({
      section_id: section.id,
      day_of_week: day,
      period_number: entry.period,
      subject_id: subject ? subjectIds.get(subject.code) : null,
      default_faculty_id: faculty.id,
      subject_name: subject?.name || label,
      subject_code: subject?.code || label,
      faculty_name: facultyName,
      room_no: 'APT 205',
      is_lab: label.toLowerCase().includes('lab'),
    })
  }
}
await must(supabase.from('timetable_entries').delete().eq('section_id', section.id), 'clear target timetable')
await must(supabase.from('timetable_entries').insert(grid), 'insert target timetable')

console.log(JSON.stringify({
  studentsImported: students.length,
  facultyEmail,
  facultyPassword,
  studentPassword: password,
  sectionId: section.id,
  timetableEntries: grid.length,
}, null, 2))
