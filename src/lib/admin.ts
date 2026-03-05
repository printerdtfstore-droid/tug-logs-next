export function isAdminEmail(email: string | null | undefined) {
  const allow = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email) return false;
  if (allow.length === 0) return false;
  return allow.includes(email.toLowerCase());
}
