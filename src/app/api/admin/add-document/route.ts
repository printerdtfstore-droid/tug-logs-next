import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 });
  if (!auth.user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json()) as {
    title: string;
    file_path: string;
    template_code?: string | null;
  };

  if (!body?.title || !body?.file_path) {
    return NextResponse.json({ ok: false, error: 'Missing title/file_path' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Dedupe by file_path (idempotent)
  const { data: existing, error: eErr } = await admin
    .from('documents')
    .select('id')
    .eq('file_path', body.file_path)
    .limit(1)
    .maybeSingle();
  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  if (existing?.id) {
    return NextResponse.json({ ok: true, id: existing.id, alreadyExisted: true });
  }

  const { data, error } = await admin
    .from('documents')
    .insert({
      title: body.title,
      file_path: body.file_path,
      template_code: body.template_code ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, alreadyExisted: false });
}
