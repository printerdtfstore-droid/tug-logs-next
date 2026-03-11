import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { generatePrefilledDrafts, type BackfillCadence } from '@/app/admin/backfill/actions';

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
  if (!auth.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const obj = (body ?? {}) as Record<string, unknown>;

  const vessel_id = String(obj.vessel_id ?? '');
  const template_id = String(obj.template_id ?? '');
  const start_date = String(obj.start_date ?? '');
  const end_date = String(obj.end_date ?? '');
  const source_task_id = String(obj.source_task_id ?? '');
  const cadenceRaw = String(obj.cadence ?? 'daily');
  const cadence: BackfillCadence =
    cadenceRaw === 'weekly' || cadenceRaw === 'monthly' ? cadenceRaw : 'daily';
  const auto_submit = Boolean(obj.auto_submit);

  if (!vessel_id || !template_id || !start_date || !end_date || !source_task_id) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const res = await generatePrefilledDrafts({
      vessel_id,
      template_id,
      start_date,
      end_date,
      source_task_id,
      cadence,
      auto_submit,
    });
    return NextResponse.json(res);
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
