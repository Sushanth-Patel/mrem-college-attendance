export type AttendanceStatus = 'present' | 'absent'
export type StudentAccountStatus = 'active' | 'detained' | 'transferred'

export type MarkingInputRecord = {
  studentId: string
  status: AttendanceStatus
}
