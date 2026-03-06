'use client';

import { useMemo, useState, useTransition } from 'react';
import { startOnDemand } from './onDemandActions';

export default function OnDemandTemplates({
  vesselId,
  templates,
}: {
  vesselId: string | undefined;
  templates: { id: string; code: string; title: string; category: string | null }[];
}) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultDate = useMemo(() => {
    // Central date
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  }, []);

  const [date, setDate] = useState(defaultDate);

  if (!vesselId) {
    return (
      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
        Select a vessel first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-black">On Demand</div>
          <div className="text-xs text-slate-500">
            Pick a date, then start any template.
          </div>
        </div>
        <label className="block">
          <div className="text-xs font-bold text-slate-600">Recorded date</div>
          <input
            type="date"
            className="mt-1 rounded-xl border px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
        </label>
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMsg}
        </div>
      ) : null}

      <div className="space-y-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
          >
            <div>
              <div className="text-sm font-black">
                {t.code} {t.title}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Category: {t.category ?? '—'}
              </div>
            </div>
            <button
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              onClick={() => {
                setErrorMsg(null);
                startTransition(async () => {
                  try {
                    const res = await startOnDemand({
                      vesselId,
                      templateId: t.id,
                      recordedDate: date,
                    });
                    window.location.href = `/fill/${encodeURIComponent(res.taskId)}`;
                  } catch (e: unknown) {
                    setErrorMsg(e instanceof Error ? e.message : 'Failed to start');
                  }
                });
              }}
            >
              Start
            </button>
          </div>
        ))}

        {templates.length === 0 ? (
          <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
            No active templates.
          </div>
        ) : null}
      </div>
    </div>
  );
}
