import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import DynamicForm from './DynamicForm';

export default async function FillPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select(
      'id,status,recorded_date,due_at,is_backfilled,required_count,answered_count,template_id,vessel_id, form_templates(code,title), vessels(name)'
    )
    .eq('id', taskId)
    .single();
  if (taskErr) throw taskErr;

  const tpl = (task as unknown as { form_templates?: { code: string; title: string } })
    .form_templates;
  const vessel = (task as unknown as { vessels?: { name: string } }).vessels;

  // Get or create draft submission.
  const { data: existingDraft } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('status', 'Draft')
    .maybeSingle();

  let submissionId: string | undefined = existingDraft?.id as string | undefined;

  if (!submissionId) {
    const { data: created, error: createErr } = await supabase
      .from('form_submissions')
      .insert({
        task_id: taskId,
        template_id: task.template_id,
        vessel_id: task.vessel_id,
        status: 'Draft',
        created_by: auth.user.id,
      })
      .select('id')
      .single();
    if (createErr) throw createErr;
    submissionId = created.id;
  }

  if (!submissionId) throw new Error('Failed to create draft submission');

  const { data: fields, error: fieldsErr } = await supabase
    .from('form_fields')
    .select(
      'id,qnum,label,field_type,required,choices,sub_label_a,sub_label_b,order'
    )
    .eq('template_id', task.template_id)
    .order('order', { ascending: true });
  if (fieldsErr) throw fieldsErr;

  const { data: answers, error: ansErr } = await supabase
    .from('form_answers')
    .select(
      'field_id,value_text,value_option_text,value_time_text,value_time_text_a,value_time_text_b'
    )
    .eq('submission_id', submissionId);
  if (ansErr) throw ansErr;

  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim();

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700">
              TUG LOGS
            </div>
            <h1 className="mt-2 text-xl font-black">{title}</h1>
            <div className="mt-1 text-sm text-slate-600">Vessel: {vessel?.name ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              Recorded: {task.recorded_date}
              {task.due_at ? ` • Due: ${new Date(task.due_at).toLocaleString()}` : ''}
            </div>
          </div>
          <Link className="underline" href="/tasks">
            Back
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <DynamicForm
            submissionId={submissionId}
            fields={fields ?? []}
            existing={answers ?? []}
            onSubmittedUrl="/tasks?segment=history"
          />
        </div>
      </div>
    </div>
  );
}
