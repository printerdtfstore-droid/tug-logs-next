import { supabaseAdmin } from '@/lib/supabase/admin';

export async function generateFrm006702Tasks(input: {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}) {
  const supabase = supabaseAdmin();

  const { data: tpl, error: tplErr } = await supabase
    .from('form_templates')
    .select('id')
    .eq('code', 'FRM006702')
    .single();
  if (tplErr) throw tplErr;

  const { data: vessels, error: vErr } = await supabase
    .from('vessels')
    .select('id,name')
    .in('name', ['Capt Russell L', 'Amazing Grace'])
    .eq('active', true);
  if (vErr) throw vErr;

  const { count: reqCount, error: rcErr } = await supabase
    .from('form_fields')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', tpl.id)
    .eq('required', true);
  if (rcErr) throw rcErr;

  const dueSlots: Array<{ slot: string; hour: number }> = [
    { slot: '0600', hour: 6 },
    { slot: '1200', hour: 12 },
  ];

  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);

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
    for (const v of vessels ?? []) {
      for (const s of dueSlots) {
        rows.push({
          vessel_id: v.id,
          template_id: tpl.id,
          status: 'Open',
          due_type: 'Scheduled',
          recorded_date: ymd,
          due_slot: s.slot,
          // MVP fixed offset; good enough until we add DST logic
          due_at: `${ymd}T${String(s.hour).padStart(2, '0')}:00:00-06:00`,
          is_backfilled: true,
          week_start_date: null,
          required_count: reqCount ?? 0,
          answered_count: 0,
        });
      }
    }
  }

  // Chunk to avoid payload limits
  let inserted = 0;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: upErr } = await supabase.from('tasks').upsert(chunk, {
      onConflict: 'vessel_id,template_id,recorded_date,due_slot',
      ignoreDuplicates: true,
    });
    if (upErr) throw upErr;
    inserted += chunk.length;
  }

  return { ok: true, attempted: rows.length, insertedApprox: inserted };
}

export async function generateFrm006703Tasks(input: {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}) {
  const supabase = supabaseAdmin();

  const { data: tpl, error: tplErr } = await supabase
    .from('form_templates')
    .select('id')
    .eq('code', 'FRM006703')
    .single();
  if (tplErr) throw tplErr;

  const { data: vessels, error: vErr } = await supabase
    .from('vessels')
    .select('id,name')
    .in('name', ['Capt Russell L', 'Amazing Grace'])
    .eq('active', true);
  if (vErr) throw vErr;

  const { count: reqCount, error: rcErr } = await supabase
    .from('form_fields')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', tpl.id)
    .eq('required', true);
  if (rcErr) throw rcErr;

  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);

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
    for (const v of vessels ?? []) {
      rows.push({
        vessel_id: v.id,
        template_id: tpl.id,
        status: 'Open',
        due_type: 'Scheduled',
        recorded_date: ymd,
        due_slot: '0600',
        // MVP fixed offset; good enough until we add DST logic
        due_at: `${ymd}T06:00:00-06:00`,
        is_backfilled: true,
        week_start_date: null,
        required_count: reqCount ?? 0,
        answered_count: 0,
      });
    }
  }

  const { error: upErr } = await supabase.from('tasks').upsert(rows, {
    onConflict: 'vessel_id,template_id,recorded_date,due_slot',
    ignoreDuplicates: true,
  });
  if (upErr) throw upErr;

  return { ok: true, attempted: rows.length };
}

export async function clearSubmittedHistory() {
  const supabase = supabaseAdmin();

  // Find submitted submissions
  const { data: subs, error: sErr } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('status', 'Submitted');
  if (sErr) throw sErr;

  const subIds = (subs ?? []).map((s) => s.id);

  if (subIds.length > 0) {
    const { error: aErr } = await supabase
      .from('form_answers')
      .delete()
      .in('submission_id', subIds);
    if (aErr) throw aErr;

    const { error: delSubsErr } = await supabase
      .from('form_submissions')
      .delete()
      .in('id', subIds);
    if (delSubsErr) throw delSubsErr;
  }

  const { error: tErr } = await supabase
    .from('tasks')
    .delete()
    .eq('status', 'Submitted');
  if (tErr) throw tErr;

  return { ok: true, deletedSubmissions: subIds.length };
}
