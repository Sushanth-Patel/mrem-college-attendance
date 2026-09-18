import { createClient } from '@supabase/supabase-js'

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD',
  'SUPER_ADMIN_NAME',
]

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const email = process.env.SUPER_ADMIN_EMAIL
const password = process.env.SUPER_ADMIN_PASSWORD
const fullName = process.env.SUPER_ADMIN_NAME

const createResponse = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    role: 'admin',
  },
})

let userId = createResponse.data.user?.id

if (createResponse.error) {
  const createErrorMessage = createResponse.error.message.toLowerCase()
  const userAlreadyExists =
    createResponse.error.code === 'email_exists' ||
    createErrorMessage.includes('already registered') ||
    createErrorMessage.includes('already been registered')

  if (!userAlreadyExists) {
    throw createResponse.error
  }

  const usersResponse = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (usersResponse.error) {
    throw usersResponse.error
  }

  const existingUser = usersResponse.data.users.find((u) => u.email === email)
  if (!existingUser) {
    throw new Error(`User already exists but could not be found for email: ${email}`)
  }

  userId = existingUser.id

  // Re-running the seed must be able to repair an existing super-admin: reset
  // the password to SUPER_ADMIN_PASSWORD, re-confirm the email, and re-assert
  // the admin role in user_metadata. Without this the script is a silent no-op
  // on an account whose password nobody remembers, which is the one situation
  // you actually re-run it for.
  const repair = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'admin',
    },
  })

  if (repair.error) {
    throw repair.error
  }
}

if (!userId) {
  throw new Error('Failed to resolve super-admin user id')
}

const profileUpsert = await supabase.from('profiles').upsert(
  {
    id: userId,
    role: 'admin',
    full_name: fullName,
    email,
    is_active: true,
  },
  { onConflict: 'id' }
)

if (profileUpsert.error) {
  throw profileUpsert.error
}

console.log(`Super-admin ready: ${email} (${userId})`)
