'use server';

import { supabaseServer } from '@/lib/supabase/server';

export async function saveAnswer(input: {
  submissionId: string;
  fieldId: string;
  value_text?: string | null;
  value_option_text?: string | null;
  value_time_text?: string | null;
  value_time_text_a?: string | null;
  value_time_text_b?: string | null;
}) {
  const supabase = supabaseServer();

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

export async function submitForm(input: { submissionId: string }) {
  const supabase = supabaseServer();

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

  const { error: updTaskErr } = await supabase
    .from('tasks')
    .update({
      status: 'Submitted',
      submitted_at: now,
      submitted_by: auth.user.id,
      answered_count: requiredCount ?? 0,
      required_count: requiredCount ?? 0,
    })
    .eq('id', submission.task_id);
  if (updTaskErr) throw updTaskErr;

  return { ok: true };
}
