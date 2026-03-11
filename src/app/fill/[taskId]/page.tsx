import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import DynamicForm from './DynamicForm';
import RecordedDatePicker from './RecordedDatePicker';

export default async function FillPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { taskId } = await params;
  const sp = searchParams ?? {};
  const returnToRaw = typeof sp.returnTo === 'string' ? sp.returnTo : undefined;
  const returnTo = returnToRaw && returnToRaw.startsWith('/') ? returnToRaw : null;
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Filling logs requires an account. You can sign in and come back to this task.
          </p>
          <div className="mt-4">
            <Link className="underline" href="/login">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
    .select('id, filled_by_name')
    .eq('task_id', taskId)
    .eq('status', 'Draft')
    .maybeSingle();

  let submissionId: string | undefined = existingDraft?.id as string | undefined;
  let filledByName: string = (existingDraft as unknown as { filled_by_name?: string | null })
    ?.filled_by_name ??
    '';

  if (!submissionId) {
    const { data: created, error: createErr } = await supabase
      .from('form_submissions')
      .insert({
        task_id: taskId,
        template_id: task.template_id,
        vessel_id: task.vessel_id,
        status: 'Draft',
        created_by: auth.user.id,
        filled_by_name: null,
      })
      .select('id')
      .single();
    if (createErr) throw createErr;
    submissionId = created.id;
    filledByName = '';
  }

  if (!submissionId) throw new Error('Failed to create draft submission');
  const sid = submissionId;

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
    .eq('submission_id', sid);
  if (ansErr) throw ansErr;

  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim();

  const adminEnabled = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const client = adminEnabled
    ? (await import('@/lib/supabase/admin')).supabaseAdmin()
    : supabase;

  const { data: refDoc } = tpl?.code
    ? await client
        .from('documents')
        .select('file_path')
        .eq('template_code', tpl.code)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as { file_path: string } | null };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const referencePdfUrl =
    refDoc?.file_path && supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/DOCUMENTS/${encodeURIComponent(
          refDoc.file_path
        )}`
      : null;

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

        <div className="mb-4">
          <RecordedDatePicker
            taskId={task.id}
            recordedDate={task.recorded_date}
            submissionId={sid}
            filledByName={filledByName}
            disabled={false}
          />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <DynamicForm
            submissionId={sid}
            fields={fields ?? []}
            existing={answers ?? []}
            onSubmittedUrl={returnTo ?? '/tasks?segment=history'}
            referencePdfUrl={referencePdfUrl}
          />
        </div>
      </div>
    </div>
  );
}
