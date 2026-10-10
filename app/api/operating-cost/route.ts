import { NextResponse } from 'next/server';
import {
  getOperatingCostConfig,
  setOperatingCostConfig,
  type OperatingCostBasis,
  type OperatingCostConfig,
  type OperatingCostCurrency,
} from '@/lib/data-sources/config';
import { isProviderId } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getOperatingCostConfig());
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      month?: unknown;
      basis?: unknown;
      currency?: unknown;
      plans?: unknown;
    };
    const plans: OperatingCostConfig['plans'] = {};
    if (body.plans && typeof body.plans === 'object') {
      for (const [source, rawPlan] of Object.entries(body.plans)) {
        if (!isProviderId(source) || !rawPlan || typeof rawPlan !== 'object') continue;
        const plan = rawPlan as { monthlyCost?: unknown; enabled?: unknown; planId?: unknown };
        const monthlyCost = Number(plan.monthlyCost);
        plans[source] = {
          monthlyCost: Number.isFinite(monthlyCost) ? Math.max(0, monthlyCost) : 0,
          enabled: plan.enabled !== false,
          ...(typeof plan.planId === 'string' && plan.planId.length > 0 ? { planId: plan.planId } : {}),
        };
      }
    }
    const config = await setOperatingCostConfig({
      month: typeof body.month === 'string' ? body.month : undefined,
      basis: isBasis(body.basis) ? body.basis : undefined,
      currency: isCurrency(body.currency) ? body.currency : undefined,
      plans,
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save operating cost settings.' },
      { status: 400 },
    );
  }
}

function isCurrency(value: unknown): value is OperatingCostCurrency {
  return value === 'USD' || value === 'BRL' || value === 'EUR';
}

function isBasis(value: unknown): value is OperatingCostBasis {
  return value === 'estimated-cost' || value === 'tokens' || value === 'requests' || value === 'tracked-time';
}
