'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import {
  generateFrm006702Tasks,
  generateFrm006703Tasks,
  generateFrm006706ForYear,
  generateFrm006707ForYear,
  clearSubmittedHistory,
} from '@/lib/generateFrm006702';

function centralYMD(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  if (!isAdminEmail(auth.user.email)) throw new Error('Not authorized');
  return auth.user;
}

export async function adminGenerateToday() {
  await requireAdmin();
  const today = centralYMD();
  await generateFrm006702Tasks({ startDate: today, endDate: today });
}

export async function adminGenerateTodayFrm006703() {
  await requireAdmin();
  const today = centralYMD();
  await generateFrm006703Tasks({ startDate: today, endDate: today });
}

export async function adminGenerateFrm006706ThisYear() {
  await requireAdmin();
  const year = Number(
    new Date().toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
    })
  );
  await generateFrm006706ForYear(year);
}

export async function adminBackfillFrm006702(formData: FormData) {
  await requireAdmin();
  const startDate = String(formData.get('startDate') || '').trim();
  const endDate = String(formData.get('endDate') || '').trim();
  if (!startDate || !endDate) throw new Error('Missing date range');
  await generateFrm006702Tasks({ startDate, endDate });
}

export async function adminGenerateFrm006707ThisYear() {
  await requireAdmin();
  const year = Number(
    new Date().toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
    })
  );
  await generateFrm006707ForYear(year);
}

export async function adminClearHistory() {
  await requireAdmin();
  await clearSubmittedHistory();
}
