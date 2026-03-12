import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
  if (!auth.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json()) as Partial<{
    vessel_id: string;
    template_id: string;
    recorded_date: string;
  }>;

  if (!body.vessel_id || !body.template_id || !body.recorded_date) {
    return NextResponse.json(
      { ok: false, error: 'Missing vessel_id/template_id/recorded_date' },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id,recorded_date,due_slot,status,due_type')
    .eq('vessel_id', body.vessel_id)
    .eq('template_id', body.template_id)
    .eq('recorded_date', body.recorded_date)
    .in('due_slot', ['2359', '2358'])
    .order('due_slot', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tasks: tasks ?? [] });
}
