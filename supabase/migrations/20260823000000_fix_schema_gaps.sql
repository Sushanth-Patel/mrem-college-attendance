-- Migration: Fix schema gaps identified in PRD v4.0 audit
-- 1. Add missing otp_verified column to signup_requests
-- 2. Add missing term_start_date column to sections

-- ========== signup_requests: add otp_verified (PRD §4.1) ==========
ALTER TABLE signup_requests
ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN signup_requests.otp_verified IS
  'True once the mailbox-verification OTP succeeds. Account is only created after this is true (PRD §4.1).';

-- ========== sections: add term_start_date (PRD §3, §3.1, §6.11) ==========
-- Default to current_date for any pre-existing rows; new rows will always have it set explicitly.
ALTER TABLE sections
ADD COLUMN IF NOT EXISTS term_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN sections.term_start_date IS
  'Default source for students.joining_date at signup (PRD §3.1, §6.11). Admin sets explicitly per section.';
