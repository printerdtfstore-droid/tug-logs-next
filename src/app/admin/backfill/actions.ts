'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { sendActivityEmail } from '@/lib/email';

export async function runBackfill(input: {
  vessel_id: string;
  template_id: string;
  start_date: string;
  end_date: string;
}) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  if (!isAdminEmail(auth.user.email)) {
    throw new Error('Not authorized (admin only)');
  }

  const { data, error } = await supabase.rpc('backfill_tasks', {
    p_vessel_id: input.vessel_id,
    p_template_id: input.template_id,
    p_start_date: input.start_date,
    p_end_date: input.end_date,
    p_due_hour: 23,
    p_due_min: 59,
  });
  if (error) throw error;

  const created = data as number;

  await sendActivityEmail({
    subject: `Tug Logs backfill: created ${created} tasks`,
    html: `
      <h2>Tug Logs — Backfill</h2>
      <p><b>Vessel ID:</b> ${input.vessel_id}</p>
      <p><b>Template ID:</b> ${input.template_id}</p>
      <p><b>Date range:</b> ${input.start_date} → ${input.end_date}</p>
      <p><b>Created:</b> ${created}</p>
      <p><b>Run by:</b> ${auth.user.email ?? auth.user.id}</p>
    `,
  });

  return { created };
}
