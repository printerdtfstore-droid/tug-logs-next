import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { adminImportTemplate } from './actions';

export default async function AdminImportPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; code?: string; fields?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-black">Admin Import</h1>
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


  return (
    <div className="min-h-dvh bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-xs font-semibold tracking-widest text-emerald-700">
            TUG LOGS
          </div>
          <h1 className="mt-2 text-xl font-black">Admin Import</h1>

          {sp.ok ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Imported <b>{sp.code}</b> with <b>{sp.fields}</b> fields.
            </div>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            Paste extracted PDF text and import a template + fields.
          </p>
          <div className="mt-3 text-xs text-slate-500">Signed in as: {auth.user.email}</div>
          <div className="mt-3 text-xs text-slate-500">
            Tip: If you send me the PDF here, I can extract the text for you.
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <form action={adminImportTemplate} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="text-xs font-bold text-slate-600">Template code</div>
                <input
                  name="code"
                  placeholder="FRM006692"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-600">Category</div>
                <input
                  name="category"
                  placeholder="Inspection"
                  defaultValue="Inspection"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-bold text-slate-600">Title</div>
              <input
                name="title"
                placeholder="2.21 S ABRASIVE WHEEL MACHINERY INSPECTION FORM"
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label className="block">
                <div className="text-xs font-bold text-slate-600">Default field type</div>
                <select
                  name="defaultFieldType"
                  defaultValue="button_choice"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="button_choice">Choice (radios)</option>
                  <option value="text">Text</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-bold text-slate-600">Choices preset</div>
                <select
                  name="choiceSet"
                  defaultValue="no_yes_na"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="fail_pass">Fail / Pass</option>
                  <option value="no_yes_na">No / Yes / N/A</option>
                  <option value="true_false">True / False</option>
                  <option value="custom">Custom (comma-separated)</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <div className="text-xs font-bold text-slate-600">Custom choices</div>
                <input
                  name="customChoices"
                  placeholder="Option A, Option B"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-bold text-slate-600">PDF upload (optional)</div>
              <input name="pdf" type="file" accept="application/pdf" className="mt-1 w-full text-sm" />
              <div className="mt-1 text-xs text-slate-500">
                PDF auto-extraction is temporarily disabled — for now, paste the extracted text below.
              </div>
            </label>

            <label className="block">
              <div className="text-xs font-bold text-slate-600">Extracted PDF text (optional)</div>
              <textarea
                name="rawText"
                rows={14}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
                placeholder="Leave blank if you uploaded a PDF, or paste extracted text with lines like: 1 HULL CHECKS, 1.1 Question..."
              />
            </label>

            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">
              Import template
            </button>
          </form>

          <div className="mt-4 text-xs text-slate-500">
            Note: Import overwrites existing fields for that template code.
          </div>
        </div>

        <div className="text-sm">
          <Link className="underline" href="/admin/tools">
            Back to Admin Tools
          </Link>
        </div>
      </div>
    </div>
  );
}
