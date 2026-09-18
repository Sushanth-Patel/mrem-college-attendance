import { listAuditLogs } from '@/lib/admin/audit'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { field?: string; role?: string }
}) {
  const logs = await listAuditLogs({
    fieldChanged: searchParams.field,
    changedByRole: searchParams.role as 'student' | 'faculty' | 'admin' | undefined,
    limit: 150,
  }).catch(() => [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Trail</h1>
        <p className="text-xs text-gray-500 mt-1">
          Permanent, tamper-evident audit record of every attendance mark modification, irregular status toggle, and detention transition.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <select
            name="field"
            defaultValue={searchParams.field || ''}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Fields</option>
            <option value="status">status (attendance mark)</option>
            <option value="attendance_flag">attendance_flag (regular / irregular)</option>
            <option value="account_status">account_status (active / detained / transferred)</option>
            <option value="admin_unlocked">admin_unlocked (override)</option>
          </select>

          <select
            name="role"
            defaultValue={searchParams.role || ''}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Roles</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>

          <button
            type="submit"
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition"
          >
            Filter Logs
          </button>
        </form>

        <span className="text-xs text-gray-500 font-mono">Total Events: {logs.length}</span>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Performed By</th>
                <th className="px-6 py-3 font-semibold">Affected Entity</th>
                <th className="px-6 py-3 font-semibold">Field Modified</th>
                <th className="px-6 py-3 font-semibold">Old Value &rarr; New Value</th>
                <th className="px-6 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No audit records matching the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const changer = log.changer as { full_name: string; email: string } | null
                  const student = log.student as { roll_no: string; profiles?: { full_name: string } } | null
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-mono text-[11px] text-gray-500">
                        {new Date(log.changed_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900 block">{changer?.full_name ?? 'Admin'}</span>
                        <span className="text-[10px] text-violet-700 capitalize">{log.changed_by_role}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px]">
                        {student?.roll_no ? (
                          <span>Roll No: <strong className="text-gray-900">{student.roll_no}</strong></span>
                        ) : log.attendance_record_id ? (
                          <span className="text-gray-500">Record: {log.attendance_record_id.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-violet-700 font-semibold">
                        {log.field_changed}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-rose-600 font-mono line-through mr-1.5">{log.old_value ?? 'NULL'}</span>
                        &rarr;
                        <span className="text-emerald-600 font-mono font-bold ml-1.5">{log.new_value}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 italic text-[11px]">
                        {log.reason || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
