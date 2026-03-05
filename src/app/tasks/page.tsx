import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

type Segment = 'this_week' | 'beyond' | 'on_demand' | 'backfill' | 'history';

function segmentLabel(seg: Segment) {
  switch (seg) {
    case 'this_week':
      return 'This Week';
    case 'beyond':
      return 'Beyond This Week';
    case 'on_demand':
      return 'On Demand';
    case 'backfill':
      return 'Backfill Queue';
    case 'history':
      return 'History';
  }
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ vesselId?: string; segment?: Segment }>;
}) {
  const sp = await searchParams;
  const segment: Segment = sp.segment ?? 'this_week';

  const supabase = supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data: vessels } = await supabase
    .from('vessels')
    .select('id,name,active')
    .eq('active', true)
    .order('name');

  const vesselId = sp.vesselId ?? vessels?.[0]?.id;

  // NOTE: For now, we keep segment filtering simple; once we add week_start_date logic + month grouping,
  // this query will be refined.
  let q = supabase
    .from('tasks')
    .select(
      'id, status, due_type, recorded_date, due_at, is_backfilled, required_count, answered_count, template_id, vessel_id, form_templates(code,title)'
    )
    .eq('vessel_id', vesselId ?? '')
    .order('recorded_date', { ascending: false })
    .limit(100);

  if (segment === 'history') {
    q = q.eq('status', 'Submitted');
  } else {
    q = q.eq('status', 'Open');
    if (segment === 'on_demand') q = q.eq('due_type', 'OnDemand');
    if (segment === 'backfill') q = q.eq('is_backfilled', true);
    if (segment === 'this_week' || segment === 'beyond') {
      q = q.eq('due_type', 'Scheduled');
    }
  }

  const { data: tasks, error } = await q;

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="flex min-h-dvh">
        {/* Sidebar */}
        <aside className="w-[260px] bg-emerald-900 text-white p-4">
          <div className="text-sm font-extrabold tracking-widest">TUG LOGS</div>

          <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
            <div className="opacity-80">Vessel</div>
            <div className="mt-1 font-semibold">
              {vessels?.find((v) => v.id === vesselId)?.name ?? '—'}
            </div>
            <div className="mt-2 space-y-1">
              {(vessels ?? []).map((v) => (
                <Link
                  key={v.id}
                  className={`block rounded-lg px-2 py-1 text-sm ${
                    v.id === vesselId ? 'bg-white/15' : 'hover:bg-white/10'
                  }`}
                  href={`/tasks?vesselId=${encodeURIComponent(v.id)}&segment=${segment}`}
                >
                  {v.name}
                </Link>
              ))}
            </div>
          </div>

          <nav className="mt-4 space-y-1 text-sm font-semibold">
            {['Logs', 'Personnel', 'Requisitions', 'Forms', 'Documents', 'Overview'].map((item) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 ${item === 'Logs' ? 'bg-white/15' : 'opacity-90'}`}
              >
                {item}
              </div>
            ))}
          </nav>

          <form action={signOut} className="mt-6">
            <button className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">
              Sign out
            </button>
          </form>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <header className="border-b bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  'Wheelhouse',
                  'Engine Log',
                  'Worklists',
                  'Audit / Survey',
                  'JSA',
                  'On Demand',
                  'History',
                ].map((t) => (
                  <span
                    key={t}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                      t === 'Wheelhouse'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50'
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
                {auth.user.email}
              </div>
            </div>
          </header>

          <section className="p-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(
                  ['this_week', 'beyond', 'on_demand', 'backfill', 'history'] as Segment[]
                ).map((seg) => (
                  <Link
                    key={seg}
                    href={`/tasks?vesselId=${encodeURIComponent(vesselId ?? '')}&segment=${seg}`}
                    className={`rounded-xl border px-3 py-2 text-sm font-extrabold ${
                      seg === segment
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50'
                    }`}
                  >
                    {segmentLabel(seg)}
                  </Link>
                ))}
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error.message}
                </div>
              ) : null}

              <div className="space-y-3">
                {(tasks ?? []).map((task) => {
                  const tpl = (task as unknown as { form_templates?: { code: string; title: string } }).form_templates;
                  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim() || 'Task';
                  const meta = task.is_backfilled
                    ? `Recorded: ${task.recorded_date}`
                    : task.due_at
                      ? `Due: ${new Date(task.due_at).toLocaleString()}`
                      : `Recorded: ${task.recorded_date}`;

                  return (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
                    >
                      <div>
                        <div className="text-sm font-black text-slate-900">{title}</div>
                        <div className="mt-1 text-xs text-slate-500">{meta}</div>
                        <div className="mt-2 text-xs font-extrabold">
                          Items Finished: {task.answered_count} / {task.required_count}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] font-black">
                          {task.status?.toUpperCase()}
                        </span>
                        {task.is_backfilled ? (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-800">
                            BACKFILL
                          </span>
                        ) : null}
                        <Link
                          href={`/tasks/${encodeURIComponent(task.id)}`}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
                        >
                          Start
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {(!tasks || tasks.length === 0) && (
                  <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                    No tasks yet. Create a vessel + template, or run backfill.
                  </div>
                )}
              </div>

              <div className="mt-4 text-sm">
                <Link className="underline" href="/admin/backfill">
                  Admin: Backfill
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
