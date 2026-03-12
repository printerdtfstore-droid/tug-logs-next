import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

import BackfillForm from './BackfillForm';
import { generatePrefilledDrafts, type BackfillCadence } from './actions';

export default async function AdminBackfillPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Backfill</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in required.</p>
          <div className="mt-4">
            <Link className="underline" href="/login">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const email = auth.user.email ?? '';
  const isCrew = email.toLowerCase().startsWith('crew_');
  if (isCrew) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Backfill</h1>
          <p className="mt-2 text-sm text-slate-600">Not authorized.</p>
          <div className="mt-4">
            <Link className="underline" href="/tasks">
              Back to logs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: vessels } = await supabase
    .from('vessels')
    .select('id,name')
    .eq('active', true)
    .order('name');

  const { data: templates } = await supabase
    .from('form_templates')
    .select('id,code,title')
    .eq('active', true)
    .order('code');

  const sp = searchParams ?? {};
  const sourceTaskId = typeof sp.sourceTaskId === 'string' ? sp.sourceTaskId : null;
  const vessel_id = typeof sp.vessel_id === 'string' ? sp.vessel_id : null;
  const template_id = typeof sp.template_id === 'string' ? sp.template_id : null;
  const start_date = typeof sp.start_date === 'string' ? sp.start_date : null;
  const end_date = typeof sp.end_date === 'string' ? sp.end_date : null;
  const cadence =
    sp.cadence === 'weekly' || sp.cadence === 'monthly' || sp.cadence === 'daily'
      ? sp.cadence
      : null;
  const auto_submit = sp.auto_submit === '1' || sp.auto_submit === 'true' ? true : sp.auto_submit === '0' ? false : null;
  const auto_clone = sp.auto_clone === '1' || sp.auto_clone === 'true' ? true : false;

  const clone_ok = sp.clone_ok === '1' ? true : false;
  const tasksEnsured = typeof sp.tasksEnsured === 'string' ? Number(sp.tasksEnsured) : null;
  const draftsPrefilled = typeof sp.draftsPrefilled === 'string' ? Number(sp.draftsPrefilled) : null;
  const tasksAutoSubmitted = typeof sp.tasksAutoSubmitted === 'string' ? Number(sp.tasksAutoSubmitted) : null;

  const clone_error = typeof sp.clone_error === 'string' ? sp.clone_error : null;

  // If auto_clone=1, run the clone on the server (reliable), then redirect to a clean URL.
  if (
    auto_clone &&
    sourceTaskId &&
    vessel_id &&
    template_id &&
    start_date &&
    end_date &&
    cadence
  ) {
    try {
      const res = await generatePrefilledDrafts({
        vessel_id,
        template_id,
        start_date,
        end_date,
        source_task_id: sourceTaskId,
        cadence: cadence as BackfillCadence,
        auto_submit: auto_submit ?? false,
      });

      const clean = new URL('/admin/backfill', 'http://local');
      clean.searchParams.set('sourceTaskId', sourceTaskId);
      clean.searchParams.set('vessel_id', vessel_id);
      clean.searchParams.set('template_id', template_id);
      clean.searchParams.set('start_date', start_date);
      clean.searchParams.set('end_date', end_date);
      clean.searchParams.set('cadence', cadence);
      clean.searchParams.set('auto_submit', (auto_submit ?? false) ? '1' : '0');
      clean.searchParams.set('clone_ok', '1');
      clean.searchParams.set('tasksEnsured', String(res.tasksEnsured));
      clean.searchParams.set('draftsPrefilled', String(res.draftsPrefilled));
      clean.searchParams.set('tasksAutoSubmitted', String(res.tasksAutoSubmitted));

      redirect(clean.pathname + clean.search);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Clone failed';
      const clean = new URL('/admin/backfill', 'http://local');
      clean.searchParams.set('sourceTaskId', sourceTaskId);
      clean.searchParams.set('vessel_id', vessel_id);
      clean.searchParams.set('template_id', template_id);
      clean.searchParams.set('start_date', start_date);
      clean.searchParams.set('end_date', end_date);
      clean.searchParams.set('cadence', cadence);
      clean.searchParams.set('auto_submit', (auto_submit ?? false) ? '1' : '0');
      clean.searchParams.set('clone_ok', '0');
      clean.searchParams.set('clone_error', msg);
      redirect(clean.pathname + clean.search);
    }
  }

  const initialMsg = clone_ok
    ? `Cloned range. Ensured tasks: ${tasksEnsured ?? 0}. Prefilled: ${draftsPrefilled ?? 0}. Auto-submitted: ${tasksAutoSubmitted ?? 0}.`
    : clone_error
      ? `Clone failed: ${clone_error}`
      : null;

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700">TUG LOGS</div>
            <h1 className="mt-2 text-xl font-black">Admin Backfill</h1>
            <p className="mt-1 text-sm text-slate-600">
              Calls the Supabase RPC <code>backfill_tasks</code> with due time 11:59 PM Central.
            </p>
          </div>
          <Link className="underline" href="/tasks">
            Back
          </Link>
        </div>

        <BackfillForm
          vessels={vessels ?? []}
          templates={templates ?? []}
          initialSourceTaskId={sourceTaskId}
          initialVesselId={vessel_id}
          initialTemplateId={template_id}
          initialStartDate={start_date}
          initialEndDate={end_date}
          initialCadence={cadence}
          initialAutoSubmit={auto_submit}
          initialAutoClone={false}
        />
        {initialMsg ? (
          <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm">{initialMsg}</div>
        ) : null}
      </div>
    </div>
  );
}
