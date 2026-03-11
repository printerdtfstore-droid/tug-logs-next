'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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


  // Use service-role backfill (no RPC dependency)
  const admin = supabaseAdmin();

  const { count: reqCount, error: rcErr } = await admin
    .from('form_fields')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', input.template_id)
    .eq('required', true);
  if (rcErr) throw new Error(rcErr.message);

  const start = new Date(`${input.start_date}T00:00:00Z`);
  const end = new Date(`${input.end_date}T00:00:00Z`);

  type TaskRow = {
    vessel_id: string;
    template_id: string;
    status: string;
    due_type: string;
    recorded_date: string;
    due_slot: string;
    due_at: string;
    is_backfilled: boolean;
    week_start_date: string | null;
    required_count: number;
    answered_count: number;
  };

  const rows: TaskRow[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const ymd = d.toISOString().slice(0, 10);
    rows.push({
      vessel_id: input.vessel_id,
      template_id: input.template_id,
      status: 'Open',
      due_type: 'Scheduled',
      recorded_date: ymd,
      due_slot: '2359',
      // MVP fixed offset; good enough until we add DST logic
      due_at: `${ymd}T23:59:00-06:00`,
      is_backfilled: true,
      week_start_date: null,
      required_count: reqCount ?? 0,
      answered_count: 0,
    });
  }

  const { error: upErr } = await admin.from('tasks').upsert(rows, {
    onConflict: 'vessel_id,template_id,recorded_date,due_slot',
    ignoreDuplicates: true,
  });
  if (upErr) throw new Error(upErr.message);

  const created = rows.length;

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
