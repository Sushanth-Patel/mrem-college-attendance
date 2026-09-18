import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import SubjectAssignmentsClient from './SubjectAssignmentsClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Faculty Class Allocations | Admin Portal',
  description: 'Manage and approve faculty class and subject assignments.',
}

export default async function SubjectAssignmentsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [
    { data: requests },
    { data: facultyData },
    { data: subjectsData },
    { data: sectionsData },
  ] = await Promise.all([
    supabase
      .from('faculty_assignment_requests')
      .select(`
        id,
        faculty_id,
        year_of_study,
        branch_code,
        section_name,
        subject_id,
        subject_name,
        subject_code,
        notes,
        status,
        created_at,
        profiles:faculty_id(full_name, email)
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('faculty')
      .select('id, profiles(full_name, email)'),

    supabase
      .from('subjects')
      .select('id, code, name')
      .order('code'),

    supabase
      .from('sections')
      .select('id, section_name, year_of_study, branches(code)')
      .eq('is_active', true)
      .order('year_of_study'),
  ])

  const facultyList = (facultyData ?? []).map((f) => {
    const prof = f.profiles as unknown as { full_name: string; email: string } | null
    return {
      id: f.id,
      name: prof?.full_name ?? 'Faculty',
      email: prof?.email ?? '',
    }
  })

  const subjectList = (subjectsData ?? []).map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
  }))

  const sectionList = (sectionsData ?? []).map((sec) => {
    const br = sec.branches as unknown as { code: string } | null
    return {
      id: sec.id,
      name: sec.section_name,
      year: sec.year_of_study,
      branch: br?.code ?? 'ENGG',
    }
  })

  const initialRequests = (requests ?? []).map((r) => ({
    id: r.id,
    faculty_id: r.faculty_id,
    year_of_study: r.year_of_study,
    branch_code: r.branch_code,
    section_name: r.section_name,
    subject_id: r.subject_id,
    subject_name: r.subject_name,
    subject_code: r.subject_code,
    notes: r.notes,
    status: r.status as 'pending' | 'approved' | 'rejected',
    created_at: r.created_at,
    profiles: r.profiles as unknown as { full_name: string; email: string } | null,
  }))

  return (
    <SubjectAssignmentsClient
      initialRequests={initialRequests}
      facultyList={facultyList}
      subjectList={subjectList}
      sectionList={sectionList}
    />
  )
}
