import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  expandUserPath,
  getConfiguredProjectRoots,
  setConfiguredProjectRoots,
} from '@/lib/data-sources/config';
import { getProjectRoots, projectScopeIsAutomatic, resetProjectScopeCache } from '@/lib/project-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProjectScopeAction = 'add' | 'remove' | 'auto' | 'all';

function response() {
  return {
    roots: getProjectRoots(),
    automatic: projectScopeIsAutomatic(),
  };
}

function normalizeRoot(value: string): string | null {
  const expanded = expandUserPath(value);
  if (!expanded || !path.isAbsolute(expanded)) return null;
  return path.normalize(expanded);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(response());
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      action?: ProjectScopeAction;
      root?: string;
    };

    if (!body.action || !['add', 'remove', 'auto', 'all'].includes(body.action)) {
      return NextResponse.json({ error: 'Invalid project scope request.' }, { status: 400 });
    }

    if (body.action === 'auto') {
      await setConfiguredProjectRoots(undefined);
    } else if (body.action === 'all') {
      await setConfiguredProjectRoots([]);
    } else {
      if (typeof body.root !== 'string') {
        return NextResponse.json({ error: 'A project root is required.' }, { status: 400 });
      }
      const root = normalizeRoot(body.root);
      if (!root) {
        return NextResponse.json({ error: 'Choose an absolute local directory.' }, { status: 400 });
      }

      const configured = getConfiguredProjectRoots();
      const current = configured ?? getProjectRoots();
      const next = body.action === 'add'
        ? Array.from(new Set([...current, root]))
        : current.filter((value) => path.normalize(value) !== root);

      if (body.action === 'add') {
        const stat = await fs.stat(root).catch(() => null);
        if (!stat?.isDirectory()) {
          return NextResponse.json({ error: 'Choose an existing local directory.' }, { status: 400 });
        }
      }
      await setConfiguredProjectRoots(next);
    }

    resetProjectScopeCache();
    return NextResponse.json({ ok: true, ...response() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update project scope.' },
      { status: 400 },
    );
  }
}
