import { listDetainedStudentsForFaculty, releaseDetainedStudent } from '@/lib/faculty/detained'
import { revalidatePath } from 'next/cache'

export default async function DetainedStudentsPage() {
  const detainedStudents = await listDetainedStudentsForFaculty().catch(() => [])

  async function handleRelease(studentId: string) {
    'use server'
    await releaseDetainedStudent(studentId)
    revalidatePath('/detained-students')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Detained Students Panel</h1>
        <p className="text-xs text-gray-500 mt-1">
          Faculty authority: <span className="text-emerald-700 font-semibold">release detained students to active status</span>. Releasing a student unlocks their row on marking sheets and records an official audit entry.
        </p>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Detained Students in Your Sections ({detainedStudents.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3 font-semibold">Roll Number</th>
                <th className="px-6 py-3 font-semibold">Student Name</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {detainedStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No students currently detained in your assigned sections.
                  </td>
                </tr>
              ) : (
                detainedStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-rose-600">{st.rollNo}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{st.fullName}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                        Detained (Locked on Marking Sheet)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={handleRelease.bind(null, st.id)}>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                        >
                          Release to Active
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
