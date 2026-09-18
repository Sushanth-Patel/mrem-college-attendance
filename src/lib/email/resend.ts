import { Resend } from 'resend'
import { throttleResendEmail } from '@/lib/free-tier-guard'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey && !resendApiKey.includes('placeholder') ? new Resend(resendApiKey) : null

// Default to onboarding@resend.dev for instant out-of-the-box deliverability on Resend free tier
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

type SendEmailInput = {
  to: string
  subject: string
  html: string
}

export async function sendEmail(input: SendEmailInput) {
  if (!resend) {
    console.log(`[EMAIL DEV LOG] (Resend API key not set or mock): To: ${input.to} | Subject: ${input.subject}`)
    return { id: 'mock-dev-id' }
  }

  // Free-tier circuit breaker: check daily limit and enforce 600ms gap
  const quotaCheck = await throttleResendEmail()
  if (!quotaCheck.allowLiveSend) {
    console.log(
      `[EMAIL FREE-TIER GUARD] Live dispatch suppressed: ${quotaCheck.reason}. Fallback simulated for ${input.to}.`
    )
    return { id: 'free-tier-quota-saved-id', suppressedByQuota: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })

    if (error) {
      console.warn(`Resend email warning: ${error.message}. Continuing with local fallback.`)
      return { id: 'fallback-warning-id' }
    }

    console.log(`[RESEND SUCCESS] Email dispatched to ${input.to}, ID: ${data?.id}`)
    return data
  } catch (err: unknown) {
    console.warn(`Resend email send error: ${err instanceof Error ? err.message : 'Unknown error'}. Continuing.`)
    return { id: 'fallback-error-id' }
  }
}

export function buildPasswordResetEmailHtml(args: { resetUrl: string; otp?: string }): string {
  return `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 36px 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">MREM College Attendance System</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">Password Reset Request</p>
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
        <p style="color: #334155; font-size: 14px; margin-bottom: 16px;">Hello,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
          We received a request to reset the password for your MREM College Attendance Portal account. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${args.resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
            Reset Password
          </a>
        </div>
        ${
          args.otp
            ? `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">Alternatively, use this 6-digit security code on the reset page:</p>
          <span style="font-family: monospace, Courier, monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #1e293b;">${args.otp}</span>
        </div>
        `
            : ''
        }
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 20px;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${args.resetUrl}" style="color: #2563eb; word-break: break-all; font-size: 11px;">${args.resetUrl}</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 16px;">
          This link and code are valid for <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.
        </p>
      </div>
      <div style="border-top: 1px solid #f1f5f9; margin-top: 32px; padding-top: 16px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          Malla Reddy Engineering College and Management Sciences • Automated Account Security
        </p>
      </div>
    </div>
  `
}

export function buildOtpEmailHtml(otp: string): string {
  return `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 36px 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">MREM College Attendance System</h2>
        <p style="color: #64748b; font-size: 13px; margin: 0;">Institutional Identity Verification</p>
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
        <p style="color: #334155; font-size: 14px; margin-bottom: 16px;">Hello,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
          Please use the following 6-digit verification code to confirm your registration for the MREM College Attendance Portal:
        </p>
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e293b;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          This code is valid for <strong>10 minutes</strong>. If you did not initiate this request, you can safely ignore this email.
        </p>
      </div>
      <div style="border-top: 1px solid #f1f5f9; margin-top: 32px; padding-top: 16px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          Malla Reddy Engineering College and Management Sciences • Official Attendance Portal
        </p>
      </div>
    </div>
  `
}

export function buildAlertEmailHtml(args: {
  studentName: string
  overallPct: number | null
  subjects: Array<{ name: string; pct: number | null }>
  threshold: number
}): string {
  const subjectRows = args.subjects
    .filter((s) => s.pct !== null && s.pct < args.threshold)
    .map(
      (s) =>
        `<tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b;">${s.name}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #dc2626; font-weight: 700; text-align: right;">${s.pct}%</td>
        </tr>`
    )
    .join('')

  return `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <div style="border-bottom: 2px solid #fee2e2; padding-bottom: 16px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #dc2626; background: #fef2f2; padding: 4px 8px; border-radius: 6px;">Academic Alert</span>
        <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 12px 0 4px 0;">Attendance Shortage Notice</h2>
        <p style="color: #64748b; font-size: 12px; margin: 0;">MREM • Attendance Monitoring Cell</p>
      </div>
      <p style="color: #334155; font-size: 14px;">Dear <strong>${args.studentName}</strong>,</p>
      <p style="color: #334155; font-size: 13px; line-height: 1.6;">
        This is an official advisory to inform you that your recorded attendance has fallen below the mandatory institutional requirement of <strong>${args.threshold}%</strong>.
        ${args.overallPct !== null ? ` Your current aggregate attendance stands at <strong style="color: #dc2626;">${args.overallPct}%</strong>.` : ''}
      </p>
      ${
        subjectRows
          ? `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 600;">Subject</th>
              <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 600;">Recorded %</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
        </table>
      `
          : ''
      }
      <p style="color: #475569; font-size: 13px; line-height: 1.5;">
        Please contact your respective faculty members and ensure regular attendance in all scheduled theory and laboratory sessions to avoid examination detention.
      </p>
      <div style="border-top: 1px solid #f1f5f9; margin-top: 28px; padding-top: 16px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          Malla Reddy Engineering College and Management Sciences • Automated Academic Notification
        </p>
      </div>
    </div>
  `
}
