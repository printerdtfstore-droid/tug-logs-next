import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const supabase = supabaseAdmin();

    const { data: vessels, error } = await supabase
      .from('vessels')
      .select('id,name,active,created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const keepIds = new Set<string>();
    const deleteIds: string[] = [];

    const seen = new Set<string>();
    for (const v of vessels ?? []) {
      const key = (v.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        keepIds.add(v.id);
      } else {
        deleteIds.push(v.id);
      }
    }

    if (deleteIds.length > 0) {
      const { error: delErr } = await supabase.from('vessels').delete().in('id', deleteIds);
      if (delErr) throw delErr;
    }

    return NextResponse.json({ ok: true, deleted: deleteIds.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
