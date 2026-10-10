import { NextResponse } from 'next/server';
import { getLocalServiceSnapshot, stopLocalService } from '@/lib/local-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getLocalServiceSnapshot(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action !== 'stop') {
      return NextResponse.json({ error: 'Unsupported service action.' }, { status: 400 });
    }

    const snapshot = await getLocalServiceSnapshot();
    if (!snapshot.canStop) {
      return NextResponse.json({ ok: true, stopped: false, snapshot });
    }

    // LaunchAgent/systemd owns the process that serves this request. Delay the
    // teardown so the browser receives a successful response first.
    if (snapshot.service.running) {
      setTimeout(() => { void stopLocalService(); }, 150);
      return NextResponse.json({ ok: true, stopping: true });
    }

    await stopLocalService();
    return NextResponse.json({ ok: true, stopped: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not stop the local service.' },
      { status: 500 },
    );
  }
}
