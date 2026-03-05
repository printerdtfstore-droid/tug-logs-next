import { Resend } from 'resend';

function getRecipients(): string[] {
  return (process.env.ACTIVITY_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendActivityEmail(input: {
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Tug Logs <onboarding@resend.dev>';
  const to = getRecipients();

  if (!apiKey) {
    console.warn('RESEND_API_KEY missing; skipping email');
    return { skipped: true };
  }
  if (to.length === 0) {
    console.warn('ACTIVITY_EMAILS empty; skipping email');
    return { skipped: true };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    console.error('Failed to send activity email', error);
    throw new Error('Failed to send activity email');
  }

  return { ok: true };
}
