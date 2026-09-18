-- OTP codes table for custom email verification flow (PRD §4.1)
-- Used instead of Supabase built-in OTP for explicit control over
-- the 6-digit code UX and Resend email template.

CREATE TABLE otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: otp_codes should only be accessed via server-side service role
-- so no RLS policies needed (service role bypasses RLS).
-- But we still enable RLS to prevent client-side access.
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies = no client-side access at all (only service role can access)
