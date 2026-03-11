import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function stripJesusSaves(title: string) {
  return title.replace(/\s*-?\s*JESUS SAVES\s*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

export async function POST() {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
  if (!auth.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const admin = supabaseAdmin();

  const { data: templates, error } = await admin
    .from('form_templates')
    .select('id,code,title,category')
    .eq('active', true)
    .eq('category', 'Engine Logs')
    .ilike('title', '%JESUS SAVES%')
    .limit(500);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let updated = 0;
  const changed: Array<{ code: string; before: string; after: string }> = [];

  for (const t of templates ?? []) {
    const before = String(t.title ?? '');
    const after = stripJesusSaves(before);
    if (after && after !== before) {
      const { error: uErr } = await admin
        .from('form_templates')
        .update({ title: after })
        .eq('id', t.id);
      if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
      updated += 1;
      changed.push({ code: String(t.code ?? ''), before, after });
    }
  }

  return NextResponse.json({ ok: true, updated, changed });
}
