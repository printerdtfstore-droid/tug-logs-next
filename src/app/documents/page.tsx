import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import VesselSelect from '@/components/VesselSelect';
import { signOut } from '@/app/login/actions';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ vesselId?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  const { data: vessels } = await supabase
    .from('vessels')
    .select('id,name,active')
    .eq('active', true)
    .order('name');

  const vesselId = sp.vesselId ?? vessels?.[0]?.id;

  type DocRow = {
    id: string;
    title: string;
    template_code: string | null;
    file_path: string;
    created_at: string;
  };

  const adminEnabled = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const client = adminEnabled ? supabaseAdmin() : supabase;

  const { data: docs, error: docsErr } = await client
    .from('documents')
    .select('id,title,template_code,file_path,created_at')
    .order('created_at', { ascending: false });

  const docsErrorMsg = docsErr ? docsErr.message : null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

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
              segment={'this_week'}
            />
          </div>

          <nav className="mt-4 space-y-1 text-sm font-semibold">
            <Link
              className="block rounded-xl px-3 py-2 opacity-90 hover:bg-white/10"
              href={`/tasks?vesselId=${encodeURIComponent(vesselId ?? '')}&segment=this_week`}
            >
              Logs
            </Link>
            <Link
              className="block rounded-xl px-3 py-2 opacity-90 hover:bg-white/10"
              href={`/forms?vesselId=${encodeURIComponent(vesselId ?? '')}&tab=library`}
            >
              Forms
            </Link>
            <div className="rounded-xl px-3 py-2 bg-white/15">Documents</div>
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
              <div className="text-sm font-black text-slate-900">Documents</div>
              <div className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
                {auth.user?.email ?? 'Guest'}
              </div>
            </div>
          </header>

          <section className="p-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="text-xs text-slate-500">
                Upload PDFs to Supabase Storage bucket <b>documents</b> and add rows in
                <code> public.documents</code>.
              </div>

              {docsErrorMsg ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  Documents error: {docsErrorMsg}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {((docs ?? []) as unknown as DocRow[]).map((d) => {
                  const url = base
                    ? `${base}/storage/v1/object/public/DOCUMENTS/${encodeURIComponent(d.file_path)}`
                    : '#';
                  return (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
                    >
                      <div>
                        <div className="text-sm font-black text-slate-900">{d.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {d.template_code ? `Template: ${d.template_code} • ` : ''}
                          File: {d.file_path}
                        </div>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
                      >
                        Download
                      </a>
                    </div>
                  );
                })}

                {(!docs || docs.length === 0) && (
                  <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                    No documents yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
