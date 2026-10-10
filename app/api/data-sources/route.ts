import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import {
  addConfiguredSourceDir,
  getConfiguredSourceDirs,
  removeConfiguredSourceDir,
  type ConfigurableSource,
} from '@/lib/data-sources/config';
import { isProviderId } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    claude: getConfiguredSourceDirs('claude'),
    codex: getConfiguredSourceDirs('codex'),
    cursor: getConfiguredSourceDirs('cursor'),
    antigravity: getConfiguredSourceDirs('antigravity'),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      action?: 'add' | 'remove';
      source?: ConfigurableSource;
      directory?: string;
    };
    if (!isProviderId(body.source) || (body.action !== 'add' && body.action !== 'remove') || typeof body.directory !== 'string') {
      return NextResponse.json({ error: 'Invalid source directory request.' }, { status: 400 });
    }

    if (body.action === 'add') {
      const candidate = body.directory.trim().replace(/^~(?=\/|$)/, process.env.HOME ?? '~');
      const stat = await fs.stat(candidate).catch(() => null);
      if (!stat?.isDirectory()) {
        return NextResponse.json({ error: 'Choose an existing directory.' }, { status: 400 });
      }
    }

    const directories = body.action === 'add'
      ? await addConfiguredSourceDir(body.source, body.directory)
      : await removeConfiguredSourceDir(body.source, body.directory);

    // Rebuild the shared index so the selected path is immediately reflected
    // in the dashboard and its file watcher set.
    await getCachedScan({ force: true });
    return NextResponse.json({ ok: true, source: body.source, directories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update source directories.' },
      { status: 400 },
    );
  }
}
