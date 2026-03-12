'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
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
  referencePdfUrl,
}: {
  submissionId: string;
  fields: Field[];
  existing: ExistingAnswer[];
  onSubmittedUrl: string;
  referencePdfUrl?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const byField = useMemo(() => {
    const map = new Map<string, ExistingAnswer>();
    for (const a of existing) map.set(a.field_id, a);
    return map;
  }, [existing]);

  const [optionByFieldId, setOptionByFieldId] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const a of existing) {
        if (a.value_option_text) init[a.field_id] = a.value_option_text;
      }
      return init;
    }
  );

  const employeeNames = useMemo(
    () => [
      'DEWANDE RAGLEN',
      'CHARLES CROSBY',
      'CHARLES ROSE',
      'ANDRES MORALES',
      'ORBIE CROSBY',
      'CARLOS BERLANGA',
      'RICHARD WASHBURN',
      'ADRIAN BROWN',
      'JOHN EPPS',
    ],
    []
  );

  const timeOptions = useMemo(() => {
    const opts: string[] = [''];
    for (let mins = 0; mins < 24 * 60; mins += 5) {
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      opts.push(`${hh}:${mm}`);
    }
    return opts;
  }, []);

  function setSave(
    fieldId: string,
    payload: Record<string, string | null | undefined>
  ) {
    setSavingFieldId(fieldId);
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveAnswer({ submissionId, fieldId, ...payload });
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSavingFieldId(null);
      }
    });
  }

  function scheduleSave(
    fieldId: string,
    payload: Record<string, string | null | undefined>,
    delayMs = 400
  ) {
    const existing = saveTimers.current[fieldId];
    if (existing) clearTimeout(existing);
    saveTimers.current[fieldId] = setTimeout(() => {
      setSave(fieldId, payload);
    }, delayMs);
  }

  return (
    <div className="rounded-xl border bg-white">
      {errorMsg ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMsg}
        </div>
      ) : null}

      <datalist id="time-options">
        {timeOptions.filter(Boolean).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <datalist id="employee-names">
        {employeeNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="divide-y">
        {fields.map((f) => {
        const a = byField.get(f.id);
        const label = f.qnum ? `${f.qnum} ${f.label}` : f.label;
        const isNameField = /\bname\b|signature|crew member|captain|engineer/i.test(f.label);

        if (f.field_type === 'section') {
          return (
            <div key={f.id} className="bg-slate-50 px-3 py-2">
              <div className="text-sm font-black text-slate-900">{label}</div>
            </div>
          );
        }

        if (f.field_type === 'info') {
          const showPaperclip =
            Boolean(referencePdfUrl) &&
            (label.toLowerCase().includes('paper clip') ||
              label.toLowerCase().includes('paperclip'));

          return (
            <div key={f.id} className="bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-black text-slate-900">{label}</div>
                {showPaperclip ? (
                  <a
                    href={referencePdfUrl ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border bg-white px-2 py-1 text-sm font-black"
                    title="Download reference"
                  >
                    📎
                  </a>
                ) : null}
              </div>
            </div>
          );
        }

        return (
          <div key={f.id} className="px-3 py-3">
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
                  list={f.field_type === 'text' && isNameField ? 'employee-names' : undefined}
                  placeholder={
                    f.field_type === 'number'
                      ? 'Enter a number'
                      : (f.sub_label_a ?? '')
                  }
                  className="w-full rounded-xl border px-3 py-2"
                  onChange={(e) =>
                    scheduleSave(f.id, { value_text: e.currentTarget.value })
                  }
                  onBlur={(e) =>
                    setSave(f.id, { value_text: e.currentTarget.value })
                  }
                />
              ) : null}

              {f.field_type === 'time' ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    id={`${f.id}-t`}
                    list="time-options"
                    defaultValue={a?.value_time_text ?? ''}
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM"
                    className="min-w-[180px] flex-1 rounded-xl border px-3 py-2"
                    onChange={(e) =>
                      scheduleSave(f.id, { value_time_text: e.currentTarget.value })
                    }
                    onBlur={(e) =>
                      setSave(f.id, { value_time_text: e.currentTarget.value })
                    }
                  />
                  <select
                    defaultValue={a?.value_time_text ?? ''}
                    className="rounded-xl border px-3 py-2"
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const el = document.getElementById(
                        `${f.id}-t`
                      ) as HTMLInputElement | null;
                      if (el) el.value = v;
                      setSave(f.id, { value_time_text: v });
                    }}
                  >
                    {timeOptions.map((t) => (
                      <option key={t || 'blank'} value={t}>
                        {t || '—'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {f.field_type === 'time_range' ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <div className="text-xs font-bold text-slate-600">
                      {f.sub_label_a ?? 'On'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <input
                        id={`${f.id}-a`}
                        list="time-options"
                        defaultValue={a?.value_time_text_a ?? ''}
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:MM"
                        className="min-w-[140px] flex-1 rounded-xl border px-3 py-2"
                        onChange={(e) =>
                          scheduleSave(f.id, {
                            value_time_text_a: e.currentTarget.value,
                            value_time_text_b:
                              (document.getElementById(
                                `${f.id}-b`
                              ) as HTMLInputElement | null)?.value ??
                              a?.value_time_text_b ??
                              '',
                          })
                        }
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
                      <select
                        defaultValue={a?.value_time_text_a ?? ''}
                        className="rounded-xl border px-3 py-2"
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          const el = document.getElementById(
                            `${f.id}-a`
                          ) as HTMLInputElement | null;
                          if (el) el.value = v;
                          setSave(f.id, {
                            value_time_text_a: v,
                            value_time_text_b:
                              (document.getElementById(
                                `${f.id}-b`
                              ) as HTMLInputElement | null)?.value ??
                              a?.value_time_text_b ??
                              '',
                          });
                        }}
                      >
                        {timeOptions.map((t) => (
                          <option key={t || 'blank'} value={t}>
                            {t || '—'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <div className="text-xs font-bold text-slate-600">
                      {f.sub_label_b ?? 'Off'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <input
                        id={`${f.id}-b`}
                        list="time-options"
                        defaultValue={a?.value_time_text_b ?? ''}
                        type="text"
                        inputMode="numeric"
                        placeholder="HH:MM"
                        className="min-w-[140px] flex-1 rounded-xl border px-3 py-2"
                        onChange={(e) =>
                          scheduleSave(f.id, {
                            value_time_text_b: e.currentTarget.value,
                            value_time_text_a:
                              (document.getElementById(
                                `${f.id}-a`
                              ) as HTMLInputElement | null)?.value ??
                              a?.value_time_text_a ??
                              '',
                          })
                        }
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
                      <select
                        defaultValue={a?.value_time_text_b ?? ''}
                        className="rounded-xl border px-3 py-2"
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          const el = document.getElementById(
                            `${f.id}-b`
                          ) as HTMLInputElement | null;
                          if (el) el.value = v;
                          setSave(f.id, {
                            value_time_text_b: v,
                            value_time_text_a:
                              (document.getElementById(
                                `${f.id}-a`
                              ) as HTMLInputElement | null)?.value ??
                              a?.value_time_text_a ??
                              '',
                          });
                        }}
                      >
                        {timeOptions.map((t) => (
                          <option key={t || 'blank'} value={t}>
                            {t || '—'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
              ) : null}

              {f.field_type === 'button_choice' ? (
                <div className="flex flex-col gap-2">
                  {(f.choices ?? []).map((c) => {
                    const active =
                      (optionByFieldId[f.id] ?? a?.value_option_text ?? '') === c;
                    return (
                      <label
                        key={c}
                        className="flex items-center justify-end gap-2 text-sm"
                      >
                        <span className="font-semibold text-slate-900">{c}</span>
                        <input
                          type="radio"
                          name={f.id}
                          checked={active}
                          onChange={() => {
                            setOptionByFieldId((prev) => ({ ...prev, [f.id]: c }));
                            setSave(f.id, { value_option_text: c });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      </div>

      <button
        type="button"
        disabled={pending}
        className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-base font-black text-white disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            setErrorMsg(null);
            try {
              await submitForm({ submissionId });
              const rt = new URL(window.location.href).searchParams.get('returnTo');
              const dest = rt && rt.startsWith('/') ? rt : onSubmittedUrl;
              window.location.href = dest;
            } catch (e: unknown) {
              setErrorMsg(e instanceof Error ? e.message : 'Submit failed');
            }
          })
        }
      >
        Submit
      </button>
    </div>
  );
}
