'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendActivityEmail } from '@/lib/email';

export async function ensureStartDateTask(input: {
  vessel_id: string;
  template_id: string;
  start_date: string;
}) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Not authenticated');

  const admin = supabaseAdmin();

  // Allow up to 2 tasks for the same day by using 2 internal slots.
  const SLOT_PRIMARY = '2359';
  const SLOT_SECONDARY = '2358';

  // Ensure primary exists
  await runBackfill({
    vessel_id: input.vessel_id,
    template_id: input.template_id,
    start_date: input.start_date,
    end_date: input.start_date,
    due_slot: SLOT_PRIMARY,
  });

  // Check which slots already exist for this day
  const { data: existing, error: exErr } = await admin
    .from('tasks')
    .select('id,due_slot')
    .eq('vessel_id', input.vessel_id)
    .eq('template_id', input.template_id)
    .eq('recorded_date', input.start_date)
    .in('due_slot', [SLOT_PRIMARY, SLOT_SECONDARY]);
  if (exErr) throw new Error(exErr.message);

  const bySlot = new Map<string, string>();
  for (const row of existing ?? []) bySlot.set(row.due_slot as string, row.id as string);

  // Choose the next available slot
  if (!bySlot.has(SLOT_PRIMARY)) {
    // Shouldn't happen because we just ensured it, but keep safe.
    throw new Error('Failed to create primary task slot');
  }

  // If secondary already exists, just return the primary slot (do not error).
  // This avoids blocking backfill flows when a day already has 2 entries.
  if (bySlot.has(SLOT_SECONDARY)) {
    return { ok: true, taskId: bySlot.get(SLOT_PRIMARY)! };
  }

  if (!bySlot.has(SLOT_SECONDARY)) {
    // First click should use primary; second click creates secondary.
    // If primary already used as a source today, create secondary.
    const { count: reqCount, error: rcErr } = await admin
      .from('form_fields')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', input.template_id)
      .eq('required', true);
    if (rcErr) throw new Error(rcErr.message);

    const { data: created, error: cErr } = await admin
      .from('tasks')
      .insert({
        vessel_id: input.vessel_id,
        template_id: input.template_id,
        status: 'Open',
        due_type: 'Scheduled',
        recorded_date: input.start_date,
        due_slot: SLOT_SECONDARY,
        due_at: `${input.start_date}T23:58:00-06:00`,
        is_backfilled: true,
        week_start_date: null,
        required_count: reqCount ?? 0,
        answered_count: 0,
      })
      .select('id')
      .single();
    if (cErr) throw new Error(cErr.message);
    bySlot.set(SLOT_SECONDARY, created.id as string);
  }

  // Return the *newest* available slot for filling: prefer secondary if it was just created.
  const chosen = bySlot.get(SLOT_SECONDARY) ?? bySlot.get(SLOT_PRIMARY);
  if (!chosen) throw new Error('Could not determine taskId');

  // Cap is 2: if both slots exist and user tries again, they would reuse secondary.
  // (UI will be updated later to show clearer "Entry #1/#2".)
  return { ok: true, taskId: chosen };
}

export async function generatePrefilledDrafts(input: {
  vessel_id: string;
  template_id: string;
  start_date: string;
  end_date: string;
  source_task_id: string;
  cadence?: BackfillCadence;
  auto_submit?: boolean;
}) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Not authenticated');

  const admin = supabaseAdmin();

  const { data: sourceTask, error: stErr } = await admin
    .from('tasks')
    .select('id,due_slot')
    .eq('id', input.source_task_id)
    .maybeSingle();
  if (stErr) throw new Error(stErr.message);
  if (!sourceTask?.id) throw new Error('Source task not found');
  const dueSlot = (sourceTask.due_slot as string) || '2359';

  // Find source submission (prefer Submitted, else Draft)
  const { data: sourceSub, error: sErr } = await admin
    .from('form_submissions')
    .select('id,filled_by_name')
    .eq('task_id', input.source_task_id)
    .in('status', ['Submitted', 'Draft'])
    .order('status', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!sourceSub?.id) throw new Error('Source submission not found for source task');

  const { data: sourceAnswers, error: aErr } = await admin
    .from('form_answers')
    .select(
      'field_id,value_text,value_option_text,value_time_text,value_time_text_a,value_time_text_b,is_filled'
    )
    .eq('submission_id', sourceSub.id);
  if (aErr) throw new Error(aErr.message);

  // Ensure tasks exist for the full range
  const backfillRes = await runBackfill({
    vessel_id: input.vessel_id,
    template_id: input.template_id,
    start_date: input.start_date,
    end_date: input.end_date,
    cadence: input.cadence ?? 'daily',
    due_slot: dueSlot,
  });

  const cadence: BackfillCadence = input.cadence ?? 'daily';
  const targetDates = computeCadenceDates(input.start_date, input.end_date, cadence);
  if (targetDates.length === 0) {
    return {
      ok: true,
      tasksEnsured: 0,
      draftsPrefilled: 0,
      tasksAutoSubmitted: 0,
      backfill: backfillRes,
    };
  }

  // Fetch the tasks we just ensured (only on the cadence dates)
  const { data: tasks, error: tErr } = await admin
    .from('tasks')
    .select('id,recorded_date,required_count')
    .eq('vessel_id', input.vessel_id)
    .eq('template_id', input.template_id)
    .in('recorded_date', targetDates)
    .eq('due_slot', dueSlot)
    .order('recorded_date', { ascending: true });
  if (tErr) throw new Error(tErr.message);

  let draftsPrefilled = 0;
  let tasksAutoSubmitted = 0;

  for (const task of tasks ?? []) {
    // Get or create draft submission for this task
    const { data: existingDraft, error: dErr } = await admin
      .from('form_submissions')
      .select('id')
      .eq('task_id', task.id)
      .eq('status', 'Draft')
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);

    let submissionId = existingDraft?.id as string | undefined;

    if (!submissionId) {
      const { data: created, error: cErr } = await admin
        .from('form_submissions')
        .insert({
          task_id: task.id,
          template_id: input.template_id,
          vessel_id: input.vessel_id,
          status: 'Draft',
          created_by: auth.user.id,
          filled_by_name: sourceSub.filled_by_name ?? null,
        })
        .select('id')
        .single();
      if (cErr) throw new Error(cErr.message);
      submissionId = created.id as string;
    }

    // Copy answers
    const rows = (sourceAnswers ?? []).map((ans) => ({
      submission_id: submissionId!,
      field_id: ans.field_id,
      value_text: ans.value_text,
      value_option_text: ans.value_option_text,
      value_time_text: ans.value_time_text,
      value_time_text_a: ans.value_time_text_a,
      value_time_text_b: ans.value_time_text_b,
      is_filled: ans.is_filled,
    }));

    if (rows.length > 0) {
      const { error: upErr } = await admin.from('form_answers').upsert(rows, {
        onConflict: 'submission_id,field_id',
      });
      if (upErr) throw new Error(upErr.message);
    }

    draftsPrefilled += 1;

    if (input.auto_submit) {
      // Mark submission + task as submitted so it appears in History.
      const now = new Date().toISOString();
      const { error: subErr } = await admin
        .from('form_submissions')
        .update({ status: 'Submitted', submitted_at: now })
        .eq('id', submissionId!);
      if (subErr) throw new Error(subErr.message);

      const { error: taskErr } = await admin
        .from('tasks')
        .update({ status: 'Submitted', answered_count: task.required_count ?? 0 })
        .eq('id', task.id);
      if (taskErr) throw new Error(taskErr.message);

      tasksAutoSubmitted += 1;
    }
  }

  return {
    ok: true,
    tasksEnsured: (tasks ?? []).length,
    draftsPrefilled,
    tasksAutoSubmitted,
    backfill: backfillRes,
  };
}

export type BackfillCadence = 'daily' | 'weekly' | 'monthly';

export async function runBackfill(input: {
  vessel_id: string;
  template_id: string;
  start_date: string;
  end_date: string;
  cadence?: BackfillCadence;
  due_slot?: string;
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

  const cadence: BackfillCadence = input.cadence ?? 'daily';
  const dates = computeCadenceDates(input.start_date, input.end_date, cadence);

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
  const dueSlot = input.due_slot ?? '2359';
  const dueTime = dueSlot === '2358' ? '23:58:00' : '23:59:00';

  for (const ymd of dates) {
    rows.push({
      vessel_id: input.vessel_id,
      template_id: input.template_id,
      status: 'Open',
      due_type: 'Scheduled',
      recorded_date: ymd,
      due_slot: dueSlot,
      // MVP fixed offset; good enough until we add DST logic
      due_at: `${ymd}T${dueTime}-06:00`,
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

function daysInUtcMonth(year: number, monthIndex0: number) {
  // monthIndex0: 0-11
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

function computeCadenceDates(startYmd: string, endYmd: string, cadence: BackfillCadence): string[] {
  const start = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start > end) return [];

  const out: string[] = [];

  if (cadence === 'daily') {
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  if (cadence === 'weekly') {
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  // monthly: same day-of-month as start, clamped to last day of month
  const startDom = start.getUTCDate();
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();

  while (true) {
    const dim = daysInUtcMonth(y, m);
    const dom = Math.min(startDom, dim);
    const d = new Date(Date.UTC(y, m, dom));
    if (d < start) {
      // if clamping pushed us before the start (rare), bump one month
    } else if (d > end) {
      break;
    } else {
      out.push(d.toISOString().slice(0, 10));
    }

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }

    // Safety
    if (out.length > 4000) break;
  }

  return out;
}

