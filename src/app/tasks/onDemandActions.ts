'use server';

import { supabaseServer } from '@/lib/supabase/server';

export async function startOnDemand(input: {
  vesselId: string;
  templateId: string;
  recordedDate: string; // YYYY-MM-DD
}) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Create/find task
  const { data: existing, error: findErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('vessel_id', input.vesselId)
    .eq('template_id', input.templateId)
    .eq('recorded_date', input.recordedDate)
    .eq('due_type', 'OnDemand')
    .maybeSingle();
  if (findErr) throw findErr;

  let taskId = existing?.id as string | undefined;

  if (!taskId) {
    const { data: created, error: createErr } = await supabase
      .from('tasks')
      .insert({
        vessel_id: input.vesselId,
        template_id: input.templateId,
        status: 'Open',
        due_type: 'OnDemand',
        recorded_date: input.recordedDate,
        due_at: null,
        is_backfilled: false,
        week_start_date: null,
        required_count: 0,
        answered_count: 0,
        due_slot: 'ONDEMAND',
      })
      .select('id')
      .single();
    if (createErr) throw createErr;
    taskId = created.id;
  }

  if (!taskId) throw new Error('Failed to create task');
  return { taskId };
}
