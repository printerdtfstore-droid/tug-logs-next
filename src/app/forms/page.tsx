import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import VesselSelect from '@/components/VesselSelect';
import { signOut } from '@/app/login/actions';
import OnDemandTemplates from '@/app/tasks/OnDemandTemplates';

type Tab = 'library' | 'history';

function tabLabel(t: Tab) {
  return t === 'library' ? 'Library' : 'History';
}

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ vesselId?: string; tab?: Tab }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'history' ? 'history' : 'library';

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  const { data: vessels } = await supabase
    .from('vessels')
    .select('id,name,active')
    .eq('active', true)
    .order('name');

  const vesselId = sp.vesselId ?? vessels?.[0]?.id;

  const { data: templates } = await supabase
    .from('form_templates')
    .select('id,code,title,category,active')
    .eq('active', true)
    .order('code');

  type HistoryTask = {
    id: string;
    status: string | null;
    recorded_date: string;
    due_at: string | null;
    form_templates?: { code?: string | null; title?: string | null } | null;
  };

  const { data: historyTasks }:
    | { data: HistoryTask[] | null }
    | { data: HistoryTask[] } =
    tab === 'history' && vesselId
      ? ((await supabase
          .from('tasks')
          .select(
            'id,status,recorded_date,due_at,template_id,vessel_id,form_templates(code,title)'
          )
          .eq('vessel_id', vesselId)
          .eq('status', 'Submitted')
          .order('recorded_date', { ascending: false })
          .limit(200)) as unknown as { data: HistoryTask[] | null })
      : { data: [] as HistoryTask[] };

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="flex min-h-dvh">
        <aside className="w-[260px] bg-emerald-900 text-white p-4">
          <div className="text-sm font-extrabold tracking-widest">TUG LOGS</div>

          <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3 text-sm">
            <div className="opacity-80">Vessel</div>
            <VesselSelect
              vessels={(vessels ?? []).map((v) => ({ id: v.id, name: v.name }))}
              value={vesselId}
              segment={'on_demand'}
            />
          </div>

          <nav className="mt-4 space-y-1 text-sm font-semibold">
            <Link
              className="block rounded-xl px-3 py-2 opacity-90 hover:bg-white/10"
              href={`/tasks?vesselId=${encodeURIComponent(vesselId ?? '')}&segment=this_week`}
            >
              Logs
            </Link>
            {['Personnel', 'Requisitions'].map((item) => (
              <div key={item} className="rounded-xl px-3 py-2 opacity-90">
                {item}
              </div>
            ))}
            <div className="rounded-xl px-3 py-2 bg-white/15">Forms</div>
            <Link
              className="block rounded-xl px-3 py-2 opacity-90 hover:bg-white/10"
              href={`/documents?vesselId=${encodeURIComponent(vesselId ?? '')}`}
            >
              Documents
            </Link>
            <div className="rounded-xl px-3 py-2 opacity-90">Overview</div>
          </nav>

          {auth.user ? (
            <form action={signOut} className="mt-6">
              <button className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">
                Sign out
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <Link
                className="block w-full rounded-xl bg-white/10 px-3 py-2 text-center text-sm font-semibold hover:bg-white/15"
                href="/login"
              >
                Sign in
              </Link>
            </div>
          )}
        </aside>

        <main className="flex-1">
          <header className="border-b bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-slate-900">Forms</div>
              <div className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
                {auth.user?.email ?? 'Guest'}
              </div>
            </div>
          </header>

          <section className="p-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(['library', 'history'] as Tab[]).map((t) => (
                  <Link
                    key={t}
                    href={`/forms?vesselId=${encodeURIComponent(vesselId ?? '')}&tab=${t}`}
                    className={`rounded-xl border px-3 py-2 text-sm font-extrabold ${
                      t === tab
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50'
                    }`}
                  >
                    {tabLabel(t)}
                  </Link>
                ))}
              </div>

              {!vesselId ? (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                  Select a vessel to view forms.
                </div>
              ) : tab === 'library' ? (
                <OnDemandTemplates
                  vesselId={vesselId}
                  templates={(templates ?? []).map((t) => ({
                    id: t.id,
                    code: t.code,
                    title: t.title,
                    category: t.category,
                  }))}
                />
              ) : (
                <div className="space-y-3">
                  {(historyTasks ?? []).map((task) => {
                    const tpl = (task as unknown as HistoryTask).form_templates ?? undefined;
                    const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim() || 'Form';
                    return (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
                      >
                        <div>
                          <div className="text-sm font-black text-slate-900">{title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Recorded: {task.recorded_date}
                            {task.due_at ? ` • Due: ${new Date(task.due_at).toLocaleString()}` : ''}
                          </div>
                        </div>
                        <Link
                          href={`/view/${encodeURIComponent(task.id)}`}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
                        >
                          View
                        </Link>
                      </div>
                    );
                  })}

                  {(!historyTasks || historyTasks.length === 0) && (
                    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                      No submitted forms yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
