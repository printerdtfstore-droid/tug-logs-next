'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

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

  return { created: data as number };
}
