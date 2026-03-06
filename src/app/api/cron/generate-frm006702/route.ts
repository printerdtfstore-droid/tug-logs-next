import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function centralYMD(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
}

function requireCronAuth(req: Request) {
  // Vercel Cron requests include this header.
  if (req.headers.get('x-vercel-cron')) return;

  const secret = process.env.CRON_SECRET;
  if (!secret) return; // allow if not set (dev)
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    throw new Error('Unauthorized');
  }
}

export async function GET(req: Request) {
  try {
    requireCronAuth(req);
    const supabase = supabaseAdmin();

    const date = centralYMD();

    const { data: tpl, error: tplErr } = await supabase
      .from('form_templates')
      .select('id')
      .eq('code', 'FRM006702')
      .single();
    if (tplErr) throw tplErr;

    const { data: vessels, error: vErr } = await supabase
      .from('vessels')
      .select('id,name')
      .in('name', ['Capt Russell L', 'Amazing Grace'])
      .eq('active', true);
    if (vErr) throw vErr;

    // Required field count
    const { count: reqCount, error: rcErr } = await supabase
      .from('form_fields')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', tpl.id)
      .eq('required', true);
    if (rcErr) throw rcErr;

    const dueSlots: Array<{ slot: string; hour: number }> = [
      { slot: '0600', hour: 6 },
      { slot: '1200', hour: 12 },
    ];

    const rows = (vessels ?? []).flatMap((v) =>
      dueSlots.map((s) => ({
        vessel_id: v.id,
        template_id: tpl.id,
        status: 'Open',
        due_type: 'Scheduled',
        recorded_date: date,
        due_slot: s.slot,
        // MVP: fixed -06 offset. We'll refine DST later.
        due_at: `${date}T${String(s.hour).padStart(2, '0')}:00:00-06:00`,
        is_backfilled: false,
        week_start_date: null,
        required_count: reqCount ?? 0,
        answered_count: 0,
      }))
    );

    const { error: insErr } = await supabase
      .from('tasks')
      .upsert(rows, {
        onConflict: 'vessel_id,template_id,recorded_date,due_slot',
        ignoreDuplicates: true,
      });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true, date, createdOrExists: rows.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
