import { NextResponse } from 'next/server';
import { generateFrm006707ForYear } from '@/lib/generateFrm006702';

export async function GET(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  const ok = Boolean(cronHeader) || (secret && auth === `Bearer ${secret}`);
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const year = Number(
      new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' })
    );
    const res = await generateFrm006707ForYear(year);
    return NextResponse.json({ ok: true, result: res });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
