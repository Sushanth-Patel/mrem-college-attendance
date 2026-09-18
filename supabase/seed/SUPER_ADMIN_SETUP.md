# Super-Admin Seed (Step 2)

Initial account values:

- Email: `admin@mrem.ac.in` (change if needed)
- Name: `Super Admin`
- Password: set through `SUPER_ADMIN_PASSWORD` environment variable at runtime

## Run

1. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPER_ADMIN_EMAIL` (default: `admin@mrem.ac.in`)
   - `SUPER_ADMIN_PASSWORD` (choose a strong password, do not commit it)
   - `SUPER_ADMIN_NAME` (default: `Super Admin`)
2. Execute:

```bash
node scripts/seed-super-admin.mjs
```

The script creates (or reuses) the auth user and upserts `profiles.role = 'admin'`.
