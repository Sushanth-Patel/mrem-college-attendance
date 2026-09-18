# Schema Verification (Step 1)

Run these files in order on your Supabase project:

1. `supabase/migrations/20260822233000_initial_schema.sql`
2. `supabase/verify/verify_schema.sql`

Expected verification outcome:
- All Section 8 enums/tables/view exist
- RLS is enabled on protected tables
- Faculty scoping/admin policies are listed in `pg_policies`
- Baseline indexes are present

## RLS Lockdown Probe (Step 2)

After applying `supabase/migrations/20260915120000_rls_lockdown_and_alerts.sql`, run the
access-control regression probe (configured via environment variables in `.env.local`):

```
node supabase/verify/probe_rls.mjs
```

Expected: 21/21 PASS — anon reads nothing on any table, students read only their own
rows, faculty read the roster but no admin tables, admin read everything except
`otp_codes` (service-role only).
