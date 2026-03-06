'use client';

import { useState, useTransition } from 'react';
import { updateRecordedDate } from './actions';

export default function RecordedDatePicker({
  taskId,
  recordedDate,
  disabled,
}: {
  taskId: string;
  recordedDate: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(recordedDate);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs font-bold text-slate-600">Recorded date</div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="rounded-xl border px-3 py-2 text-sm"
          value={value}
          disabled={disabled || pending}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setValue(next);
            setError(null);
            startTransition(async () => {
              try {
                const res = await updateRecordedDate({ taskId, recordedDate: next });
                const redirectId = (res as unknown as { redirectTaskId?: string }).redirectTaskId;
                if (redirectId) {
                  window.location.href = `/fill/${encodeURIComponent(redirectId)}`;
                } else {
                  window.location.reload();
                }
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Failed to update');
              }
            });
          }}
        />
        {pending ? <div className="text-xs text-slate-500">Saving…</div> : null}
      </div>
      {error ? (
        <div className="mt-2 text-xs font-bold text-red-700">{error}</div>
      ) : null}
      <div className="mt-2 text-[11px] text-slate-500">
        Changing recorded date will change where this log appears in History.
      </div>
    </div>
  );
}
