'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  runBackfill,
  ensureStartDateTask,
  generatePrefilledDrafts,
  type BackfillCadence,
} from './actions';

export default function BackfillForm({
  vessels,
  templates,
  initialSourceTaskId,
  initialVesselId,
  initialTemplateId,
  initialStartDate,
  initialEndDate,
  initialCadence,
  initialAutoSubmit,
  initialAutoClone,
}: {
  vessels: { id: string; name: string }[];
  templates: { id: string; code: string; title: string }[];
  initialSourceTaskId: string | null;
  initialVesselId: string | null;
  initialTemplateId: string | null;
  initialStartDate: string | null;
  initialEndDate: string | null;
  initialCadence: BackfillCadence | null;
  initialAutoSubmit: boolean | null;
  initialAutoClone: boolean | null;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sourceTaskId, setSourceTaskId] = useState<string | null>(initialSourceTaskId);
  const autoCloneRanRef = useRef(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = initialStartDate ?? today;
  const defaultEnd = initialEndDate ?? today;
  const defaultCadence: BackfillCadence = initialCadence ?? 'daily';
  const defaultAutoSubmit = initialAutoSubmit ?? true;

  useEffect(() => {
    // If we came back from the start-day Submit with auto_clone=1, run the clone automatically.
    if (!initialAutoClone) return;
    if (!sourceTaskId) return;
    if (autoCloneRanRef.current) return;

    const form = document.querySelector('form');
    if (!form) return;

    const fd = new FormData(form as HTMLFormElement);
    const vessel_id = String(fd.get('vessel_id'));
    const template_id = String(fd.get('template_id'));
    const start_date = String(fd.get('start_date'));
    const end_date = String(fd.get('end_date'));
    const cadenceRaw = String(fd.get('cadence') ?? 'daily');
    const cadence: BackfillCadence =
      cadenceRaw === 'weekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'daily';
    const auto_submit = Boolean(fd.get('auto_submit'));

    autoCloneRanRef.current = true;

    startTransition(async () => {
      setMsg('Cloning range…');
      try {
        const res = await generatePrefilledDrafts({
          vessel_id,
          template_id,
          start_date,
          end_date,
          source_task_id: sourceTaskId,
          cadence,
          auto_submit,
        });
        setMsg(
          `Created/ensured ${res.tasksEnsured} tasks and prefilled ${res.draftsPrefilled} submissions.` +
            (res.tasksAutoSubmitted ? ` Auto-submitted: ${res.tasksAutoSubmitted}.` : '')
        );
        // Remove auto_clone=1 so refresh doesn't re-run.
        const url = new URL(window.location.href);
        url.searchParams.delete('auto_clone');
        window.history.replaceState({}, '', url.toString());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Prefill failed';
        setMsg(msg);
      }
    });
  }, [initialAutoClone, sourceTaskId, startTransition]);

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const vessel_id = String(fd.get('vessel_id'));
        const template_id = String(fd.get('template_id'));
        const start_date = String(fd.get('start_date'));
        const end_date = String(fd.get('end_date'));
        const cadenceRaw = String(fd.get('cadence') ?? 'daily');
        const cadence: BackfillCadence =
          cadenceRaw === 'weekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'daily';

        setMsg(null);
        startTransition(async () => {
          try {
            const res = await runBackfill({ vessel_id, template_id, start_date, end_date, cadence });
            setMsg(`Created ${res.created} tasks.`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Backfill failed';
            setMsg(msg);
          }
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="text-sm font-bold">Vessel</div>
          <select
            name="vessel_id"
            defaultValue={initialVesselId ?? vessels[0]?.id}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          >
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-bold">Template</div>
          <select
            name="template_id"
            defaultValue={initialTemplateId ?? templates[0]?.id}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} {t.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-bold">Start date</div>
          <input
            name="start_date"
            type="date"
            defaultValue={defaultStart}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-sm font-bold">End date</div>
          <input
            name="end_date"
            type="date"
            defaultValue={defaultEnd}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-xl border bg-slate-50 p-3 text-sm font-bold">
        <div className="text-sm font-black">Cadence</div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="cadence" value="daily" defaultChecked={defaultCadence === 'daily'} /> Daily
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="cadence" value="weekly" defaultChecked={defaultCadence === 'weekly'} /> Weekly
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="cadence" value="monthly" defaultChecked={defaultCadence === 'monthly'} /> Monthly
          </label>
        </div>
        <div className="mt-2 text-xs font-semibold text-slate-600">
          Weekly = same weekday as Start date. Monthly = same day-of-month as Start date (clamped to month end).
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
          <input name="auto_submit" type="checkbox" defaultChecked={defaultAutoSubmit} />
          Auto-submit cloned days (shows in History)
        </label>
        <button
          disabled={pending}
          className="w-full rounded-2xl border border-emerald-700 bg-white px-4 py-3 text-base font-black text-emerald-800 disabled:opacity-60"
          type="button"
          onClick={() => {
            const form = document.querySelector('form');
            if (!form) return;
            const fd = new FormData(form as HTMLFormElement);
            const vessel_id = String(fd.get('vessel_id'));
            const template_id = String(fd.get('template_id'));
            const start_date = String(fd.get('start_date'));
            const cadenceRaw = String(fd.get('cadence') ?? 'daily');
            const cadence: BackfillCadence =
              cadenceRaw === 'weekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'daily';

            setMsg(null);
            startTransition(async () => {
              try {
                const res = await ensureStartDateTask({ vessel_id, template_id, start_date });
                setSourceTaskId(res.taskId);
                setMsg(`Source task ready for ${start_date}. Opening fill page…`);
                const auto_submit = Boolean(fd.get('auto_submit'));
                const returnTo = new URL('/admin/backfill', window.location.origin);
                returnTo.searchParams.set('sourceTaskId', res.taskId);
                returnTo.searchParams.set('vessel_id', vessel_id);
                returnTo.searchParams.set('template_id', template_id);
                returnTo.searchParams.set('start_date', String(fd.get('start_date')));
                returnTo.searchParams.set('end_date', String(fd.get('end_date')));
                returnTo.searchParams.set('cadence', cadence);
                returnTo.searchParams.set('auto_submit', auto_submit ? '1' : '0');
                // Auto-run clone after the start-day submit.
                returnTo.searchParams.set('auto_clone', '1');

                window.location.href = `/fill/${res.taskId}?returnTo=${encodeURIComponent(returnTo.pathname + returnTo.search)}`;
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Failed to create source task';
                setMsg(msg);
              }
            });
          }}
        >
          Fill out template (Start date)
        </button>

        <button
          disabled={pending}
          className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-base font-black text-white disabled:opacity-60"
          type="submit"
        >
          Generate Missing Logs
        </button>

        <button
          disabled={pending || !sourceTaskId}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-black text-white disabled:opacity-60 sm:col-span-2"
          type="button"
          onClick={() => {
            const fd = new FormData(document.querySelector('form') as HTMLFormElement);
            const vessel_id = String(fd.get('vessel_id'));
            const template_id = String(fd.get('template_id'));
            const start_date = String(fd.get('start_date'));
            const end_date = String(fd.get('end_date'));
            const cadenceRaw = String(fd.get('cadence') ?? 'daily');
            const cadence: BackfillCadence =
              cadenceRaw === 'weekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'daily';
            const auto_submit = Boolean(fd.get('auto_submit'));

            setMsg(null);
            startTransition(async () => {
              try {
                const res = await generatePrefilledDrafts({
                  vessel_id,
                  template_id,
                  start_date,
                  end_date,
                  source_task_id: sourceTaskId!,
                  cadence,
                  auto_submit,
                });
                setMsg(
                  `Created/ensured ${res.tasksEnsured} tasks and prefilled ${res.draftsPrefilled} submissions.` +
                    (res.tasksAutoSubmitted
                      ? ` Auto-submitted: ${res.tasksAutoSubmitted}.`
                      : '')
                );
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Prefill failed';
                setMsg(msg);
              }
            });
          }}
        >
          Generate prefilled drafts (clone Start date)
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border bg-slate-50 p-3 text-sm">{msg}</div>
      ) : null}
    </form>
  );
}
