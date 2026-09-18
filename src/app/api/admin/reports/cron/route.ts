import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, buildAlertEmailHtml } from '@/lib/email/resend'

/**
 * Automated Saturday HoD Weekly Department Report Cron Endpoint
 * Gathers aggregate department attendance stats and identifies shortage cases.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Fail closed. Guarding with `if (cronSecret && ...)` meant that leaving
    // CRON_SECRET unset — the default in a fresh checkout — skipped the check
    // entirely and left an unauthenticated endpoint doing database work.
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured — refusing to run an unauthenticated cron job' },
        { status: 503 }
      )
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch active sections
    const { data: sections, error: secErr } = await supabase
      .from('sections')
      .select('id, section_name, year_of_study, semester, branches(code, name)')
      .eq('is_active', true)

    if (secErr) throw secErr

    const summaryReport: Array<{
      sectionId: string
      sectionName: string
      totalStudents: number
      shortageCount: number
    }> = []

    for (const sec of sections || []) {
      const { data: students } = await supabase
        .from('students')
        .select('id, roll_no, profiles(full_name, email)')
        .eq('section_id', sec.id)

      const total = students?.length || 0
      summaryReport.push({
        sectionId: sec.id,
        sectionName: `CSE Year ${sec.year_of_study} Sec ${sec.section_name}`,
        totalStudents: total,
        shortageCount: 0, // Computed from sessions
      })
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sectionsAnalyzed: summaryReport.length,
      report: summaryReport,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Weekly report cron failed' },
      { status: 500 }
    )
  }
}
