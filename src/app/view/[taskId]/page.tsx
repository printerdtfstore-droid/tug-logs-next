import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

export default async function ViewTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await supabaseServer();

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select(
      'id,status,recorded_date,due_at,submitted_at,submitted_by,template_id,vessel_id, form_templates(code,title,category), vessels(name)'
    )
    .eq('id', taskId)
    .single();
  if (taskErr) throw taskErr;

  // Find the latest submission (prefer Submitted)
  const { data: submission, error: subErr } = await supabase
    .from('form_submissions')
    .select('id,status,created_at,submitted_at,created_by')
    .eq('task_id', taskId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subErr) throw subErr;

  const submissionId = submission?.id;

  const { data: fields, error: fieldsErr } = await supabase
    .from('form_fields')
    .select('id,qnum,label,field_key,field_type,order')
    .eq('template_id', task.template_id)
    .order('order', { ascending: true });
  if (fieldsErr) throw fieldsErr;

  type Answer = {
    field_id: string;
    value_text: string | null;
    value_option_text: string | null;
    value_time_text: string | null;
    value_time_text_a: string | null;
    value_time_text_b: string | null;
  };

  let answers: Answer[] = [];
  if (submissionId) {
    const { data: ans, error: ansErr } = await supabase
      .from('form_answers')
      .select(
        'field_id,value_text,value_option_text,value_time_text,value_time_text_a,value_time_text_b'
      )
      .eq('submission_id', submissionId);
    if (ansErr) throw ansErr;
    answers = ans ?? [];
  }

  const byFieldId = new Map<string, Answer>();
  for (const a of answers) byFieldId.set(a.field_id, a);

  const tpl = (task as unknown as { form_templates?: { code?: string; title?: string } })
    .form_templates;
  const vessel = (task as unknown as { vessels?: { name?: string } }).vessels;

  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim();

  function formatValue(fieldType: string, a: Answer | undefined) {
    if (!a) return '';
    if (fieldType === 'button_choice') return a.value_option_text ?? '';
    if (fieldType === 'time') return a.value_time_text ?? '';
    if (fieldType === 'time_range') {
      const a1 = a.value_time_text_a ?? '';
      const b1 = a.value_time_text_b ?? '';
      return a1 && b1 ? `${a1}-${b1}` : a1 || b1;
    }
    return a.value_text ?? '';
  }

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700">
              TUG LOGS
            </div>
            <h1 className="mt-2 text-xl font-black">{title || 'Form'}</h1>
            <div className="mt-1 text-sm text-slate-600">Vessel: {vessel?.name ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              Recorded: {task.recorded_date}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link className="underline" href={`/view/${encodeURIComponent(taskId)}/pdf`}>
              Download PDF
            </Link>
            <Link className="underline" href="/tasks?segment=history">
              Back
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  <th className="w-[110px] border-b p-2 font-black">Number</th>
                  <th className="border-b p-2 font-black">Item</th>
                  <th className="w-[260px] border-b p-2 font-black">Value</th>
                </tr>
              </thead>
              <tbody>
                {(fields ?? []).map((f) => {
                  const a = byFieldId.get(f.id);
                  const val = formatValue(f.field_type, a);
                  return (
                    <tr key={f.id} className="align-top">
                      <td className="border-b p-2 font-semibold text-slate-700">
                        {f.qnum ?? ''}
                      </td>
                      <td className="border-b p-2 text-slate-900">{f.label}</td>
                      <td className="border-b p-2 font-semibold">{val}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
