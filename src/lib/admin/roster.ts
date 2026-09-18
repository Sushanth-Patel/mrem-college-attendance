import Papa from 'papaparse'
import { requireAdmin } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'

export type StudentRosterRow = {
  roll_no: string
  full_name: string
  email: string
  father_name?: string
  college_name?: string
  section_id?: string
  branch_code?: string
  year_of_study?: number
  section_name?: string
}

export type FacultyRosterRow = {
  employee_id: string
  full_name: string
  email: string
  branch_id?: string
  branch_code?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalize(value: string | undefined | null) {
  return (value ?? '').trim()
}

// Branch code mapping in JNTU / MREM roll numbers
// e.g. '05' -> 'CSE', '66' -> 'CSM', '67' -> 'CSD', '69' -> 'IOT', '12' -> 'IT'
const ROLL_BRANCH_MAP: Record<string, string> = {
  '05': 'CSE',
  '66': 'CSM',
  '67': 'CSD',
  '69': 'IOT',
  '12': 'IT',
}

export async function importStudentRows(rows: StudentRosterRow[], defaultSectionId?: string) {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all active sections with branches for auto-resolution
  const { data: allSections } = await supabase
    .from('sections')
    .select('id, section_name, year_of_study, semester, academic_year, branch_id, branches(name, code)')
    .eq('is_active', true)

  const sectionList = allSections || []

  // Create section map by id and by code/year/name
  const sectionById = new Map(sectionList.map((s) => [s.id, s]))

  const processed = rows.map((row) => {
    const rollNo = normalize(row.roll_no).toUpperCase()
    const fullName = normalize(row.full_name)
    const email = normalize(row.email).toLowerCase()
    const fatherName = normalize(row.father_name)
    const collegeName = normalize(row.college_name) || ''
    
    let resolvedSectionId = row.section_id ? normalize(row.section_id) : ''

    // 1. If explicit defaultSectionId is provided, use it
    if (!resolvedSectionId && defaultSectionId) {
      resolvedSectionId = defaultSectionId
    }

    // 2. If row provided branch/year/section name, match it
    if (!resolvedSectionId && (row.branch_code || row.year_of_study || row.section_name)) {
      const bCode = (row.branch_code ?? '').toUpperCase()
      const yNum = Number(row.year_of_study) || 0
      const sName = (row.section_name ?? '').toUpperCase()

      const match = sectionList.find((s) => {
        const branchObj = (Array.isArray(s.branches) ? s.branches[0] : s.branches) as unknown as { code: string; name: string } | null
        const matchBranch = !bCode || branchObj?.code?.toUpperCase() === bCode
        const matchYear = !yNum || s.year_of_study === yNum
        const matchName = !sName || s.section_name.toUpperCase() === sName
        return matchBranch && matchYear && matchName
      })

      if (match) {
        resolvedSectionId = match.id
      }
    }

    // 3. Smart auto-identification from standard Roll Number pattern
    if (!resolvedSectionId && rollNo.length >= 8) {
      const match = rollNo.match(/^[0-9]{2}[A-Z0-9]{2}[0-9]{1}[A-Z]{1}([0-9]{2})[0-9]{2}$/i)
      if (match) {
        const deptDigits = match[1]
        const branchCode = ROLL_BRANCH_MAP[deptDigits] || 'CSE'
        const candidate = sectionList.find((s) => {
          const branchObj = (Array.isArray(s.branches) ? s.branches[0] : s.branches) as unknown as { code: string; name: string } | null
          return branchObj?.code?.toUpperCase() === branchCode
        })
        if (candidate) {
          resolvedSectionId = candidate.id
        }
      }
    }

    // Fallback: If still no section, use the first active section if available
    if (!resolvedSectionId && sectionList.length > 0) {
      resolvedSectionId = sectionList[0].id
    }

    const needsReview = !rollNo || !fullName || !resolvedSectionId || !EMAIL_REGEX.test(email)

    return {
      roll_no: rollNo,
      full_name: fullName,
      email: email || (rollNo ? `${rollNo.toLowerCase()}@college.edu` : ''),
      father_name: fatherName || null,
      college_name: collegeName,
      section_id: resolvedSectionId,
      matched: false,
      needs_review: needsReview,
      reviewed: false,
    }
  })

  // Filter valid entries with roll_no
  const validRows = processed.filter((r) => r.roll_no.length > 0)
  if (validRows.length === 0) {
    throw new Error('No valid student records found in upload.')
  }

  const { error } = await supabase.from('roster_students').upsert(validRows, { onConflict: 'roll_no' })
  if (error) throw error

  return { count: validRows.length, processed: validRows }
}

export async function uploadStudentRoster(csvText: string, targetSectionId?: string) {
  await requireAdmin()
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  // Normalize column names
  const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')

  const normalizeBranchCode = (b: string): string => {
    const upper = b.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (upper.includes('AIML') || upper.includes('ARTIFICIAL') || upper === 'CSM') return 'CSM'
    if (upper.includes('DATA') || upper.includes('DS') || upper === 'CSD') return 'CSD'
    if (upper.includes('IOT') || upper.includes('INTERNET') || upper === 'IOT') return 'IOT'
    if (upper === 'IT' || upper.includes('INFORMATIONTECH')) return 'IT'
    if (upper.includes('CSE') || upper.includes('COMPUTERSCIENCE') || upper === 'CS') return 'CSE'
    return b.trim().toUpperCase()
  }

  const rows: StudentRosterRow[] = parsed.data.map((row) => {
    const keys = Object.keys(row)

    let rollNo = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (
        ck === 'hallticketno' ||
        ck === 'hallticket' ||
        ck === 'htno' ||
        ck === 'rollno' ||
        ck === 'roll' ||
        ck === 'regno' ||
        ck.includes('hallticket') ||
        ck.includes('rollno')
      ) {
        rollNo = String(row[k] || '').trim()
        break
      }
    }
    if (!rollNo) {
      for (const k of keys) {
        const ck = cleanKey(k)
        if (ck.includes('roll') || ck.includes('htno')) {
          rollNo = String(row[k] || '').trim()
          break
        }
      }
    }

    let fullName = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (['name', 'nam', 'studentname', 'candidatename', 'fullname', 'nameofstudent', 'student'].includes(ck)) {
        fullName = String(row[k] || '').trim()
        break
      }
    }
    if (!fullName) {
      for (const k of keys) {
        const ck = cleanKey(k)
        if (
          (ck.includes('name') || ck === 'nam') &&
          !ck.includes('father') &&
          !ck.includes('mother') &&
          !ck.includes('parent') &&
          !ck.includes('college') &&
          !ck.includes('branch')
        ) {
          fullName = String(row[k] || '').trim()
          break
        }
      }
    }

    let email = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (
        ck === 'email' ||
        ck === 'mail' ||
        ck === 'emailid' ||
        ck === 'mailid' ||
        ck === 'studentemail' ||
        ck.includes('email') ||
        ck.includes('mail')
      ) {
        email = String(row[k] || '').trim()
        break
      }
    }
    if (!email && rollNo) {
      email = `${rollNo.toLowerCase()}@college.edu`
    }

    let rawBranch = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (ck === 'branch' || ck === 'branchname' || ck === 'dept' || ck === 'department') {
        rawBranch = String(row[k] || '').trim()
        break
      }
    }
    const branchCode = rawBranch ? normalizeBranchCode(rawBranch) : ''

    let yearOfStudy: number | undefined
    let sectionName = ''
    let sectionId = targetSectionId || ''

    for (const k of keys) {
      const ck = cleanKey(k)
      if (ck === 'year' || ck === 'yr' || ck === 'yearofstudy') {
        yearOfStudy = Number(row[k]) || undefined
      }
      if (ck === 'section' || ck === 'sec' || ck === 'secname') {
        sectionName = String(row[k] || '').trim()
      }
      if (ck === 'sectionid' || ck === 'secid') {
        sectionId = String(row[k] || '').trim()
      }
    }

    let fatherName = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (ck.includes('father') || ck.includes('parent')) {
        fatherName = String(row[k] || '').trim()
        break
      }
    }

    let collegeName = ''
    for (const k of keys) {
      const ck = cleanKey(k)
      if (ck === 'collegename' || ck === 'college' || ck === 'institution') {
        collegeName = String(row[k] || '').trim()
        break
      }
    }

    return {
      roll_no: rollNo,
      full_name: fullName,
      email,
      father_name: fatherName,
      college_name: collegeName,
      section_id: sectionId,
      branch_code: branchCode,
      year_of_study: yearOfStudy,
      section_name: sectionName,
    }
  })

  return importStudentRows(rows, targetSectionId)
}

export async function uploadFacultyRoster(csvText: string, defaultBranchId?: string) {
  await requireAdmin()
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  const rows = parsed.data.map((row) => {
    const keys = Object.keys(row)
    const findVal = (patterns: string[]) => {
      const key = keys.find((k) => patterns.some((p) => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p)))
      return key ? row[key] : ''
    }

    const employeeId = normalize(findVal(['employee', 'empid', 'id', 'facid']) || row.employee_id).toUpperCase()
    const fullName = normalize(findVal(['name', 'fullname', 'facultyname']) || row.full_name)
    const email = normalize(findVal(['email', 'mail', 'emailid']) || row.email).toLowerCase()
    const branchId = normalize(findVal(['branchid', 'branch_id']) || row.branch_id || defaultBranchId)

    const needsReview = !employeeId || !fullName || !EMAIL_REGEX.test(email)

    return {
      employee_id: employeeId,
      full_name: fullName,
      email: email || `${employeeId.toLowerCase()}@mrecms.in`,
      branch_id: branchId || null,
      matched: false,
      needs_review: needsReview,
      reviewed: false,
    }
  })

  const validRows = rows.filter((r) => r.employee_id.length > 0)
  if (validRows.length === 0) {
    throw new Error('No valid faculty records found in upload.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('roster_faculty').upsert(validRows, { onConflict: 'employee_id' })
  if (error) throw error

  return { count: validRows.length }
}

