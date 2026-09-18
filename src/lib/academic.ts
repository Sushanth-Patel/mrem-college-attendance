export const ACADEMIC_TERM_LABELS = {
  odd: 'I Sem',
  even: 'II Sem',
} as const

export function formatAcademicTerm(value: string | null | undefined, year?: number | null) {
  const isEven = value === 'even' || (value && value.toLowerCase().includes('ii'))
  const semRoman = isEven ? 'II' : 'I'
  const semNum = isEven ? '2' : '1'
  if (year) {
    const yearRoman = ['I', 'II', 'III', 'IV'][Math.max(0, Math.min(year - 1, 3))] || 'IV'
    return `${yearRoman} - ${semRoman} (${year}-${semNum})`
  }
  return `${semRoman} Sem`
}

export function formatYearAndSemester(year: number | null | undefined, semester: string | null | undefined) {
  const y = year || 4
  const isEven = semester === 'even' || (semester && semester.toLowerCase().includes('ii'))
  const semRoman = isEven ? 'II' : 'I'
  const semNum = isEven ? '2' : '1'
  const yearRoman = ['I', 'II', 'III', 'IV'][Math.max(0, Math.min(y - 1, 3))] || 'IV'
  return `${yearRoman} - ${semRoman} (${y}-${semNum})`
}

export function normalizeRollNumber(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function nextAcademicPlacement(yearOfStudy: number, semester: 'odd' | 'even') {
  if (semester === 'odd') {
    return { yearOfStudy, semester: 'even' as const }
  }

  return {
    yearOfStudy: Math.min(yearOfStudy + 1, 4),
    semester: 'odd' as const,
  }
}
