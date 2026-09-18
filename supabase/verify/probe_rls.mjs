import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  (await readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function login(email, password) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  // apikey stays the publishable key; the user JWT goes in Authorization.
  const authed = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { authed, uid: data.user.id };
}

const results = [];
const expect = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail ?? '' });

// ---------- ANON ----------
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
{
  const students = await anon.from('students').select('id').limit(5);
  const otp = await anon.from('otp_codes').select('code').limit(5);
  const profiles = await anon.from('profiles').select('id').limit(5);
  const sessions = await anon.from('sessions').select('id').limit(5);
  const view = await anon.from('student_subject_attendance').select('student_id').limit(5);
  expect('anon.students empty', (students.data ?? []).length === 0, students.error?.message ?? 'ok');
  expect('anon.otp_codes empty', (otp.data ?? []).length === 0, otp.error?.message ?? 'ok');
  expect('anon.profiles empty', (profiles.data ?? []).length === 0, profiles.error?.message ?? 'ok');
  expect('anon.sessions empty', (sessions.data ?? []).length === 0, sessions.error?.message ?? 'ok');
  expect('anon.view empty', (view.data ?? []).length === 0, view.error?.message ?? 'ok');
  const ins = await anon.from('attendance_records').insert({}).select().single();
  expect('anon INSERT attendance denied', !!ins.error, ins.error?.message ?? 'WRITE SUCCEEDED!');
}

// ---------- STUDENT ----------
const stuEmail = env.TEST_STUDENT_EMAIL || process.env.TEST_STUDENT_EMAIL;
const stuPassword = env.TEST_STUDENT_PASSWORD || process.env.TEST_STUDENT_PASSWORD;
if (stuEmail && stuPassword) {
  const stu = await login(stuEmail, stuPassword);
  const mine = await stu.authed.from('students').select('id, roll_no').eq('id', stu.uid);
  const others = await stu.authed.from('students').select('id').neq('id', stu.uid).limit(1000);
  const allRecs = await stu.authed.from('attendance_records').select('student_id, id').limit(2000);
  const myRecs = await stu.authed.from('attendance_records').select('id').eq('student_id', stu.uid);
  const view = await stu.authed.from('student_subject_attendance').select('student_id, periods_held, periods_attended, attendance_pct').eq('student_id', stu.uid);
  expect('student reads own students row', (mine.data ?? []).length === 1, mine.error?.message ?? '');
  expect('student cannot read other students', (others.data ?? []).length === 0, `got ${others.data?.length}`);
  const foreign = (allRecs.data ?? []).filter((r) => r.student_id !== stu.uid);
  expect('student attendance rows all own', foreign.length === 0, `foreign=${foreign.length}`);
  expect('student sees own records', (myRecs.data ?? []).length > 0, `n=${myRecs.data?.length} ${myRecs.error?.message ?? ''}`);
  // View is per-(student, subject): aggregate the subject rows and assert the totals.
  const held = (view.data ?? []).reduce((a, r) => a + r.periods_held, 0);
  const attended = (view.data ?? []).reduce((a, r) => a + r.periods_attended, 0);
  expect('student view aggregates 3 held / 1 attended (33.33%)', held === 3 && attended === 1, JSON.stringify(view.data ?? view.error?.message));
  // RLS UPDATE with no SELECT-policy match = silent 0-row no-op. Assert affected rows == 0
  // AND the underlying data is untouched.
  const write = await stu.authed.from('attendance_records').update({ status: 'present' }).eq('student_id', stu.uid).select('id, status');
  const after = await stu.authed.from('attendance_records').select('status').eq('student_id', stu.uid).order('id');
  const statuses = (after.data ?? []).map((r) => r.status).sort().join(',');
  expect('student UPDATE attendance: 0 rows affected, data unchanged', (write.data ?? []).length === 0 && statuses === 'absent,absent,present', `affected=${write.data?.length} statuses=${statuses} err=${write.error?.message ?? 'none'}`);
  const subj = await stu.authed.from('subjects').select('id').limit(100);
  expect('student reads catalog (subjects)', (subj.data ?? []).length > 0, subj.error?.message ?? '');
  const otp2 = await stu.authed.from('otp_codes').select('code').limit(5);
  expect('student otp_codes empty', (otp2.data ?? []).length === 0, otp2.error?.message ?? 'ok');
} else {
  console.log('SKIP: Student probe skipped (TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD not set in environment)');
}

// ---------- FACULTY ----------
const facEmail = env.TEST_FACULTY_EMAIL || process.env.TEST_FACULTY_EMAIL;
const facPassword = env.TEST_FACULTY_PASSWORD || process.env.TEST_FACULTY_PASSWORD;
if (facEmail && facPassword) {
  const fac = await login(facEmail, facPassword);
  const students = await fac.authed.from('students').select('id').limit(1000);
  expect('faculty reads full roster', (students.data ?? []).length >= 60, `n=${students.data?.length} ${students.error?.message ?? ''}`);
  const adminTable = await fac.authed.from('signup_requests').select('id').limit(10);
  expect('faculty signup_requests empty (admin-only)', (adminTable.data ?? []).length === 0, adminTable.error?.message ?? 'ok');
  const audit = await fac.authed.from('audit_log').select('id').limit(10);
  expect('faculty audit_log empty (admin-only)', (audit.data ?? []).length === 0, audit.error?.message ?? 'ok');
} else {
  console.log('SKIP: Faculty probe skipped (TEST_FACULTY_EMAIL, TEST_FACULTY_PASSWORD not set in environment)');
}

// ---------- ADMIN ----------
const admEmail = env.TEST_ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL || env.SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
const admPassword = env.TEST_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD || env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
if (admEmail && admPassword) {
  const adm = await login(admEmail, admPassword);
  const students = await adm.authed.from('students').select('id').limit(1000);
  const audit = await adm.authed.from('audit_log').select('id').limit(100);
  const otp3 = await adm.authed.from('otp_codes').select('code').limit(5);
  const roster = await adm.authed.from('roster_students').select('roll_no').limit(100);
  expect('admin reads students', (students.data ?? []).length >= 60, `n=${students.data?.length} ${students.error?.message ?? ''}`);
  expect('admin reads audit_log', (audit.data ?? []).length > 0, `n=${audit.data?.length} ${audit.error?.message ?? ''}`);
  expect('admin otp_codes still empty (service-role only)', (otp3.data ?? []).length === 0, otp3.error?.message ?? 'ok');
  expect('admin reads roster_students', (roster.data ?? []).length > 0, roster.error?.message ?? '');
} else {
  console.log('SKIP: Admin probe skipped (TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD not set in environment)');
}

let fail = 0;
for (const r of results) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
}
console.log(`\n${results.length - fail}/${results.length} passed`);
process.reallyExit(fail ? 1 : 0);
