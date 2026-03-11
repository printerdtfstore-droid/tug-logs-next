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
    due_type?: 'Scheduled' | 'OnDemand' | 'Any';
  };

  if (!body?.vessel_id) {
    return NextResponse.json({ ok: false, error: 'Missing vessel_id' }, { status: 400 });
  }

  const dueType = body.due_type && body.due_type !== 'Any' ? body.due_type : null;

  const admin = supabaseAdmin();

  let q = admin
    .from('tasks')
    .select('id')
    .eq('vessel_id', body.vessel_id)
    .eq('status', 'Open');
  if (dueType) q = q.eq('due_type', dueType);

  const { data: tasks, error: tErr } = await q.limit(20000);
  if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

  const taskIds = (tasks ?? []).map((t) => t.id as string);
  if (taskIds.length === 0) {
    return NextResponse.json({ ok: true, deletedTasks: 0, deletedSubmissions: 0, deletedAnswers: 0 });
  }

  const { data: subs, error: sErr } = await admin
    .from('form_submissions')
    .select('id')
    .in('task_id', taskIds)
    .limit(50000);
  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const subIds = (subs ?? []).map((s) => s.id as string);

  let deletedAnswers = 0;
  for (let i = 0; i < subIds.length; i += 500) {
    const chunk = subIds.slice(i, i + 500);
    const { error: aErr, count } = await admin
      .from('form_answers')
      .delete({ count: 'exact' })
      .in('submission_id', chunk);
    if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
    deletedAnswers += count ?? 0;
  }

  let deletedSubmissions = 0;
  for (let i = 0; i < subIds.length; i += 500) {
    const chunk = subIds.slice(i, i + 500);
    const { error: dErr, count } = await admin
      .from('form_submissions')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
    deletedSubmissions += count ?? 0;
  }

  let deletedTasks = 0;
  for (let i = 0; i < taskIds.length; i += 500) {
    const chunk = taskIds.slice(i, i + 500);
    const { error: dtErr, count } = await admin.from('tasks').delete({ count: 'exact' }).in('id', chunk);
    if (dtErr) return NextResponse.json({ ok: false, error: dtErr.message }, { status: 500 });
    deletedTasks += count ?? 0;
  }

  return NextResponse.json({ ok: true, deletedTasks, deletedSubmissions, deletedAnswers });
}
