import { NextResponse } from 'next/server';
import { generateFrm006703Tasks } from '@/lib/generateFrm006702';

function centralYMD(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export async function GET(req: Request) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  const ok = Boolean(cronHeader) || (secret && auth === `Bearer ${secret}`);
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const today = centralYMD();
    const res = await generateFrm006703Tasks({ startDate: today, endDate: today });
    return NextResponse.json({ ok: true, today, result: res });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
