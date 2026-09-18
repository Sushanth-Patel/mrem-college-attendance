'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Reveal } from '@/components/motion'
import { formatYearAndSemester } from '@/lib/academic'

type StudentProfile = {
  id: string
  fullName: string
  email: string
  rollNo: string
  fatherName: string
  collegeName: string
  joiningDate: string
  accountStatus: string
  attendanceFlag: string
  phoneNumber: string
  parentPhoneNumber: string
  dob: string
  gender: string
  bloodGroup: string
  residenceType: 'day_scholar' | 'hosteller'
  busRoute: string
  hostelDetails: string
  address: string
  avatarUrl: string
  section?: {
    section_name: string
    year_of_study: number
    semester: string
    academic_year: string
    branches?: {
      name: string
      code: string
    } | null
  } | null
}

export default function StudentProfileEditor() {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form editable state
  const [formData, setFormData] = useState({
    phoneNumber: '',
    parentPhoneNumber: '',
    dob: '',
    gender: '',
    bloodGroup: '',
    residenceType: 'day_scholar' as 'day_scholar' | 'hosteller',
    busRoute: '',
    hostelDetails: '',
    address: '',
    avatarUrl: '',
  })

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  const isValidPhone = (v: string) =>
    /^\+?\d{10,13}$/.test(v.replace(/[\s()-]/g, ''))

  useEffect(() => {
    fetch('/api/student/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile)
          setFormData({
            phoneNumber: data.profile.phoneNumber || '',
            parentPhoneNumber: data.profile.parentPhoneNumber || '',
            dob: data.profile.dob || '',
            gender: data.profile.gender || '',
            bloodGroup: data.profile.bloodGroup || '',
            residenceType: data.profile.residenceType || 'day_scholar',
            busRoute: data.profile.busRoute || '',
            hostelDetails: data.profile.hostelDetails || '',
            address: data.profile.address || '',
            avatarUrl: data.profile.avatarUrl || '',
          })
        }
      })
      .catch(() => showToast('error', 'Failed to load profile details'))
      .finally(() => setLoading(false))
  }, [])

  // Handle local image file upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Image size must be under 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setFormData((prev) => ({ ...prev, avatarUrl: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.phoneNumber && !isValidPhone(formData.phoneNumber)) {
      showToast('error', 'Invalid student mobile number — use 10–13 digits.')
      return
    }
    if (formData.parentPhoneNumber && !isValidPhone(formData.parentPhoneNumber)) {
      showToast('error', 'Invalid parent mobile number — use 10–13 digits.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setProfile((prev) => (prev ? { ...prev, ...formData } : null))
      setIsEditModalOpen(false)
      showToast('success', 'Profile and picture updated successfully!')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error updating profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading Student Academic Profile &amp; Records...
      </div>
    )
  }

  const branchName = profile?.section?.branches?.name || 'Computer Science and Engineering'
  const branchCode = profile?.section?.branches?.code || 'CSE'
  const sectionName = profile?.section?.section_name || 'A'
  const yearOfStudy = profile?.section?.year_of_study || 4
  const semester = profile?.section?.semester || 'odd'

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border shadow-sm ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="font-semibold">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Top Banner with Edit Button */}
      <Reveal from="up" distance={16}>
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Student Photo */}
            <div className="relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-200 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center text-3xl font-black shadow-md shadow-indigo-500/20">
                  {profile?.fullName?.charAt(0) || 'S'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Student Profile &amp; Records
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Enrollment
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {profile?.fullName}
              </h1>
              <p className="text-xs font-mono font-bold text-indigo-600 flex items-center gap-2">
                <span>HT No: {profile?.rollNo}</span>
                <span>•</span>
                <span className="text-slate-500 font-sans font-medium">{profile?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <span>✏️</span>
              <span>Edit Details &amp; Photo</span>
            </button>
            <Link
              href="/student/slip"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
            >
              <span>📄</span>
              <span>Attendance Slip</span>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Profile Grid Details (Professional Read-Only Presentation) */}
      <Reveal from="up" distance={16} delay={0.04}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Academic Enrollment */}
          <div className="p-6 bg-white/95 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>🎓</span>
              <span>Academic &amp; Program Enrollment</span>
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Hall Ticket / Roll No</span>
                <span className="font-mono font-bold text-slate-900">{profile?.rollNo}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Department</span>
                <span className="font-bold text-slate-900">{branchName} ({branchCode})</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Year &amp; Semester</span>
                <span className="font-bold text-slate-900">{formatYearAndSemester(yearOfStudy, semester)}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Class Section</span>
                <span className="font-bold text-indigo-700 font-mono">Section {sectionName}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Institution</span>
                <span className="font-medium text-slate-700">{profile?.collegeName || 'MREM Autonomous'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Communication */}
          <div className="p-6 bg-white/95 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>📞</span>
              <span>Contact &amp; Emergency Registry</span>
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Student Mobile</span>
                <span className="font-mono font-bold text-slate-900">
                  {profile?.phoneNumber || 'Not registered'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Parent / Guardian Mobile</span>
                <span className="font-mono font-bold text-indigo-700">
                  {profile?.parentPhoneNumber || 'Not registered'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Official College Email</span>
                <span className="font-mono text-slate-700">{profile?.email}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Permanent Address</span>
                <span className="font-medium text-slate-900 text-right max-w-xs truncate">
                  {profile?.address || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Personal & Identification */}
          <div className="p-6 bg-white/95 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>👤</span>
              <span>Personal Records</span>
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Father&apos;s / Guardian Name</span>
                <span className="font-bold text-slate-900">{profile?.fatherName || 'Not specified'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-bold font-mono text-slate-900">{profile?.dob || 'Not specified'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Gender</span>
                <span className="font-medium text-slate-900 capitalize">{profile?.gender || 'Not specified'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Blood Group</span>
                <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {profile?.bloodGroup || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Logistics & Transport */}
          <div className="p-6 bg-white/95 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>🚌</span>
              <span>Residence &amp; Transit Logistics</span>
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Residence Mode</span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 capitalize">
                  {profile?.residenceType === 'hosteller' ? 'Campus Hosteller' : 'Day Scholar'}
                </span>
              </div>
              {profile?.residenceType === 'hosteller' ? (
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Hostel &amp; Room Details</span>
                  <span className="font-medium text-slate-900">{profile?.hostelDetails || 'Not specified'}</span>
                </div>
              ) : (
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">College Bus Route</span>
                  <span className="font-medium text-slate-900">{profile?.busRoute || 'Self Transit'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Separate Edit Profile Details Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Student Profile Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your contact phone, residence logistics, and profile picture.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Student Photo or College ID Card Upload */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Student Photo / College ID Card
                  </label>
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    Official Photo Document
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {formData.avatarUrl ? (
                    <img
                      src={formData.avatarUrl}
                      alt="Student ID / Photo Preview"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-400 shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-xl border border-indigo-200">
                      {profile?.fullName.charAt(0) || 'S'}
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <span>📷</span>
                      <span>Upload Photo or College ID Card</span>
                    </button>
                    <p className="text-[10px] text-slate-500">
                      Upload your official passport photo or your scanned College ID Card (JPG, PNG, max 2MB).
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Student Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Parent / Guardian Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.parentPhoneNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parentPhoneNumber: e.target.value }))}
                    placeholder="e.g. 9876543211"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Personal details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dob: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Blood Group
                  </label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    <option value="">Select Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Residence Logistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Residence Mode
                  </label>
                  <select
                    value={formData.residenceType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        residenceType: e.target.value as 'day_scholar' | 'hosteller',
                      }))
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  >
                    <option value="day_scholar">Day Scholar</option>
                    <option value="hosteller">Campus Hosteller</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {formData.residenceType === 'hosteller' ? 'Hostel & Room Details' : 'College Bus Route'}
                  </label>
                  <input
                    type="text"
                    value={formData.residenceType === 'hosteller' ? formData.hostelDetails : formData.busRoute}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [formData.residenceType === 'hosteller' ? 'hostelDetails' : 'busRoute']: e.target.value,
                      }))
                    }
                    placeholder={formData.residenceType === 'hosteller' ? 'e.g. Block B, Room 204' : 'e.g. Route 12 - Secunderabad'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Permanent Address */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Permanent Residential Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  rows={2}
                  placeholder="Street, locality, city, pincode..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
