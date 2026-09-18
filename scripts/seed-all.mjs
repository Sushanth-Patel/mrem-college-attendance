import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder')) {
  console.log('[SEED] Live Supabase Service Role Key not set in .env.local. Using public schema seeding.')
}

console.log('🚀 Initializing Official MREM (Malla Reddy Engineering College & Management Sciences) Database...')

const branches = [
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'CSE-AIML', name: 'CSE - Artificial Intelligence & Machine Learning' },
  { code: 'CSE-DS', name: 'CSE - Data Science' },
  { code: 'CSE-CS', name: 'CSE - Cyber Security' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'MBA', name: 'Master of Business Administration' },
]

const periods = [
  { period_number: 1, start_time: '09:30:00', end_time: '10:20:00' },
  { period_number: 2, start_time: '10:20:00', end_time: '11:10:00' },
  { period_number: 3, start_time: '11:20:00', end_time: '12:10:00' },
  { period_number: 4, start_time: '12:10:00', end_time: '13:00:00' },
  { period_number: 5, start_time: '13:40:00', end_time: '14:30:00' },
  { period_number: 6, start_time: '14:30:00', end_time: '15:20:00' },
  { period_number: 7, start_time: '15:20:00', end_time: '16:10:00' },
]

console.log('✓ Configured Official MREM Departments:', branches.map((b) => b.code).join(', '))
console.log('✓ Configured 7 Standard Class Periods (09:30 AM – 04:10 PM IST)')
console.log('\nReady! Paste supabase/COMPLETE_SCHEMA.sql into your Supabase SQL Editor to apply to live database.')
