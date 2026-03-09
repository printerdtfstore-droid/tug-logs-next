'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

type ChoicePreset = 'fail_pass' | 'no_yes_na' | 'custom';

function normalizeLines(raw: string) {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function slugKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function parseTemplateText(input: {
  rawText: string;
  defaultFieldType: 'text' | 'button_choice';
  choiceSet: ChoicePreset;
  customChoices: string;
}) {
  const lines = normalizeLines(input.rawText);

  const choices =
    input.choiceSet === 'fail_pass'
      ? ['Fail', 'Pass']
      : input.choiceSet === 'no_yes_na'
        ? ['No', 'Yes', 'N/A']
        : input.customChoices
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

  if (input.defaultFieldType === 'button_choice' && choices.length < 2) {
    throw new Error('Importer: choices must have at least 2 items');
  }

  type Field = {
    qnum: string;
    label: string;
    field_type: string;
    required: boolean;
    choices: string[];
    field_key: string;
    order: number;
  };

  const fields: Field[] = [];

  // Heuristics:
  // - Section lines like: "1 HULL CHECKS" or "2 Floor and Bench-Grinding Machines"
  // - Question lines like: "1.1 Do ..." possibly followed by choice words + REQUIRED
  const sectionRe = /^(\d+)\s+([A-Z].+)$/;
  const qRe = /^(\d+\.\d+)\s+(.+)$/;

  let order = 10;
  for (const line of lines) {
    const sec = sectionRe.exec(line);
    if (sec && !line.includes('.')) {
      const qnum = sec[1];
      const label = sec[2].trim();
      fields.push({
        qnum,
        label,
        field_type: 'section',
        required: false,
        choices: [],
        field_key: `sec_${qnum}_${slugKey(label)}`,
        order,
      });
      order += 10;
      continue;
    }

    const q = qRe.exec(line);
    if (q) {
      const qnum = q[1];
      // Strip trailing choice tokens and REQUIRED if the PDF dump included them
      const label = q[2]
        .replace(/\b(Fail\s+Pass|No\s+Yes\s+N\/?A)\b.*$/i, '')
        .replace(/\bREQUIRED\b.*$/i, '')
        .trim();

      if (!label) continue;

      fields.push({
        qnum,
        label,
        field_type: input.defaultFieldType,
        required: true,
        choices: input.defaultFieldType === 'button_choice' ? choices : [],
        field_key: `${slugKey(qnum)}_${slugKey(label)}`.slice(0, 60),
        order,
      });
      order += 10;
      continue;
    }
  }

  if (fields.length === 0) {
    throw new Error(
      'Importer: no fields detected. Paste the extracted PDF text (with lines like "1.1 Question...")'
    );
  }

  return { choices, fields };
}

async function requireAuth() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  return auth.user;
}

async function extractPdfText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  // pdf-parse is CJS-ish; dynamic import keeps Next/Vercel bundling happier.
  const mod = (await import('pdf-parse')) as unknown as { default: (b: Buffer) => Promise<{ text?: string }> };
  const parsed = await mod.default(buf);
  return String(parsed.text || '').trim();
}

export async function adminImportTemplate(formData: FormData): Promise<void> {
  await requireAuth();

  const code = String(formData.get('code') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const category = String(formData.get('category') || '').trim() || 'Inspection';
  const rawTextInput = String(formData.get('rawText') || '').trim();
  const pdf = formData.get('pdf') as File | null;
  const choiceSet = String(formData.get('choiceSet') || 'fail_pass') as ChoicePreset;
  const customChoices = String(formData.get('customChoices') || '').trim();

  if (!code) throw new Error('Missing template code');
  if (!title) throw new Error('Missing title');

  let rawText = rawTextInput;
  if (!rawText && pdf && typeof pdf.arrayBuffer === 'function' && pdf.size > 0) {
    rawText = await extractPdfText(pdf);
  }
  if (!rawText) throw new Error('Missing raw text (paste text or upload a PDF)');

  const defaultFieldType = String(
    formData.get('defaultFieldType') || 'button_choice'
  ).trim() as 'text' | 'button_choice';

  const parsed = parseTemplateText({
    rawText,
    defaultFieldType,
    choiceSet,
    customChoices,
  });

  const supabase = supabaseAdmin();

  // Upsert template
  const { data: tpl, error: tplErr } = await supabase
    .from('form_templates')
    .upsert(
      {
        code,
        title,
        category,
        active: true,
      },
      { onConflict: 'code' }
    )
    .select('id')
    .single();
  if (tplErr) throw tplErr;

  const templateId = tpl.id as string;

  // Replace fields
  const { error: delErr } = await supabase
    .from('form_fields')
    .delete()
    .eq('template_id', templateId);
  if (delErr) throw delErr;

  const rows = parsed.fields.map((f) => ({
    template_id: templateId,
    order: f.order,
    qnum: f.qnum,
    label: f.label,
    field_key: f.field_key,
    field_type: f.field_type,
    required: f.required,
    choices: f.choices,
  }));

  const { error: insErr } = await supabase.from('form_fields').insert(rows);
  if (insErr) throw insErr;

  redirect(
    `/admin/import?ok=1&code=${encodeURIComponent(code)}&fields=${rows.length}`
  );
}
