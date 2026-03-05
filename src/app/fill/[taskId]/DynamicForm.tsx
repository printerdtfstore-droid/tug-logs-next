'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveAnswer, submitForm } from './actions';

export type Field = {
  id: string;
  qnum: string | null;
  label: string;
  field_type: string;
  required: boolean;
  choices: string[];
  sub_label_a: string | null;
  sub_label_b: string | null;
  order: number;
};

export type ExistingAnswer = {
  field_id: string;
  value_text: string | null;
  value_option_text: string | null;
  value_time_text: string | null;
  value_time_text_a: string | null;
  value_time_text_b: string | null;
};

export default function DynamicForm({
  submissionId,
  fields,
  existing,
  onSubmittedUrl,
}: {
  submissionId: string;
  fields: Field[];
  existing: ExistingAnswer[];
  onSubmittedUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);

  const byField = useMemo(() => {
    const map = new Map<string, ExistingAnswer>();
    for (const a of existing) map.set(a.field_id, a);
    return map;
  }, [existing]);

  function setSave(
    fieldId: string,
    payload: Record<string, string | null | undefined>
  ) {
    setSavingFieldId(fieldId);
    startTransition(async () => {
      try {
        await saveAnswer({ submissionId, fieldId, ...payload });
      } finally {
        setSavingFieldId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const a = byField.get(f.id);
        const label = f.qnum ? `${f.qnum} ${f.label}` : f.label;

        return (
          <div key={f.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black">{label}</div>
                {f.required ? (
                  <div className="mt-1 text-xs font-bold text-amber-700">
                    Required
                  </div>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                {savingFieldId === f.id ? 'Saving…' : null}
              </div>
            </div>

            <div className="mt-3">
              {f.field_type === 'text' || f.field_type === 'number' ? (
                <input
                  defaultValue={a?.value_text ?? ''}
                  type={f.field_type === 'number' ? 'number' : 'text'}
                  className="w-full rounded-xl border px-3 py-2"
                  onBlur={(e) =>
                    setSave(f.id, { value_text: e.currentTarget.value })
                  }
                />
              ) : null}

              {f.field_type === 'time' ? (
                <input
                  defaultValue={a?.value_time_text ?? ''}
                  type="text"
                  placeholder="HH:MM"
                  className="w-full rounded-xl border px-3 py-2"
                  onBlur={(e) =>
                    setSave(f.id, { value_time_text: e.currentTarget.value })
                  }
                />
              ) : null}

              {f.field_type === 'time_range' ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-bold text-slate-600">
                      {f.sub_label_a ?? 'On'}
                    </div>
                    <input
                      id={`${f.id}-a`}
                      defaultValue={a?.value_time_text_a ?? ''}
                      type="text"
                      placeholder="HH:MM"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      onBlur={(e) =>
                        setSave(f.id, {
                          value_time_text_a: e.currentTarget.value,
                          value_time_text_b:
                            (document.getElementById(
                              `${f.id}-b`
                            ) as HTMLInputElement | null)?.value ??
                            a?.value_time_text_b ??
                            '',
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-bold text-slate-600">
                      {f.sub_label_b ?? 'Off'}
                    </div>
                    <input
                      id={`${f.id}-b`}
                      defaultValue={a?.value_time_text_b ?? ''}
                      type="text"
                      placeholder="HH:MM"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      onBlur={(e) =>
                        setSave(f.id, {
                          value_time_text_b: e.currentTarget.value,
                          value_time_text_a:
                            (document.getElementById(
                              `${f.id}-a`
                            ) as HTMLInputElement | null)?.value ??
                            a?.value_time_text_a ??
                            '',
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}

              {f.field_type === 'button_choice' ? (
                <div className="flex flex-wrap gap-2">
                  {(f.choices ?? []).map((c) => {
                    const active = (a?.value_option_text ?? '') === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`rounded-xl border px-4 py-2 text-sm font-black ${
                          active
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50'
                        }`}
                        onClick={() =>
                          setSave(f.id, { value_option_text: c })
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={pending}
        className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-base font-black text-white disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            await submitForm({ submissionId });
            window.location.href = onSubmittedUrl;
          })
        }
      >
        Submit
      </button>
    </div>
  );
}
