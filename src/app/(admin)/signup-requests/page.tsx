import { listAllSignupRequests, approveSignupRequest, rejectSignupRequest } from '@/lib/admin/signup-requests'
import { revalidatePath } from 'next/cache'

export default async function SignupRequestsPage() {
  const requests = await listAllSignupRequests().catch(() => [])

  async function handleApprove(requestId: string, matchedRosterId: string) {
    'use server'
    await approveSignupRequest(requestId, matchedRosterId)
    revalidatePath('/signup-requests')
  }

  async function handleReject(requestId: string, formData: FormData) {
    'use server'
    const reason = formData.get('reason') as string
    await rejectSignupRequest(requestId, reason || 'Rejected by administrator')
    revalidatePath('/signup-requests')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pending Signup Requests</h1>
        <p className="text-xs text-gray-500 mt-1">
          Review self-signup registrations requiring administrative clearance. Approving a request links the account to institutional records and enables portal access.
        </p>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Requests Queue ({requests.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="px-6 py-3 font-semibold">Submitted Name</th>
                <th className="px-6 py-3 font-semibold">Role & ID</th>
                <th className="px-6 py-3 font-semibold">Submitted Email</th>
                <th className="px-6 py-3 font-semibold">Submitted Date</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No pending signup requests. All users match roster or have been approved.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900">{req.submitted_name}</td>
                    <td className="px-6 py-4 font-mono">
                      <span className="capitalize text-violet-700 font-semibold">{req.submitted_role}: </span>
                      {req.submitted_id}
                    </td>
                    <td className="px-6 py-4">{req.submitted_email}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        req.status === 'pending'
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : req.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <form action={handleApprove.bind(null, req.id, req.submitted_id)}>
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition"
                            >
                              Approve
                            </button>
                          </form>

                          <form action={handleReject.bind(null, req.id)} className="flex items-center gap-1">
                            <input
                              type="text"
                              name="reason"
                              placeholder="Reason"
                              required
                              className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 w-24"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-xs transition"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500">Reviewed</span>
                      )}
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
