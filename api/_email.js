/**
 * Email helper.
 *
 * Uses Resend when RESEND_API_KEY is configured. Without a key, the OTP /
 * temp-password is returned in the API response so the flow is fully testable
 * in development — the frontend shows it in a highlighted notice box.
 */

const FROM = process.env.MAIL_FROM || 'Nought <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { sent: false, dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('email send failed:', res.status, body);
    throw new Error('Could not send email.');
  }
  return { sent: true };
}

export function otpEmail(code) {
  return {
    subject: `Your Nought verification code: ${code}`,
    text: `Welcome to Nought! Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#f5f3ef;border-radius:12px">
        <h1 style="font-size:22px;color:#1c1b17;margin:0 0 8px">Nought</h1>
        <p style="font-size:14px;color:#45423b;margin:0 0 24px">Verify your email address</p>
        <div style="text-align:center;background:#fbfaf8;border:1px solid #e2ded5;border-radius:8px;padding:24px;margin:0 0 24px">
          <p style="font-family:monospace;font-size:32px;letter-spacing:8px;color:#a1573a;margin:0">${code}</p>
        </div>
        <p style="font-size:13px;color:#837e74;margin:0">Enter this code to finish creating your account. It expires in 10 minutes.</p>
      </div>`,
  };
}

export function tempPasswordEmail(password) {
  return {
    subject: 'Your temporary Nought password',
    text: `Your temporary password is: ${password}. Sign in and go to Settings to change it.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#f5f3ef;border-radius:12px">
        <h1 style="font-size:22px;color:#1c1b17;margin:0 0 8px">Nought</h1>
        <p style="font-size:14px;color:#45423b;margin:0 0 24px">Password reset</p>
        <div style="text-align:center;background:#fbfaf8;border:1px solid #e2ded5;border-radius:8px;padding:24px;margin:0 0 24px">
          <p style="font-family:monospace;font-size:20px;color:#a1573a;margin:0">${password}</p>
        </div>
        <p style="font-size:13px;color:#837e74;margin:0">Sign in with your username and this password, then go to Settings to set a new one.</p>
      </div>`,
  };
}
