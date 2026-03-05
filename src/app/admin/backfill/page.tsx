import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

export default async function AdminBackfillPage() {
  const supabase = supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  // TODO: call RPC backfill_tasks with selected vessel/template/date range.
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

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-widest text-emerald-700">TUG LOGS</div>
            <h1 className="mt-2 text-xl font-black">Admin Backfill</h1>
            <p className="mt-1 text-sm text-slate-600">
              Generate missing tasks for a date range (uses Supabase RPC <code>backfill_tasks</code>).
            </p>
          </div>
          <Link className="underline" href="/tasks">
            Back
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Backfill UI + RPC wiring not implemented yet.
          <div className="mt-2 text-xs text-amber-900/80">
            Vessels found: {(vessels ?? []).length} • Templates found: {(templates ?? []).length}
          </div>
        </div>
      </div>
    </div>
  );
}
