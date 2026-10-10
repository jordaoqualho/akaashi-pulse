import type { ProviderId } from '@/lib/providers/types';

export interface OperatingCostPlanPreset {
  id: string;
  label: string;
  monthlyCost: number | null;
  currency: 'USD';
  note: string;
  sourceUrl: string;
}

/**
 * Public subscription snapshot used by the local cost ledger. Keep this as a
 * small, reviewable data file: provider prices change, and the source link is
 * shown in the UI so the user can verify regional taxes and billing terms.
 */
export const OPERATING_COST_PRICE_SNAPSHOT = '2026-10-10';

const CLAUDE_PRICING_URL = 'https://claude.com/pricing';
const OPENAI_PRICING_URL = 'https://openai.com/chatgpt/pricing';
const OPENAI_PRO_URL = 'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers';
const CURSOR_PRICING_URL = 'https://cursor.com/pricing';
const ANTIGRAVITY_PRICING_URL = 'https://www.antigravity.google/pricing';
const GOOGLE_AI_PRICING_URL = 'https://one.google.com/about/plans';

const PLAN_CATALOG: Record<ProviderId, OperatingCostPlanPreset[]> = {
  claude: [
    { id: 'claude-free', label: 'Free', monthlyCost: 0, currency: 'USD', note: 'Limited usage', sourceUrl: CLAUDE_PRICING_URL },
    { id: 'claude-pro', label: 'Pro', monthlyCost: 20, currency: 'USD', note: 'Individual plan', sourceUrl: CLAUDE_PRICING_URL },
    { id: 'claude-max-5x', label: 'Max 5x', monthlyCost: 100, currency: 'USD', note: '5x Pro usage', sourceUrl: CLAUDE_PRICING_URL },
    { id: 'claude-max-20x', label: 'Max 20x', monthlyCost: 200, currency: 'USD', note: '20x Pro usage', sourceUrl: CLAUDE_PRICING_URL },
  ],
  codex: [
    { id: 'codex-free', label: 'ChatGPT Free', monthlyCost: 0, currency: 'USD', note: 'Codex access varies by account', sourceUrl: OPENAI_PRICING_URL },
    { id: 'codex-plus', label: 'ChatGPT Plus', monthlyCost: 20, currency: 'USD', note: 'Codex included', sourceUrl: OPENAI_PRICING_URL },
    { id: 'codex-pro-100', label: 'ChatGPT Pro 100', monthlyCost: 100, currency: 'USD', note: 'Higher Codex allowance', sourceUrl: OPENAI_PRO_URL },
    { id: 'codex-pro-200', label: 'ChatGPT Pro 200', monthlyCost: 200, currency: 'USD', note: 'Higher Codex allowance', sourceUrl: OPENAI_PRO_URL },
    { id: 'codex-pro-500', label: 'ChatGPT Pro 500', monthlyCost: 500, currency: 'USD', note: 'Highest Pro tier', sourceUrl: OPENAI_PRO_URL },
    { id: 'codex-business-monthly', label: 'ChatGPT Business', monthlyCost: 30, currency: 'USD', note: 'Per user, billed monthly', sourceUrl: OPENAI_PRICING_URL },
  ],
  cursor: [
    { id: 'cursor-hobby', label: 'Hobby', monthlyCost: 0, currency: 'USD', note: 'Free plan', sourceUrl: CURSOR_PRICING_URL },
    { id: 'cursor-pro', label: 'Pro', monthlyCost: 20, currency: 'USD', note: 'Individual plan', sourceUrl: CURSOR_PRICING_URL },
    { id: 'cursor-pro-plus', label: 'Pro+', monthlyCost: 60, currency: 'USD', note: '3x Pro limits', sourceUrl: CURSOR_PRICING_URL },
    { id: 'cursor-ultra', label: 'Ultra', monthlyCost: 200, currency: 'USD', note: '20x Pro limits', sourceUrl: CURSOR_PRICING_URL },
    { id: 'cursor-teams-standard', label: 'Teams Standard', monthlyCost: 40, currency: 'USD', note: 'Per user / month', sourceUrl: CURSOR_PRICING_URL },
    { id: 'cursor-teams-premium', label: 'Teams Premium', monthlyCost: 120, currency: 'USD', note: 'Per user / month', sourceUrl: CURSOR_PRICING_URL },
  ],
  antigravity: [
    { id: 'antigravity-individual', label: 'Individual', monthlyCost: 0, currency: 'USD', note: 'Free plan', sourceUrl: ANTIGRAVITY_PRICING_URL },
    { id: 'antigravity-google-ai-pro', label: 'Google AI Pro', monthlyCost: 19.99, currency: 'USD', note: 'Expanded Antigravity limits', sourceUrl: GOOGLE_AI_PRICING_URL },
    { id: 'antigravity-google-ai-ultra', label: 'Google AI Ultra', monthlyCost: null, currency: 'USD', note: 'Price varies by region and current offer', sourceUrl: GOOGLE_AI_PRICING_URL },
  ],
};

export function getOperatingCostPlanPresets(source: ProviderId): OperatingCostPlanPreset[] {
  return PLAN_CATALOG[source];
}

export function getOperatingCostPlanPreset(source: ProviderId, id: string | undefined): OperatingCostPlanPreset | undefined {
  return getOperatingCostPlanPresets(source).find((preset) => preset.id === id);
}
