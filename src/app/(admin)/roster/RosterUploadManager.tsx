'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { formatAcademicTerm } from '@/lib/academic'

type Branch = {
  id: string
  name: string
  code: string
}

type Section = {
  id: string
  branch_id: string
  year_of_study: number
  semester: 'odd' | 'even'
  academic_year: string
  section_name: string
  branches?: Branch | null
}

interface Props {
  sections: Section[]
  branches: Branch[]
}

type ParsedStudent = {
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

export default function RosterUploadManager({ sections, branches }: Props) {
  const [tab, setTab] = useState<'student' | 'faculty'>('student')

  // Target Section Mapping Mode
  const [mappingMode, setMappingMode] = useState<'target_section' | 'auto_detect' | 'file_column'>('target_section')
  const [sectionList, setSectionList] = useState<Section[]>(sections)
  const [targetSectionId, setTargetSectionId] = useState<string>(sections[0]?.id || '')
  const [targetBranchId, setTargetBranchId] = useState<string>(branches[0]?.id || '')

  // Inline Quick Add Section
  const [showQuickAddSection, setShowQuickAddSection] = useState(false)
  const [quickDept, setQuickDept] = useState('CSE')
  const [quickYear, setQuickYear] = useState<number>(3)
  const [quickSem, setQuickSem] = useState<'odd' | 'even'>('odd')
  const [quickSecName, setQuickSecName] = useState('A')
  const [creatingQuickSec, setCreatingQuickSec] = useState(false)

  const handleCreateQuickSection = async () => {
    if (!quickDept.trim() || !quickSecName.trim()) return
    setCreatingQuickSec(true)
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          branchCode: quickDept.trim().toUpperCase(),
          yearOfStudy: quickYear,
          semester: quickSem,
          sectionName: quickSecName.trim().toUpperCase(),
          academicYear: '2025-2026',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.section) {
        throw new Error(data.error || 'Failed to create section')
      }

      const newSec: Section = {
        id: data.section.id,
        section_name: data.section.section_name,
        year_of_study: data.section.year_of_study,
        semester: data.section.semester,
        academic_year: data.section.academic_year,
        branch_id: data.section.branch_id,
        branches: {
          id: data.section.branch_id,
          name: quickDept.trim().toUpperCase(),
          code: quickDept.trim().toUpperCase(),
        },
      }

      setSectionList([newSec, ...sectionList])
      setTargetSectionId(newSec.id)
      setShowQuickAddSection(false)
      setResultMessage(`✓ Successfully created and selected ${quickDept.toUpperCase()} Year ${quickYear} Sec ${quickSecName.toUpperCase()}!`)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create section')
    } finally {
      setCreatingQuickSec(false)
    }
  }

  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedStudent[]>([])
  const [rawPreview, setRawPreview] = useState<Record<string, string>[]>([])
  const [uploading, setUploading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedTargetSectionObj = sectionList.find((s) => s.id === targetSectionId)

  // Intelligent header mapping
  const mapHeadersToStudent = (rawList: Record<string, any>[]): ParsedStudent[] => {
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

    return rawList.map((row) => {
      const keys = Object.keys(row)

      // 1. Match Hall Ticket / Roll Number
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
          ck === 'studentid' ||
          ck === 'htnum' ||
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

      // 2. Match Student Name (Prioritize 'name', 'nam', 'studentname' and EXCLUDE 'father', 'mother', 'college')
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

      // 3. Match Email
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

      // 4. Match Branch
      let rawBranch = ''
      for (const k of keys) {
        const ck = cleanKey(k)
        if (ck === 'branch' || ck === 'branchname' || ck === 'dept' || ck === 'department') {
          rawBranch = String(row[k] || '').trim()
          break
        }
      }
      const branchCode = rawBranch ? normalizeBranchCode(rawBranch) : ''

      // 5. Match Year & Section if present
      let yearOfStudy: number | undefined
      let sectionName = ''
      let sectionId = ''

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
        roll_no: rollNo.toUpperCase(),
        full_name: fullName,
        email,
        father_name: fatherName,
        college_name: collegeName,
        section_id: sectionId,
        branch_code: branchCode,
        year_of_study: yearOfStudy,
        section_name: sectionName,
      }
    }).filter((r) => r.roll_no.length > 0)
  }

  // Handle file input (CSV or Excel)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResultMessage(null)
    setErrorMessage(null)

    const fileName = selectedFile.name.toLowerCase()

    try {
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel with ExcelJS
        const { default: ExcelJS } = await import('exceljs')
        const buffer = await selectedFile.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)
        const worksheet = workbook.worksheets[0]

        if (!worksheet) throw new Error('No worksheets found in Excel file')

        const rows: Record<string, string>[] = []
        let headers: string[] = []

        worksheet.eachRow((row, rowNumber) => {
          const values = Array.isArray(row.values) ? row.values.slice(1) : []
          if (rowNumber === 1) {
            headers = values.map((v) => String(v || '').trim())
          } else {
            const rowObj: Record<string, string> = {}
            headers.forEach((h, idx) => {
              if (h) rowObj[h] = String(values[idx] || '').trim()
            })
            if (Object.values(rowObj).some((v) => v.length > 0)) {
              rows.push(rowObj)
            }
          }
        })

        setRawPreview(rows.slice(0, 10))
        setParsedRows(mapHeadersToStudent(rows))
      } else {
        // Parse CSV with PapaParse
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rawData = results.data as Record<string, string>[]
            setRawPreview(rawData.slice(0, 10))
            setParsedRows(mapHeadersToStudent(rawData))
          },
          error: (err) => {
            setErrorMessage(`CSV Parse error: ${err.message}`)
          },
        })
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error reading spreadsheet')
    }
  }

  // Handle final upload
  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResultMessage(null)
    setErrorMessage(null)

    try {
      if (tab === 'student') {
        const res = await fetch('/api/admin/roster/student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: parsedRows,
            targetSectionId: mappingMode === 'target_section' ? targetSectionId : undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

        setResultMessage(`✓ Successfully imported ${data.count || parsedRows.length} students into the authorized roster!`)
      } else {
        const text = await file.text()
        const res = await fetch('/api/admin/roster/faculty', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText: text, defaultBranchId: targetBranchId }),
        })

        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

        setResultMessage(`✓ Successfully processed faculty roster!`)
      }

      setFile(null)
      setParsedRows([])
      setRawPreview([])
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload roster')
    } finally {
      setUploading(false)
    }
  }

  // Download one workbook containing all supported import templates.
  const downloadSampleTemplate = () => {
    window.location.href = '/api/admin/templates'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">People & Class Data Import</h1>
          <p className="text-xs text-gray-500 mt-1">
            Pre-load authorized student roll numbers with smart automatic class, year, and section routing.
          </p>
        </div>

        <button
          onClick={downloadSampleTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-violet-700 text-xs font-semibold rounded-xl border border-gray-200 transition w-fit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Excel Templates
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit">
        <button
          onClick={() => {
            setTab('student')
            setFile(null)
            setParsedRows([])
            setRawPreview([])
            setResultMessage(null)
            setErrorMessage(null)
          }}
          className={`px-5 py-2 text-xs font-semibold rounded-lg transition ${
            tab === 'student' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Student Records
        </button>
        <button
          onClick={() => {
            setTab('faculty')
            setFile(null)
            setParsedRows([])
            setRawPreview([])
            setResultMessage(null)
            setErrorMessage(null)
          }}
          className={`px-5 py-2 text-xs font-semibold rounded-lg transition ${
            tab === 'faculty' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Faculty Records
        </button>
      </div>

      {/* Section Identification / Routing Options (For Students) */}
      {tab === 'student' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              Step 1: Choose Class & Section Routing Mode
            </h2>
            <span className="text-[11px] text-violet-700 font-mono">Option Selected: {mappingMode.replace('_', ' ').toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option A */}
            <div
              onClick={() => setMappingMode('target_section')}
              className={`p-4 rounded-2xl border cursor-pointer transition ${
                mappingMode === 'target_section'
                  ? 'bg-purple-50 border-purple-500 shadow-lg shadow-purple-950/50'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900">Target Class & Section</span>
                <input
                  type="radio"
                  name="mapping_mode"
                  checked={mappingMode === 'target_section'}
                  onChange={() => setMappingMode('target_section')}
                  className="text-violet-600"
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Select a specific Branch, Year, and Section below. All students in the uploaded file will be automatically assigned to this section.
              </p>
            </div>

            {/* Option B */}
            <div
              onClick={() => setMappingMode('auto_detect')}
              className={`p-4 rounded-2xl border cursor-pointer transition ${
                mappingMode === 'auto_detect'
                  ? 'bg-purple-50 border-purple-500 shadow-lg shadow-purple-950/50'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900">Smart Roll No. Auto-Detect</span>
                <input
                  type="radio"
                  name="mapping_mode"
                  checked={mappingMode === 'auto_detect'}
                  onChange={() => setMappingMode('auto_detect')}
                  className="text-violet-600"
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Automatically identifies Branch (CSE, CSM, CSD, IOT, IT) and Year from roll numbers like <span className="text-violet-700 font-mono">22ME1A05xx</span>.
              </p>
            </div>

            {/* Option C */}
            <div
              onClick={() => setMappingMode('file_column')}
              className={`p-4 rounded-2xl border cursor-pointer transition ${
                mappingMode === 'file_column'
                  ? 'bg-purple-50 border-purple-500 shadow-lg shadow-purple-950/50'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-900">Use Columns from File</span>
                <input
                  type="radio"
                  name="mapping_mode"
                  checked={mappingMode === 'file_column'}
                  onChange={() => setMappingMode('file_column')}
                  className="text-violet-600"
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Uses <span className="text-violet-700 font-mono">branch</span>, <span className="text-violet-700 font-mono">year</span>, and <span className="text-violet-700 font-mono">section</span> columns from your spreadsheet.
              </p>
            </div>
          </div>

          {/* If Target Section is Selected -> Show dropdown & quick create */}
          {mappingMode === 'target_section' && (
            <div className="p-5 rounded-2xl bg-gray-50 border border-violet-200 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                    Assign All Uploaded Students To:
                  </label>
                  <p className="text-xs text-gray-500">
                    Select destination class section or add a new custom department & section:
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-purple-500/50 rounded-xl text-xs text-gray-900 font-semibold focus:ring-2 focus:ring-purple-400 focus:outline-none min-w-[260px]"
                  >
                    {sectionList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.branches?.code || 'Dept'} • Year {s.year_of_study} ({formatAcademicTerm(s.semester)}) - Sec {s.section_name} ({s.academic_year})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowQuickAddSection(!showQuickAddSection)}
                    className="px-3.5 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-violet-300 text-violet-700 text-xs font-bold rounded-xl transition whitespace-nowrap"
                  >
                    {showQuickAddSection ? '✕ Cancel' : '+ Add New Class/Sec'}
                  </button>
                </div>
              </div>

              {/* Inline Quick Add Section Form */}
              {showQuickAddSection && (
                <div className="p-4 rounded-xl bg-purple-50 border border-violet-200 space-y-3 animate-in fade-in">
                  <span className="text-xs font-bold text-violet-700 block">
                    Create New Class & Section on the fly:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold block mb-1">Department / Branch</label>
                      <input
                        type="text"
                        placeholder="e.g. CSE, CSM, ECE..."
                        value={quickDept}
                        onChange={(e) => setQuickDept(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-mono uppercase focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold block mb-1">Year of Study</label>
                      <select
                        value={quickYear}
                        onChange={(e) => setQuickYear(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      >
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold block mb-1">Semester</label>
                      <select
                        value={quickSem}
                        onChange={(e) => setQuickSem(e.target.value as 'odd' | 'even')}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      >
                        <option value="odd">Term 1</option>
                        <option value="even">Term 2</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 font-semibold block mb-1">Section</label>
                      <input
                        type="text"
                        placeholder="e.g. A, B, C"
                        value={quickSecName}
                        onChange={(e) => setQuickSecName(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-bold uppercase focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={creatingQuickSec || !quickDept.trim() || !quickSecName.trim()}
                        onClick={handleCreateQuickSection}
                        className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-lg transition shadow text-xs"
                      >
                        {creatingQuickSec ? 'Creating...' : '✓ Create & Select'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card">
        <h2 className="text-sm font-bold text-gray-900 mb-2">
          Step 2: Upload {tab === 'student' ? 'Student' : 'Faculty'} Spreadsheet (.xlsx, .xls, .csv)
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          {tab === 'student' ? (
            <>
              Supported columns: <code className="text-violet-700 font-mono">roll_no, full_name, email</code> (Excel or CSV).
              {selectedTargetSectionObj && mappingMode === 'target_section' && (
                <span className="ml-2 text-emerald-600 font-semibold">
                  → Will route to {selectedTargetSectionObj.branches?.code} Year {selectedTargetSectionObj.year_of_study} Sec {selectedTargetSectionObj.section_name}
                </span>
              )}
            </>
          ) : (
            <>
              Supported columns: <code className="text-violet-700 font-mono">employee_id, full_name, email, branch_id</code>
            </>
          )}
        </p>

        {resultMessage && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-500/40 text-emerald-700 text-xs rounded-xl font-semibold">
            {resultMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-500/40 text-rose-700 text-xs rounded-xl font-semibold">
            {errorMessage}
          </div>
        )}

        <div className="border-2 border-dashed border-gray-200 hover:border-violet-300 rounded-2xl p-8 text-center transition bg-gray-50">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
            id="spreadsheet-file-input"
          />
          <label htmlFor="spreadsheet-file-input" className="cursor-pointer block">
            <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {file ? file.name : 'Click to select Excel (.xlsx) or CSV file'}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Microsoft Excel (.xlsx, .xls) and UTF-8 CSV supported</p>
          </label>
        </div>

        {file && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-purple-50 rounded-2xl border border-violet-200">
            <div>
              <p className="text-xs font-bold text-gray-900">
                Ready to Import: <span className="text-violet-700 font-mono">{parsedRows.length || rawPreview.length} Records</span>
              </p>
              <p className="text-[11px] text-gray-500">
                {mappingMode === 'target_section'
                  ? `Assigned to: ${selectedTargetSectionObj?.branches?.code || 'CSE'} Year ${selectedTargetSectionObj?.year_of_study || '3'} Sec ${selectedTargetSectionObj?.section_name || 'A'}`
                  : 'Auto-Routing enabled by roll number / file headers.'}
              </p>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-600/30 transform active:scale-95"
            >
              {uploading ? 'Importing Roster...' : `Commit & Import ${parsedRows.length || rawPreview.length} Students`}
            </button>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900">
              Previewing Parsed Student Records ({parsedRows.length} Total Found)
            </h3>
            <span className="text-[10px] text-violet-700 font-mono">Showing first 10 rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Roll Number</th>
                  <th className="px-6 py-3 font-semibold">Full Name</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Target Section Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {parsedRows.slice(0, 10).map((row, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-gray-50 font-mono text-[11px]">
                      <td className="px-6 py-3 font-bold text-violet-700">{row.roll_no}</td>
                      <td className="px-6 py-3 text-gray-900 font-sans">{row.full_name}</td>
                      <td className="px-6 py-3 text-gray-500">{row.email}</td>
                      <td className="px-6 py-3 text-emerald-600 font-sans">
                        {mappingMode === 'target_section'
                          ? `${selectedTargetSectionObj?.branches?.code || 'CSE'} - Yr ${selectedTargetSectionObj?.year_of_study || 3} Sec ${selectedTargetSectionObj?.section_name || 'A'}`
                          : 'Auto-Routing via Roll No / Branch'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
