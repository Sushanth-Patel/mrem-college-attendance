-- ============================================================
-- MARKED-BY ATTRIBUTION + HOLIDAY STATUS (PRD §6.6, §6.7, §8)
-- ============================================================
-- Adds per-record attribution to attendance_records so the overwrite banner,
-- the audit trail, and "who actually marked this" are answerable at the
-- record level, and extends session_status with 'holiday' so Admin can
-- declare non-working days distinctly from a cancelled class (PRD §5.4).
--
-- Apply manually in the Supabase SQL editor (same workflow as prior
-- migrations), then re-run the verification probe.

-- ---------- 1. Per-record attribution columns ----------
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS marked_by_role user_role NOT NULL DEFAULT 'faculty',
  ADD COLUMN IF NOT EXISTS marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS admin_unlocked BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the session-level attribution already on the live schema:
-- the session's actual_faculty_id is the person who marked its records.
UPDATE public.attendance_records ar
SET marked_by = s.actual_faculty_id,
    marked_by_role = CASE WHEN s.is_admin_marked THEN 'admin'::user_role ELSE 'faculty'::user_role END,
    marked_at = COALESCE(s.marked_at, now())
FROM public.sessions s
WHERE s.id = ar.session_id
  AND ar.marked_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by
  ON public.attendance_records (marked_by);

-- ---------- 2. Stamp attribution on every write going forward ----------
CREATE OR REPLACE FUNCTION public.set_attendance_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.marked_by := auth.uid();
  NEW.marked_at := now();
  IF NEW.marked_by_role IS NULL OR TG_OP = 'INSERT' THEN
    SELECT p.role INTO NEW.marked_by_role FROM public.profiles p WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_attribution ON public.attendance_records;
CREATE TRIGGER trg_attendance_attribution
BEFORE INSERT OR UPDATE OF status ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.set_attendance_attribution();

-- ---------- 3. session_status gains 'holiday' ----------
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'holiday' AFTER 'scheduled';

-- ---------- 4. Edit-window override flag on sessions ----------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS edit_window_override BOOLEAN NOT NULL DEFAULT false;

-- ---------- 5. Self-check (run after applying) ----------
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'attendance_records'
--    AND column_name IN ('marked_by','marked_by_role','marked_at','admin_unlocked');
-- SELECT unnest(enum_range(NULL::session_status));
