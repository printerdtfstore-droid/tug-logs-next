import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import {
  adminBackfillFrm006702,
  adminClearHistory,
  adminGenerateToday,
  adminGenerateTodayFrm006703,
} from './actions';

function centralYMD(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export default async function AdminToolsPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Tools</h1>
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

  if (!isAdminEmail(auth.user.email)) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Tools</h1>
          <p className="mt-2 text-sm text-slate-600">Not authorized.</p>
          <p className="mt-2 text-xs text-slate-500">
            Add your email to <code>ADMIN_EMAILS</code> in Vercel.
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

  const today = centralYMD();

  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-xs font-semibold tracking-widest text-emerald-700">
            TUG LOGS
          </div>
          <h1 className="mt-2 text-xl font-black">Admin Tools</h1>
          <p className="mt-1 text-sm text-slate-600">
            Buttons for the stuff you were doing in SQL Editor.
          </p>
          <div className="mt-3 text-xs text-slate-500">
            Signed in as: {auth.user.email}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-black">FRM006702 — Generate today (0600 + 1200)</h2>
          <form action={adminGenerateToday} className="mt-3">
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">
              Generate today ({today})
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-black">FRM006703 — Generate today (0600)</h2>
          <form action={adminGenerateTodayFrm006703} className="mt-3">
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">
              Generate today ({today})
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-black">FRM006702 — Backfill date range (2/day)</h2>
          <form action={adminBackfillFrm006702} className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs font-bold text-slate-600">Start date</div>
                <input
                  name="startDate"
                  type="date"
                  defaultValue="2025-12-01"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-600">End date</div>
                <input
                  name="endDate"
                  type="date"
                  defaultValue={today}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">
              Backfill
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            This will attempt to create 2 tasks/day/vessel for the whole range.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-black">Clear submitted History</h2>
          <p className="mt-2 text-xs text-slate-500">
            Deletes Submitted tasks + submissions + answers. Templates and vessels remain.
          </p>
          <form action={adminClearHistory} className="mt-3">
            <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">
              Clear History
            </button>
          </form>
        </div>

        <div className="text-sm">
          <Link className="underline" href="/tasks">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
