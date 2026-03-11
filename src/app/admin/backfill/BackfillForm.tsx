'use client';

import { useMemo, useState, useTransition } from 'react';
import { runBackfill, ensureStartDateTask, generatePrefilledDrafts } from './actions';

export default function BackfillForm({
  vessels,
  templates,
}: {
  vessels: { id: string; name: string }[];
  templates: { id: string; code: string; title: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sourceTaskId, setSourceTaskId] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

        setMsg(null);
        startTransition(async () => {
          try {
            const res = await runBackfill({ vessel_id, template_id, start_date, end_date });
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
          <select name="vessel_id" className="mt-1 w-full rounded-xl border px-3 py-2">
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-bold">Template</div>
          <select name="template_id" className="mt-1 w-full rounded-xl border px-3 py-2">
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
            defaultValue={today}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-sm font-bold">End date</div>
          <input
            name="end_date"
            type="date"
            defaultValue={today}
            className="mt-1 w-full rounded-xl border px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
          <input name="auto_submit" type="checkbox" defaultChecked />
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

            setMsg(null);
            startTransition(async () => {
              try {
                const res = await ensureStartDateTask({ vessel_id, template_id, start_date });
                setSourceTaskId(res.taskId);
                setMsg(`Source task ready for ${start_date}. Opening fill page…`);
                window.location.href = `/fill/${res.taskId}?returnTo=/admin/backfill`;
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
