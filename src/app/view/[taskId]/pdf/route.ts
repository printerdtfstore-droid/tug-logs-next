import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await supabaseServer();

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select(
      'id,recorded_date,template_id,vessel_id, form_templates(code,title), vessels(name)'
    )
    .eq('id', taskId)
    .single();
  if (taskErr) {
    return NextResponse.json({ error: taskErr.message }, { status: 500 });
  }

  const { data: submission } = await supabase
    .from('form_submissions')
    .select('id,submitted_at')
    .eq('task_id', taskId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const submissionId = submission?.id;

  const { data: fields, error: fieldsErr } = await supabase
    .from('form_fields')
    .select('id,qnum,label,field_type,order')
    .eq('template_id', task.template_id)
    .order('order', { ascending: true });
  if (fieldsErr) {
    return NextResponse.json({ error: fieldsErr.message }, { status: 500 });
  }

  type Answer = {
    field_id: string;
    value_text: string | null;
    value_option_text: string | null;
    value_time_text: string | null;
    value_time_text_a: string | null;
    value_time_text_b: string | null;
  };

  let answers: Answer[] = [];
  if (submissionId) {
    const { data: ans } = await supabase
      .from('form_answers')
      .select(
        'field_id,value_text,value_option_text,value_time_text,value_time_text_a,value_time_text_b'
      )
      .eq('submission_id', submissionId);
    answers = ans ?? [];
  }

  const byFieldId = new Map<string, Answer>();
  for (const a of answers) byFieldId.set(a.field_id, a);

  const tpl = (task as unknown as { form_templates?: { code?: string; title?: string } })
    .form_templates;
  const vessel = (task as unknown as { vessels?: { name?: string } }).vessels;

  function formatValue(fieldType: string, a: Answer | undefined) {
    if (!a) return '';
    if (fieldType === 'button_choice') return a.value_option_text ?? '';
    if (fieldType === 'time') return a.value_time_text ?? '';
    if (fieldType === 'time_range') {
      const a1 = a.value_time_text_a ?? '';
      const b1 = a.value_time_text_b ?? '';
      return a1 && b1 ? `${a1}-${b1}` : a1 || b1;
    }
    return a.value_text ?? '';
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 760;
  const left = 40;

  const title = `${tpl?.code ?? ''} ${tpl?.title ?? ''}`.trim() || 'Tug Logs Form';

  page.drawText(title, { x: left, y, size: 16, font: fontBold });
  y -= 22;

  page.drawText(`Vessel: ${vessel?.name ?? task.vessel_id}`, {
    x: left,
    y,
    size: 10,
    font,
  });
  y -= 14;
  page.drawText(`Recorded: ${task.recorded_date}`, { x: left, y, size: 10, font });
  y -= 20;

  // Header row
  page.drawText('Number', { x: left, y, size: 10, font: fontBold });
  page.drawText('Item', { x: left + 70, y, size: 10, font: fontBold });
  page.drawText('Value', { x: 460, y, size: 10, font: fontBold });
  y -= 12;

  const wrap = (text: string, maxChars: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  for (const f of fields ?? []) {
    const a = byFieldId.get(f.id);
    const val = formatValue(f.field_type, a);

    const itemLines = wrap(f.label ?? '', 70);
    const valueLines = wrap(val ?? '', 18);
    const rowLines = Math.max(itemLines.length, valueLines.length, 1);

    // NOTE: MVP: no pagination yet. Keep forms short enough to fit one page.

    // Draw number once
    page.drawText(f.qnum ?? '', { x: left, y, size: 9, font: fontBold });

    for (let i = 0; i < rowLines; i++) {
      const iy = y - i * 12;
      if (i < itemLines.length) {
        page.drawText(itemLines[i], { x: left + 70, y: iy, size: 9, font });
      }
      if (i < valueLines.length) {
        page.drawText(valueLines[i], { x: 460, y: iy, size: 9, font });
      }
    }

    y -= rowLines * 12 + 6;
  }

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tug-logs-${tpl?.code ?? 'form'}-${task.recorded_date}.pdf"`,
    },
  });
}
