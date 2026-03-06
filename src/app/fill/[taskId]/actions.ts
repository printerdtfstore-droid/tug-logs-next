'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { sendActivityEmail } from '@/lib/email';

export async function saveAnswer(input: {
  submissionId: string;
  fieldId: string;
  value_text?: string | null;
  value_option_text?: string | null;
  value_time_text?: string | null;
  value_time_text_a?: string | null;
  value_time_text_b?: string | null;
}) {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Not authenticated');

  const filled =
    (input.value_option_text && input.value_option_text.trim() !== '') ||
    (input.value_text && input.value_text.trim() !== '') ||
    (input.value_time_text && input.value_time_text.trim() !== '') ||
    ((input.value_time_text_a && input.value_time_text_a.trim() !== '') &&
      (input.value_time_text_b && input.value_time_text_b.trim() !== ''));

  const { error: upsertErr } = await supabase.from('form_answers').upsert(
    {
      submission_id: input.submissionId,
      field_id: input.fieldId,
      value_text: input.value_text ?? null,
      value_option_text: input.value_option_text ?? null,
      value_time_text: input.value_time_text ?? null,
      value_time_text_a: input.value_time_text_a ?? null,
      value_time_text_b: input.value_time_text_b ?? null,
      is_filled: filled,
    },
    { onConflict: 'submission_id,field_id' }
  );
  if (upsertErr) throw upsertErr;

  // Recompute answered_count for required fields.
  const { data: submission, error: subErr } = await supabase
    .from('form_submissions')
    .select('task_id, template_id')
    .eq('id', input.submissionId)
    .single();
  if (subErr) throw subErr;

  const { data: requiredFields, error: reqErr } = await supabase
    .from('form_fields')
    .select('id')
    .eq('template_id', submission.template_id)
    .eq('required', true);
  if (reqErr) throw reqErr;

  const requiredIds = (requiredFields ?? []).map((f) => f.id);

  let answeredRequired = 0;
  if (requiredIds.length > 0) {
    const { count, error: cntErr } = await supabase
      .from('form_answers')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', input.submissionId)
      .eq('is_filled', true)
      .in('field_id', requiredIds);
    if (cntErr) throw cntErr;
    answeredRequired = count ?? 0;
  }

  const { error: updTaskErr } = await supabase
    .from('tasks')
    .update({ answered_count: answeredRequired })
    .eq('id', submission.task_id);
  if (updTaskErr) throw updTaskErr;

  return { ok: true, answeredRequired };
}

export async function updateRecordedDate(input: {
  taskId: string;
  recordedDate: string;
}) {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Not authenticated');

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('id,status,vessel_id,template_id,due_slot')
    .eq('id', input.taskId)
    .single();
  if (tErr) throw tErr;
  if (task.status === 'Submitted') throw new Error('Already submitted');

  // If a task already exists for that date/slot, redirect to it instead of failing.
  let exQ = supabase
    .from('tasks')
    .select('id')
    .eq('vessel_id', task.vessel_id)
    .eq('template_id', task.template_id)
    .eq('recorded_date', input.recordedDate)
    .neq('id', task.id);

  exQ = task.due_slot ? exQ.eq('due_slot', task.due_slot) : exQ.is('due_slot', null);

  const { data: existing, error: exErr } = await exQ.maybeSingle();
  if (exErr) throw exErr;

  if (existing?.id) {
    return { ok: true, redirectTaskId: existing.id };
  }

  const { error: upErr } = await supabase
    .from('tasks')
    .update({ recorded_date: input.recordedDate })
    .eq('id', input.taskId);
  if (upErr) throw upErr;

  return { ok: true };
}

export async function submitForm(input: { submissionId: string }) {
  const supabase = await supabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!auth.user) throw new Error('Not authenticated');

  const { data: submission, error: subErr } = await supabase
    .from('form_submissions')
    .select('id, task_id, template_id')
    .eq('id', input.submissionId)
    .single();
  if (subErr) throw subErr;

  const now = new Date().toISOString();

  const { error: updSubErr } = await supabase
    .from('form_submissions')
    .update({ status: 'Submitted', submitted_at: now })
    .eq('id', submission.id);
  if (updSubErr) throw updSubErr;

  // Required count
  const { count: requiredCount, error: reqErr } = await supabase
    .from('form_fields')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', submission.template_id)
    .eq('required', true);
  if (reqErr) throw reqErr;

  const { data: updatedTask, error: updTaskErr } = await supabase
    .from('tasks')
    .update({
      status: 'Submitted',
      submitted_at: now,
      submitted_by: auth.user.id,
      answered_count: requiredCount ?? 0,
      required_count: requiredCount ?? 0,
    })
    .eq('id', submission.task_id)
    .select('id,recorded_date, due_at, vessel_id, template_id, vessels(name), form_templates(code,title)')
    .single();
  if (updTaskErr) throw updTaskErr;

  const vesselName =
    (updatedTask as unknown as { vessels?: { name?: string } }).vessels?.name ??
    '';
  const tpl = (updatedTask as unknown as {
    form_templates?: { code?: string; title?: string };
  }).form_templates;
  const tplTitle = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim();

  // Fire-and-forget is tempting, but we want failures visible in logs; don't block UI too long.
  await sendActivityEmail({
    subject: `Tug Logs submitted: ${tplTitle || 'Log'}`,
    html: `
      <h2>Tug Logs — Log Submitted</h2>
      <p><b>Vessel:</b> ${vesselName || updatedTask.vessel_id}</p>
      <p><b>Template:</b> ${tplTitle || updatedTask.template_id}</p>
      <p><b>Recorded date:</b> ${updatedTask.recorded_date}</p>
      <p><b>Submitted by:</b> ${auth.user.email ?? auth.user.id}</p>
      <p><b>Submitted at:</b> ${now}</p>
    `,
  });

  return { ok: true };
}
