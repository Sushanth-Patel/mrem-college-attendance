# College Attendance System — Master PRD (for AI Coding Agent)

**Version:** 4.0 Final
**Status:** Requirements locked. Build against this document directly. This version supersedes all prior drafts.
**Institution reference:** Malla Reddy Engineering College and Management Sciences (CSE dept. timetable used as the structural reference — see Section 5)
**Deployment target:** Google Antigravity

---

## 1. Product Summary

A web-based college attendance system, built by a solo developer at zero infrastructure cost, for a single department initially (~50–500 students) but architected to support multiple branches and sections from day one. Faculty mark attendance manually per class period; students self-view their attendance; Admin/HoD manage the system and pull reports. No external integrations (standalone system).

**Tech stack (locked):**
- Frontend + Backend: **Next.js** (React, full-stack)
- Database + Auth: **Supabase** (PostgreSQL, includes Auth with OTP/password-reset built in)
- Hosting: **Vercel** (app, Hobby/free tier) + **Supabase** (DB/Auth, free tier)
- Email (OTP + alerts): **Resend** (free tier)
- CSV parsing (roster upload): **papaparse**
- Excel export: **exceljs**
- PDF export: **pdf-lib** or **@react-pdf/renderer**

**See Section 12 for free-tier constraints that affect design decisions below — read it before implementing alerts, signup, or deployment.**

---

## 2. Roles

| Role | Account creation | Core permissions |
|---|---|---|
| **Student** | Direct self-signup (email + roll number + password), no approval or prior roster required (see 4.1) | View own attendance only: overall %, subject-wise %, session history |
| **Faculty** | Direct self-signup (email + employee ID + password) | Mark attendance for **any session**, not just their own default-assigned slot (supports frequent class swaps); edit within edit window (see 6.5); view attendance summaries for classes they teach; remove students from the Detained list (`detained → active` only, see 6.10) |
| **Admin/HoD** | Provisioned only, never self-signup (see 4.2) | Full CRUD on branches/sections/subjects/timetable; manage all accounts; mark attendance directly for any session (flagged distinctly, see 6.7); unlock attendance edits beyond window; set/clear a student's Irregular flag and any `account_status` transition (active/detained/transferred); set/override `joining_date`; trigger low-attendance alerts; view full audit log; generate/download reports |

**Faculty marking authority is intentionally open, not subject-restricted.** Every session already records who actually conducted it (`actual_faculty_id`), separate from the timetable's default assignment, and every mark is fully auditable — so open swapping doesn't sacrifice accountability, it just avoids making Admin a bottleneck for something faculty already handle informally among themselves. Admin/HoD direct marking exists for genuine no-faculty-available gaps, not as the only path for ordinary swaps.

One shared login page for all roles; after auth, redirect to role-specific dashboard.

---

## 3. Organizational Data Hierarchy

```
Branch (e.g. CSE, CSD, ECE)
  → Section (scoped by branch + year_of_study + semester + academic_year + section_name, e.g. "CSE / Year 4 / Odd / 2026-27 / Section A")
    → Timetable (Day × Period grid, one instance per section)
      → Sessions (actual dated occurrence of each timetable slot)
        → Attendance Records (one per student per session)
```

- Every **subject** belongs to a branch + year_of_study + semester.
- Every **section** has its own timetable — even if two sections share a subject, they have separate timetable rows and can have different faculty.
- A **student** belongs to exactly one section.
- A **faculty member** can be linked to multiple (subject, section) pairs, potentially across branches.
- **Electives**: assigned once per semester by Admin/HoD for the entire section (not chosen individually by students) — implemented as a normal row in `section_subjects` (see schema).
- **Section lifecycle**: sections carry an `is_active` flag. Graduated or retired sections are deactivated rather than deleted, so historical attendance data stays intact but the section no longer appears in active pickers (timetable builder, marking dropdowns, new-signup roster targets). Colleges reuse names like "4th Year Section A" every year — this flag is what stops old graduated batches from cluttering current dashboards.
- **Section term start date**: every section carries a `term_start_date`. This is what regular (non-lateral-entry) students' `joining_date` defaults to automatically at signup — see 3.1 and 6.12.

### 3.1 Mid-Semester / Lateral Joiners
Every student carries a `joining_date`. For normal admissions, this **auto-populates from the section's `term_start_date`** at signup — no manual entry needed. For lateral-entry students (e.g., Diploma lateral entry into 2nd Year / 3rd Semester, typically joining 3–4 weeks after regular classes start), Admin explicitly overrides `joining_date` to their actual start date during signup approval. This prevents a late joiner from being penalized for classes held before they were even enrolled (full mechanism in 6.12).

---

## 4. Authentication & Account Management

### 4.1 Student/Faculty Self-Signup (Direct, No Roster Prerequisite)

**Fields:** College Email, Roll Number (students) / Employee ID (faculty), Password, Confirm Password.

1. **Direct Registration:** Any student or faculty member can self-register directly using their college email, Roll Number/Employee ID, and password. No prior roster upload is required, and no admin approval or pending review queue is required.
2. **Instant Account Creation & Login:** Accounts are created with active status immediately upon signup, allowing students and staff to log in right away.
3. **Optional Roster Auto-Enrichment:** If the user's Roll Number or Employee ID happens to be pre-loaded in the college roster database (`roster_students` / `roster_faculty`), their Name, Branch, and Section are automatically enriched as a convenience. If not on the roster, the student is still registered and active immediately, mapped to an active institutional section.
4. **Duplicate Prevention:** The system checks that the Roll Number/Employee ID or email is not already registered; if already registered, the user is prompted to sign in directly.

### 4.2 Admin/HoD Provisioning
- One seed Super-Admin account (`admin@mrem.ac.in`) is created manually during initial deployment (not through the app UI — e.g., a one-time seed script or direct DB insert).
- The Super-Admin creates further Admin/HoD accounts from within the app.
- Admin/HoD is **never** self-signup — this role has full data access and must stay tightly controlled.

### 4.3 Password Management
- Self-service "Forgot Password" via email (OTP or reset link) for all roles, handled by Supabase Auth.

### 4.4 Roster Upload (pre-loaded lists used for signup verification)
- Admin uploads a CSV/Excel file to populate `roster_students` / `roster_faculty`.
- **Student roster fields:** Roll No, Full Name, College Email, Branch, Year, Section
- **Faculty roster fields:** Employee ID, Full Name, College Email, Department
- **Section mapping validation at upload time:** the spreadsheet contains plain-text section labels (e.g., "CSE Year 4 Section A"). On upload, each row's label is matched against an existing `sections` row (by branch/year/semester/section_name), and any row that doesn't cleanly match a real, active section is flagged (`needs_review = true`) rather than silently saved as orphaned/corrupt data. Flagged rows surface in a dedicated "Needs Review" list in the Admin dashboard.
- **Resolving a flagged row:** if Admin edits a flagged row and it re-passes validation, `needs_review` and `reviewed` both clear automatically. If Admin instead confirms the row is correct as-is (e.g., a legitimately unusual but valid roll number), they can manually mark it `reviewed = true`, removing it from the active "Needs Review" list while `needs_review = true` remains a permanent record that it was flagged and consciously accepted.

---

## 5. Timetable Structure

Based on the confirmed reference timetable (B.Tech, CSE, IV Year I Sem):

- **8 fixed periods per day:**
  1. 09:30–10:20
  2. 10:20–11:10
  3. *(Break: 11:10–11:20)*
  4. 11:20–12:10
  5. 12:10–13:00
  6. *(Lunch: 13:00–13:40)*
  7. 13:40–14:30
  8. 14:30–15:20
  9. 15:20–16:10
- **6 days per week:** Monday–Saturday
- Timetable is a grid of **Day × Period → Subject + default Faculty**, defined per section by Admin/HoD.

### 5.1 Session Types
- **Single-period subjects** (regular theory) — one period = one attendance session.
- **Multi-period blocks** (Labs, Project Stage-I) — span 2–3 consecutive periods on the grid. Each period within the block is still its own `timetable_entries` row and generates its own `sessions` row and its own `attendance_records` row per student (3 hours = 3 underlying records) — **but the marking UI lets faculty set all 3 in a single tap** per student, rather than repeating the tap three times (see 6.7 for the exact mechanism). Because the 3 records stay independently editable, faculty can still correct just one period afterward if a student left early.

### 5.2 Non-Academic Periods
- **Project Stage-I**: tracked with the same Present/Absent/Excused workflow as academic subjects (it's evaluated).
- **Library** and **Sports**: excluded entirely from attendance tracking and from percentage calculations. These appear on the timetable grid (for room/schedule reference) but generate no attendance session.

### 5.3 Class Swaps & Open Faculty Marking
- Any faculty member can mark attendance for **any** session, not just their own default-assigned slot — this directly supports the college's frequent teacher swaps, which was a foundational requirement of this system.
- Each `sessions` record stores which faculty **actually** conducted it (`actual_faculty_id`), separate from the timetable's default assignment. This is automatically part of the permanent record — no separate notification is sent to the original timetable owner; it's kept simple and fully traceable via the audit log if ever needed.
- **Two entry paths to the marking screen (Faculty):**
  1. **Today's Schedule tap-through** — faculty's dashboard lists their sessions for the current day in period order; tapping one opens marking directly.
  2. **Manual lookup** — faculty pick section → subject → date from dropdowns, for marking a different day, covering a swapped class, or a session not on today's default schedule.

  Both paths resolve to the same underlying `sessions` record and the same marking UI.

### 5.4 Cancelled/Holiday Sessions
- Faculty or Admin can mark a scheduled session as **Holiday/Cancelled** instead of marking students absent.
- A cancelled session is **excluded from every student's attendance denominator** for that day (does not count as a period held).
- This can be applied **retroactively** — e.g., Admin declares a past date a holiday after the fact (unscheduled college closure, weather, etc.), even after some of that day's sessions have already been marked. Because the calculation is driven entirely by `sessions.status` at query time (see the `student_subject_attendance` view), flipping a session's status to `holiday`/`cancelled` automatically and correctly removes it from every affected student's denominator with no separate recalculation step, and no existing attendance records are deleted.

---

## 6. Attendance Rules (Core Business Logic)

### 6.1 Granularity
Attendance is recorded **per subject, per period-session**. Theory and Lab components of the same course (e.g., "C&NS Theory" and "C&NS Lab") are **fully separate subjects** with **separate percentages** — they are never combined, matching their separate subject codes (e.g., CS701PC vs. CS703PC).

### 6.2 Status Values
- `present`
- `absent`
- `excused` — faculty discretion, no formal request/approval process required
- (Session-level, not per-student) `holiday` / `cancelled`

### 6.3 Percentage Formulas
```
Subject %  = (periods marked 'present' in that subject, from joining_date onward) / (periods held in that subject, excluding cancelled/holiday, from joining_date onward) × 100

Overall %  = (periods marked 'present' across ALL tracked subjects, from joining_date onward) / (periods held across ALL tracked subjects, excluding cancelled/holiday, from joining_date onward) × 100
```

**`excused` counts the same as `absent`** in this formula — it does NOT count toward "attended." It is still stored and displayed as a distinct status (so reports can show, e.g., "3 absences, 1 of which was excused"), but it never inflates the percentage. This is a deliberate anti-favoritism safeguard: if `excused` boosted the percentage, a faculty member could quietly protect a student's attendance with no visible cost.

**Day-one safeguard:** when `periods_held = 0` for a student/subject (e.g., before any session has occurred, or immediately after a lateral-entry student's `joining_date`), the UI must display **"N/A"**, not "0%" or a blank/broken value — never let a student be falsely flagged as a defaulter before any class has happened for them.

### 6.4 Threshold & Alerts
- Default/only threshold: **75%, flat, college-wide** (no per-subject override in v1).
- Alerts are **NOT automatic**. Admin/HoD manually triggers a "Send Low-Attendance Alerts" action (e.g., before exams), which emails every student currently below 75% (overall or subject-wise). Each trigger is logged (`alert_batches` table).
- **Sends are throttled, client-driven, and resumable — not a server-side blast.** Resend's free tier caps at 100 emails/day (see 12.2), and a long-running server-side background job risks Vercel's serverless execution timeout on its free tier (see 12.1). Instead: triggering a batch populates `alert_queue` (one row per recipient), and the Admin's own "Sending Alerts" dashboard screen drives the send — while it's open, it repeatedly calls a "send next 5" endpoint with a brief pause between calls, shown as a visible progress bar, stamping `alert_queue.sent_at` on each success.
- **Resumable, not lost, on interruption.** If Admin closes the tab or loses connection mid-batch, `alert_queue` rows with `sent_at IS NULL` are still pending — reopening the "Sending Alerts" screen for that batch resumes from where it left off. Because of the 100/day cap, a batch of more than 100 recipients will span multiple calendar days automatically; if timing before an exam matters, trigger the batch a few days early to leave buffer.

### 6.5 Edit Window & Corrections
- Faculty can mark or edit attendance only for the **same day or the next day** after a session — not indefinitely into the past. (This default will be reviewed after a live usage period.)
- **Admin/HoD override:** Admin/HoD can unlock a specific attendance record beyond this window for a legitimate correction, but must enter a reason when doing so. This is flagged (`admin_unlocked = true`) and logged distinctly in the audit trail.
- **All session-date generation and edit-window cutoffs are computed in `Asia/Kolkata` (IST), not server UTC.** Cloud hosts default to UTC; without an explicit timezone lock, an IST evening session (e.g., 15:20–16:10) would cross the UTC midnight boundary hours before the actual IST day ends, prematurely locking faculty out of editing that day's attendance. Every "today," "next day," and edit-window comparison must convert through IST.

### 6.6 Audit Trail (Non-Negotiable)
Every change to an attendance record — and every change to a student's `attendance_flag` or `account_status` (see 6.10) — is permanently logged. **Nothing is ever hard-deleted.** The audit log is append-only, capturing for every entry:
- Who made it (user + role)
- What changed (field-level, e.g. `status: absent → present`, `attendance_flag: regular → irregular`, `account_status: active → detained`)
- Old value → new value
- Reason (required for admin-unlocked edits, optional otherwise)
- Timestamp

Full history must be reconstructable at any point in time for any student, session, or faculty member.

### 6.7 Admin/HoD Direct Marking
Admin/HoD can mark attendance directly for a session, not just unlock/override existing records — for genuine coverage gaps (e.g., a period with truly no faculty available).

- `sessions.actual_faculty_id` is **nullable** specifically for this case — a session can exist with no faculty at all when Admin/HoD covers it directly; `actual_faculty_id` stays `NULL` and the attendance records carry `marked_by_role = 'admin'`.
- This is **not** treated identically to a normal faculty mark. Every attendance record marked by an Admin/HoD account carries `marked_by_role = 'admin'` and is rendered distinctly wherever marks are displayed or audited — e.g., "Marked by Admin — covering session" instead of a faculty name. This is derived directly from `marked_by_role`, not a separate boolean, so there's no risk of two fields drifting out of sync.
- Admin-covered marks still go through the same `attendance_records` table, same `UNIQUE(session_id, student_id)` constraint, and same audit logging as any other mark — only the flag and its display treatment differ.

### 6.8 Lab / Multi-Period Block Marking
Marking a 3-period lab block one student at a time, three separate times, is impractical for faculty. The marking UI provides a **single-tap action per student that writes the same status to all 3 underlying period-records in that block simultaneously.**

- Under the hood, the block is still 3 separate `sessions` rows (per 5.1) and the tap creates/updates 3 separate `attendance_records` rows — one per period — with the same status.
- Because the records remain separate, faculty can **go back and edit just one period** afterward (e.g., a student left after period 1 of a 3-period lab: mark Present for the block via the single tap, then edit periods 2 and 3 individually to Absent).
- The block-level "single tap" is a UI convenience only — no separate database representation, and it doesn't bypass the edit window (6.5) or audit logging (6.6).

### 6.9 Overwrite / Conflict Warning
The `UNIQUE(session_id, student_id)` constraint on `attendance_records` prevents duplicate rows at the database level, but nothing previously surfaced this to a second faculty member before they acted — a real risk given open swap-based marking (5.3).

- Before submitting a mark for a session that **already has attendance records**, the UI must show a prominent banner: *"Attendance already submitted by [Faculty Name] at [Time]."*
- Any change beyond that point requires an explicit **overwrite confirmation prompt** — never a silent save. Confirming logs the overwrite event to `attendance_audit_log` same as any other edit.
- This is a UI-level check only — no schema change beyond what already exists.

### 6.10 Student Status: Two Independent Fields
Two separate concerns govern how a student shows up on the daily marking sheet, kept as **two distinct fields** because they answer different questions:

**a) `account_status`** — *does this student appear as a markable row at all?*
- `active` (default) — normal enrolled student, markable, appears on marking sheets.
- `detained` — formally detained (e.g., failed the attendance/academic requirement to progress). **Still visible** on the daily marking sheet, but rendered as a **locked/greyed row that cannot be ticked** while this status holds. Excluded from class denominators going forward (no new attendance records get created for them). Past records untouched.
- `transferred` — left the institution/section. Historical records remain fully intact and queryable, but does **not appear on any current daily marking sheet** at all.

**Who can change it:**
- Setting `detained` or `transferred`, and restoring `transferred → active`, is **Admin-only**.
- **Faculty have exactly one narrower power: `detained → active` only** — releasing a student from detention via a dedicated "Detained Students" panel listing every detained student in the sections they teach. Faculty cannot detain a student, only release one already detained.
- Admin/HoD can make any transition.
- Every change is logged via `attendance_audit_log` (6.6).

**b) `attendance_flag`** — *for markable students, what's their pre-checked default?* Only meaningful while `account_status = 'active'`. Either `regular` (default) or `irregular`:
- Set manually by **Faculty or Admin** — there is no automatic promotion/demotion based on attendance percentage in v1.
- On the marking sheet: `regular` students pre-check **Present**; `irregular` students pre-check **Absent**. Both are a starting default only, fully overridable per session with no extra friction.
- The "Irregular" list is visible and editable by Faculty at any time (not Admin-only), so it can't become a stale, invisible label a student can't get out of.
- Every change is logged (`field_changed = 'attendance_flag'`) the same way an attendance status change is.
- **Not shown to students** — faculty/admin-only, absent from the student dashboard, to avoid stigmatizing a student with a visible label.

**Marking sheet behavior:** `active` students are normal tickable rows, pre-checked per `attendance_flag`; `detained` students appear as locked, un-tickable rows; `transferred` students don't appear at all.

### 6.11 Joining Date / Late-Enrollment Safeguard
Lateral-entry and other mid-semester joiners must not be penalized for classes held before they were officially enrolled.

- Every student carries a `joining_date`, **defaulting automatically to their section's `term_start_date`** for normal admissions, and set explicitly by Admin for lateral entrants during signup approval or account creation.
- **All percentage calculations exclude sessions held before a student's `joining_date`** — both numerator and denominator (see the view in Section 8). A lateral-entry student's attendance % is computed only from their actual joining date forward.
- This does not hide or delete any session for anyone else — sessions before `joining_date` still exist normally for the rest of the section; they're simply excluded from *that student's* calculation.

---

## 7. Features by Module

### 7.1 Admin/HoD Dashboard
- Manage Branch → Section structure (create/edit sections, set `term_start_date`, toggle `is_active`)
- Upload/manage pre-loaded roster (CSV), with a "Needs Review" queue for rows flagged during upload validation (4.4)
- Review and approve/reject pending signup requests
- Manage all user accounts (activate/deactivate, correct errors)
- Provision additional Admin/HoD accounts
- Define subjects per branch/year/semester; assign electives per section per semester
- Build/edit the timetable per section (Day × Period → Subject + default Faculty)
- Mark sessions as Holiday/Cancelled, including retroactively (5.4)
- Mark attendance directly for a session (admin-covered, flagged distinctly — 6.7)
- Unlock attendance records beyond the edit window (reason required, logged)
- Set/clear a student's Irregular flag; set/clear `account_status` including detained/transferred, any transition (6.10)
- Set/override a student's `joining_date` for lateral entry (6.11)
- Trigger low-attendance alert emails on demand — throttled, resumable send (6.4)
- View full audit log (filterable by student, faculty, subject, date range)
- Generate/download reports (PDF/Excel): individual student, subject-wise class report, section overall summary, defaulters list — all filterable by branch/section

### 7.2 Faculty Dashboard
- View today's/upcoming sessions, with **one-tap marking access** directly from Today's Schedule
- **Manual selector mode**: pick any section/subject/date on demand (5.3) — needed for swaps, substitutions, makeup periods
- Mark attendance for **any** session (own or swapped, 5.3); for multi-period lab blocks, a single tap sets all periods at once, with the option to edit an individual period afterward (6.8)
- Mark each student: Present / Absent / Excused — `active` students default per their `attendance_flag` (Regular→Present, Irregular→Absent); `detained` students appear as a **locked, un-tickable row**; `transferred` students don't appear (6.10)
- Set/clear a student's "Irregular" flag (6.10)
- **Detained Students panel**: view every detained student in sections they teach; remove-only (`detained → active`), logged (6.10)
- **Overwrite warning**: banner + confirm prompt before overwriting an already-marked session (6.9)
- Edit previously submitted attendance within the edit window
- View subject-wise attendance summary for their own classes

### 7.3 Student Dashboard
- Self-signup flow (email + roll number + password/confirm + OTP verification, with approval-queue fallback for unmatched entries; 4.1)
- View own attendance: overall % and subject-wise % (Theory/Lab shown separately), computed from `joining_date` onward, showing "N/A" instead of 0%/blank before any session has been held for them (6.3, 6.11)
- View session-level history (date, subject, period, status), including a distinct display for Admin-covered sessions
- Receive low-attendance alert emails when Admin/HoD triggers a batch

---

## 8. Database Schema

Full schema (PostgreSQL/Supabase-ready DDL) — create these tables in this order to satisfy foreign key dependencies:

```sql
-- ========== USERS & AUTH ==========
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE signup_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE signup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_role user_role NOT NULL,
    submitted_name TEXT NOT NULL,
    submitted_id TEXT NOT NULL,             -- roll_no or employee_id as entered
    submitted_email TEXT NOT NULL,          -- typed email; stored whenever it fails to match the roster row
    matched_roster_id TEXT,                 -- roll_no/employee_id Admin assigns during review; NULL until reviewed
    otp_verified BOOLEAN NOT NULL DEFAULT false,  -- true once the mailbox-verification OTP (4.1) succeeds
    status signup_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- ========== ORGANIZATIONAL HIERARCHY ==========
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE
);

CREATE TYPE semester_type AS ENUM ('odd', 'even');

CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    semester semester_type NOT NULL,
    academic_year TEXT NOT NULL,
    section_name TEXT NOT NULL,
    term_start_date DATE NOT NULL,          -- default source for students.joining_date (3.1, 6.11)
    is_active BOOLEAN NOT NULL DEFAULT true, -- deactivate graduated/retired sections instead of deleting (Section 3)
    UNIQUE (branch_id, year_of_study, semester, academic_year, section_name)
);

CREATE TYPE attendance_flag_type AS ENUM ('regular', 'irregular');
CREATE TYPE student_account_status AS ENUM ('active', 'detained', 'transferred');

CREATE TABLE students (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    roll_no TEXT NOT NULL UNIQUE,
    section_id UUID NOT NULL REFERENCES sections(id),
    account_status student_account_status NOT NULL DEFAULT 'active', -- Admin-only changes, except faculty remove-only: detained → active (6.10)
    attendance_flag attendance_flag_type NOT NULL DEFAULT 'regular',  -- manual faculty/admin flag; drives marking-sheet default while active (6.10)
    joining_date DATE NOT NULL              -- excludes pre-joining sessions from this student's % (6.11); defaults to section.term_start_date, overridden for lateral entry
);

CREATE TABLE faculty (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL UNIQUE,
    branch_id UUID REFERENCES branches(id)
);

CREATE TABLE roster_students (
    roll_no TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    section_id UUID NOT NULL REFERENCES sections(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false, -- flagged by section-mapping validation on CSV upload (4.4)
    reviewed BOOLEAN NOT NULL DEFAULT false      -- true once Admin edits-and-repasses, or manually confirms as-is
);

CREATE TABLE roster_faculty (
    employee_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    branch_id UUID REFERENCES branches(id),
    matched BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    reviewed BOOLEAN NOT NULL DEFAULT false
);

-- ========== SUBJECTS ==========
CREATE TYPE subject_type AS ENUM ('theory', 'lab', 'project');

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    year_of_study SMALLINT NOT NULL,
    semester semester_type NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    subject_type subject_type NOT NULL,
    track_attendance BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (branch_id, code)
);

CREATE TABLE section_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    default_faculty_id UUID NOT NULL REFERENCES faculty(id),
    UNIQUE (section_id, subject_id)
);

-- ========== TIMETABLE ==========
CREATE TABLE period_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_number SMALLINT NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    label TEXT
);

CREATE TYPE weekday AS ENUM ('mon','tue','wed','thu','fri','sat');

CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id),
    day_of_week weekday NOT NULL,
    period_slot_id UUID NOT NULL REFERENCES period_slots(id),
    section_subject_id UUID REFERENCES section_subjects(id), -- NULL = non-academic (Library/Sports)
    room TEXT,
    UNIQUE (section_id, day_of_week, period_slot_id)
);

-- ========== SESSIONS ==========
CREATE TYPE session_status AS ENUM ('normal', 'holiday', 'cancelled');

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id),
    session_date DATE NOT NULL,
    actual_faculty_id UUID REFERENCES faculty(id), -- NULLABLE: NULL when Admin covers with no faculty involved (6.7)
    status session_status NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (timetable_entry_id, session_date)
);

-- ========== ATTENDANCE ==========
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    student_id UUID NOT NULL REFERENCES students(id),
    status attendance_status NOT NULL,
    marked_by UUID NOT NULL REFERENCES profiles(id), -- faculty OR admin/HoD (6.7)
    marked_by_role user_role NOT NULL,                -- 'faculty' or 'admin'; single source of truth for Admin-covered display — do not add a separate boolean
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    admin_unlocked BOOLEAN NOT NULL DEFAULT false,     -- true when edited beyond the normal window via Admin override (6.5)
    UNIQUE (session_id, student_id)
);

CREATE TABLE attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID REFERENCES attendance_records(id), -- NULLABLE: NULL for attendance_flag / account_status change entries (6.10)
    student_id UUID REFERENCES students(id),                     -- set when attendance_record_id is NULL, so flag/status changes stay traceable
    changed_by UUID NOT NULL REFERENCES profiles(id),
    changed_by_role user_role NOT NULL,
    field_changed TEXT NOT NULL,     -- 'status' | 'attendance_flag' | 'account_status'
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (attendance_record_id IS NOT NULL OR student_id IS NOT NULL)
);

-- ========== ALERTS ==========
CREATE TABLE alert_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by UUID NOT NULL REFERENCES profiles(id),
    threshold_used NUMERIC(5,2) NOT NULL,
    section_id UUID REFERENCES sections(id),   -- NULL = all sections
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recipient_count INT NOT NULL DEFAULT 0
);

CREATE TABLE alert_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES alert_batches(id),
    student_id UUID NOT NULL REFERENCES students(id),
    sent_at TIMESTAMPTZ,   -- NULL = not yet sent; drives resumable throttled sending (6.4, 12.2)
    UNIQUE (batch_id, student_id)
);

-- ========== DERIVED VIEW: attendance % per student per subject ==========
CREATE VIEW student_subject_attendance AS
SELECT
    ar.student_id,
    ss.subject_id,
    COUNT(*) FILTER (WHERE s.status = 'normal') AS periods_held,
    COUNT(*) FILTER (WHERE s.status = 'normal' AND ar.status = 'present') AS periods_attended,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE s.status = 'normal' AND ar.status = 'present')
        / NULLIF(COUNT(*) FILTER (WHERE s.status = 'normal'), 0),
        2
    ) AS attendance_pct -- NULL when periods_held = 0; UI must render this as "N/A" (6.3), never 0%/blank
FROM attendance_records ar
JOIN sessions s ON s.id = ar.session_id
JOIN students st ON st.id = ar.student_id
JOIN timetable_entries te ON te.id = s.timetable_entry_id
JOIN section_subjects ss ON ss.id = te.section_subject_id
WHERE s.session_date >= st.joining_date          -- excludes pre-joining sessions (6.11)
  AND st.account_status IN ('active', 'detained') -- detained students remain queryable for history; transferred are excluded
GROUP BY ar.student_id, ss.subject_id;
```

### 8.1 Schema Design Notes
- **`profiles` extends Supabase's `auth.users`** — do not build custom auth; use Supabase Auth for password hashing and reset flows. `signup_requests.otp_verified` gates actual account creation — the `profiles` row is only created after both the roster match and the OTP step succeed (4.1).
- **`signup_requests` is separate from `profiles`** — a failed roster match, or an unverified OTP, never creates a real account.
- **`students.joining_date` gates the attendance view directly (6.11)** — do not filter this in application code; the view's `WHERE s.session_date >= st.joining_date` is the single source of truth so it can't drift between web and any future mobile client. It defaults from `sections.term_start_date` at signup time for normal admissions; Admin overrides it explicitly for lateral entrants.
- **`students.account_status` transition rules are enforced at the application layer, not the database** — the DB allows any enum value, but application logic must restrict faculty-initiated changes to exactly `detained → active`, rejecting any other transition from a faculty session; Admin sessions may set any value. Marking-sheet queries must include both `active` and `detained` (rendering `detained` as locked) and exclude `transferred` entirely.
- **`roster_students`/`roster_faculty` are separate from `students`/`faculty`** — the roster is Admin's pre-loaded "who's allowed to sign up" list; `students`/`faculty` are real accounts that exist post-signup. `needs_review` flags rows the upload validation couldn't cleanly match to a section.
- **`timetable_entries` (template) vs. `sessions` (actual dated occurrence) is the core architectural split.** It's what allows: open faculty marking on any session (`sessions.actual_faculty_id` differs freely from the timetable default), cancellations (`sessions.status`), and per-period lab marking (each period is its own `timetable_entries` row, thus its own `sessions` row) — all without special-case logic elsewhere in the app.
- **`attendance_records.marked_by` references `profiles(id)`, not `faculty(id)`**, specifically so Admin/HoD accounts can mark directly (6.7). `marked_by_role` alone makes Admin-covered marks distinctly queryable and displayable — there is deliberately no separate `is_admin_covered` boolean, since a second column encoding the same fact risks drifting out of sync.
- **`sessions.actual_faculty_id` is nullable** to represent a session Admin covered with no faculty involved at all (6.7). Application code displaying "who taught this" must handle the `NULL` case.
- **The single-tap lab marking flow (6.8) has no dedicated schema** — it's an application-layer action writing 3 ordinary `attendance_records` rows in one request; each stays independently editable afterward.
- **`students.attendance_flag` is a manually-set enum, not a computed value** — never derive it from `attendance_pct`; it's only ever changed by an explicit Faculty/Admin action (6.10), and every change writes to `attendance_audit_log`. It is intentionally excluded from any student-facing query.
- **`attendance_audit_log` is append-only** and covers attendance-record changes, `attendance_flag` changes, and `account_status` changes. `attendance_record_id` is nullable specifically for flag/status entries, which populate `student_id` directly instead — the `CHECK` constraint ensures every row is traceable to at least one. Never UPDATE or DELETE rows here, only INSERT.
- **`alert_queue` is drained client-side** (6.4) — the Admin dashboard's "Sending Alerts" screen calls a "send next N" endpoint repeatedly while open, avoiding both Resend's daily cap and Vercel's serverless timeout. `WHERE sent_at IS NULL` for a given `batch_id` always identifies exactly what's left to send, whether the previous session finished or was interrupted.
- **The `excused = counts as not-attended` rule lives only in the `student_subject_attendance` view** — never duplicate this logic in application code.
- **The view includes `detained` students** so their historical attendance stays visible for reports/audit even though they're no longer markable; only `transferred` students are excluded from the view (though their raw historical rows remain in the underlying tables regardless).
- Do not add indexes speculatively beyond what's implied by the UNIQUE constraints above; add based on real query patterns once built.

---

## 9. Explicitly Out of Scope for v1

Do not build these — they are documented for roadmap awareness only:
- Mobile app (Android/iOS) — planned v2
- QR-code self check-in — planned v1.1
- GPS/geofencing — planned v2 (bundled with mobile, since browser GPS is unreliable indoors)
- Biometric/face recognition — planned v3
- RFID hardware integration — planned v3
- Formal leave-request/approval workflow — only build if informal faculty-discretion model proves insufficient later
- Automatic (threshold-based) computation of the "Irregular" flag — v1 is manual-only (6.10); an automatic version is a plausible v2 addition once real usage data exists
- Any ERP or third-party timetable integration — system is fully standalone

---

## 10. Success Criteria

- Faculty can mark a full class's attendance (~40 students) in under 60 seconds, including a single-tap full-block mark for lab sessions.
- Students can self-register directly (email + roll number + password) and log in immediately without admin approval or prior roster requirements, checking attendance % anytime with "N/A" shown before any session exists, and lateral-entry joiners never penalized for pre-joining sessions.
- Admin/HoD can generate a defaulters report in under 3 clicks, filterable by branch/section.
- Zero data loss on any edit — every change recoverable via the audit log, with a clear distinction between faculty marks, Admin-covered marks, and admin-unlocked edits.
- Streamlined institutional registration with duplicate detection, secure password hashing, and role-based portal access.
- Adding a new branch or section requires no schema or code changes — only new rows.
- Detained students appear as locked rows on marking sheets until Faculty (remove-only) or Admin (any transition) releases them.
- The system runs entirely on free infrastructure tiers at current scale (~500 students) — see Section 12 for the specific limits this depends on.

---

## 11. Build Order (Recommended)

1. Supabase project setup + run schema DDL from Section 8
2. Seed one Super-Admin account manually
3. Admin module: branches, sections (with `term_start_date`, `is_active`), subjects, timetable builder, roster CSV upload (with needs-review flagging)
4. Auth flows: direct self-signup (email + roll number/employee ID + password), instant login, forgot-password — all timestamps/cutoffs locked to Asia/Kolkata
5. Faculty module: session list (Today's Schedule + manual lookup, open marking on any session), attendance marking UI (single-tap lab marking, overwrite banner + confirm, Regular/Irregular pre-check, Detained/Transferred handling), edit-within-window
6. Admin direct marking + distinct audit flagging for Admin-covered sessions; `account_status` transitions and `joining_date` overrides
7. Student module: attendance dashboard (overall % + subject-wise %, N/A handling, joining_date-aware calculation, session history)
8. Admin reporting: PDF/Excel export, audit log viewer, client-driven throttled alert trigger (`alert_queue`-backed)
9. Deployment hardening per Section 12 (keep-alive ping, backup script) before going live with real users
10. Testing against the real CSE timetable data as the primary fixture, including: a lateral-entry student, an Admin-covered no-faculty session, a detained student appearing as a locked row and being released by faculty, and a signup burst scenario to confirm the OTP/alert daily-cap handling behaves as expected

---

## 12. Infrastructure & Free-Tier Considerations

This system is built entirely on free tiers (~500 students, zero budget). These are real constraints of the chosen stack as of mid-2026, not hypothetical edge cases — they should shape implementation decisions, not be discovered after launch.

### 12.1 Vercel Hobby — personal/non-commercial use restriction
Vercel's Hobby (free) plan terms restrict use to personal, non-commercial projects. A live system used by an actual college for real students is a gray area under this restriction, even though no money changes hands anywhere in the app. Enforcement is inconsistent in practice, but it is a real ToS term, not a soft guideline. Accepted approach for v1: proceed on Hobby (genuinely free, low likelihood of enforcement against a non-monetized college tool), but be aware that Vercel Pro ($20/month) or a small self-hosted VPS are the fallback options if this ever becomes a concern.

### 12.2 Resend — 100 emails/day hard cap (separate from the 3,000/month cap)
Two points in this system can exceed 100/day even though monthly volume stays well under 3,000:
- **Signup OTP bursts** — a large cohort signing up in the first week of term.
- **Low-attendance alert batches** — a single "before exams" trigger to 100+ defaulters.
This is already handled mechanically by the resumable `alert_queue` design (6.4) — sends simply continue into the next day. Signup OTP emails are not currently queued/throttled the same way; if Day 1 of registration produces more than 100 signups, later students that day would not receive their OTP until the cap resets. Consider either accepting this as a one-time first-week friction point, or applying the same queue-and-resume pattern to OTP delivery if a big-bang rollout is expected.

### 12.3 Supabase — free projects auto-pause after 7 days of inactivity
College usage goes quiet for weeks at a stretch (semester breaks, holidays). A paused project requires a manual "Resume" click in the Supabase dashboard before anyone can log in again. **Mitigation:** set up a free uptime monitor (e.g., UptimeRobot) pinging a lightweight API route every few days, so the project never goes quiet long enough to trigger the pause.

### 12.4 Supabase — no automated backups on the free tier
For data that affects real students' academic standing, this is worth closing even at zero cost. **Mitigation:** a scheduled GitHub Action running a periodic `pg_dump` (e.g., weekly) to a private repo or free storage bucket — cheap insurance against a bad migration or accidental delete, not a build-blocker for v1 but should be in place before real rollout.

### 12.5 Supabase — 500 MB database storage cap
Not an immediate concern at ~500 students (attendance rows are small; likely years before this is approached), but the metric to watch as multiple semesters of history accumulate. When it becomes relevant: Supabase Pro ($25/month) raises the cap, or older semesters can be archived to cold storage (e.g., periodic export + prune) to stay on the free tier longer.

### 12.6 Not a concern at this scale
Supabase's 50,000 monthly-active-user cap and Vercel's 100GB bandwidth / ~100K function invocations are far beyond what ~500 students generate — no mitigation needed for these.