import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  // TODO: Create/load draft submission, render dynamic fields, autosave answers.
  const { data: task } = await supabase
    .from('tasks')
    .select(
      'id,status,due_type,recorded_date,due_at,is_backfilled,required_count,answered_count,template_id,vessel_id, form_templates(code,title), vessels(name)'
    )
    .eq('id', taskId)
    .maybeSingle();

  if (!task) {
    return (
      <div className="p-6">
        <p className="text-sm">Task not found.</p>
        <Link className="underline" href="/tasks">
          Back
        </Link>
      </div>
    );
  }

  const tpl = (task as unknown as { form_templates?: { code: string; title: string } }).form_templates;
  const vessel = (task as unknown as { vessels?: { name: string } }).vessels;
  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim();

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700">TUG LOGS</div>
            <h1 className="mt-2 text-xl font-black">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">Vessel: {vessel?.name ?? '—'}</p>
            <p className="mt-1 text-xs text-slate-500">
              Recorded: {task.recorded_date}{' '}
              {task.due_at ? `• Due: ${new Date(task.due_at).toLocaleString()}` : ''}
            </p>
          </div>
          <Link className="underline" href="/tasks">
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Next step: implement FillFormPage behavior here (draft submission + dynamic fields + autosave + submit).
          Tell me when you’re ready and I’ll wire the full dynamic form engine.
        </div>
      </div>
    </div>
  );
}
