import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import BackfillForm from './BackfillForm';

export default async function AdminBackfillPage() {
  const supabase = supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  if (!isAdminEmail(auth.user.email)) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Backfill</h1>
          <p className="mt-2 text-sm text-slate-600">Not authorized.</p>
          <p className="mt-2 text-xs text-slate-500">
            Add your email to <code>ADMIN_EMAILS</code> in Vercel env vars.
          </p>
          <div className="mt-4">
            <Link className="underline" href="/tasks">
              Back
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

        <BackfillForm vessels={vessels ?? []} templates={templates ?? []} />
      </div>
    </div>
  );
}
