import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
  if (!auth.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json()) as {
    vessel_id: string;
    start_date: string;
    end_date: string;
  };

  if (!body?.vessel_id || !body?.start_date || !body?.end_date) {
    return NextResponse.json({ ok: false, error: 'Missing vessel_id/start_date/end_date' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Find submitted tasks in range (i.e., what appears in History)
  const { data: tasks, error: tErr } = await admin
    .from('tasks')
    .select('id')
    .eq('vessel_id', body.vessel_id)
    .eq('status', 'Submitted')
    .gte('recorded_date', body.start_date)
    .lte('recorded_date', body.end_date)
    .limit(5000);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const taskIds = (tasks ?? []).map((t) => t.id as string);
  if (taskIds.length === 0) {
    return NextResponse.json({ ok: true, deletedTasks: 0, deletedSubmissions: 0, deletedAnswers: 0 });
  }

  // Find submissions for these tasks
  const { data: subs, error: sErr } = await admin
    .from('form_submissions')
    .select('id')
    .in('task_id', taskIds)
    .limit(20000);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const subIds = (subs ?? []).map((s) => s.id as string);

  // Delete answers in chunks
  let deletedAnswers = 0;
  for (let i = 0; i < subIds.length; i += 500) {
    const chunk = subIds.slice(i, i + 500);
    const { error: aDelErr, count } = await admin
      .from('form_answers')
      .delete({ count: 'exact' })
      .in('submission_id', chunk);
    if (aDelErr) return NextResponse.json({ ok: false, error: aDelErr.message }, { status: 500 });
    deletedAnswers += count ?? 0;
  }

  // Delete submissions
  let deletedSubmissions = 0;
  for (let i = 0; i < subIds.length; i += 500) {
    const chunk = subIds.slice(i, i + 500);
    const { error: sDelErr, count } = await admin
      .from('form_submissions')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (sDelErr) return NextResponse.json({ ok: false, error: sDelErr.message }, { status: 500 });
    deletedSubmissions += count ?? 0;
  }

  // Delete tasks
  let deletedTasks = 0;
  for (let i = 0; i < taskIds.length; i += 500) {
    const chunk = taskIds.slice(i, i + 500);
    const { error: tDelErr, count } = await admin
      .from('tasks')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (tDelErr) return NextResponse.json({ ok: false, error: tDelErr.message }, { status: 500 });
    deletedTasks += count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    deletedTasks,
    deletedSubmissions,
    deletedAnswers,
  });
}
