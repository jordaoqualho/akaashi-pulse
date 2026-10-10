/**
 * Agents and IDE integrations prepend machine context to the user's prompt
 * (`<browser_instruction>…</browser_instruction>`, `<ide_selection>…`, Codex's
 * "# Context from my IDE setup: … ## My request for Codex:"). These helpers
 * recover what the person actually typed.
 *
 * Only wrapper tags whose name contains `_` or `-` are treated as injected
 * context, so prompts that quote real HTML such as `<div>` stay intact.
 */
const CODEX_REQUEST_MARKER = /##\s*My request for [^:\n]+:\s*/i;
const IDE_CONTEXT_PREFIX = /^#\s*Context from my IDE setup:/i;
const INJECTED_TAG = '[a-z][a-z0-9]*[_-][a-z0-9_-]*';
const CLOSED_BLOCK = new RegExp(`<(${INJECTED_TAG})(?:\\s[^>]*)?>[\\s\\S]*?</\\1>`, 'gi');
const OPEN_BLOCK = new RegExp(`<(${INJECTED_TAG})(?:\\s[^>]*)?>[\\s\\S]*$`, 'i');

/** Remove injected context blocks; returns '' when nothing human-written remains. */
export function stripInjectedContext(text: string): string {
  let out = text;
  const codexRequest = CODEX_REQUEST_MARKER.exec(out);
  if (codexRequest) out = out.slice(codexRequest.index + codexRequest[0].length);
  else if (IDE_CONTEXT_PREFIX.test(out.trimStart())) return '';
  // Closed blocks first, then a block left open (e.g. cut off by a preview limit).
  return out.replace(CLOSED_BLOCK, ' ').replace(OPEN_BLOCK, ' ').trim();
}

/**
 * Preview text for a user prompt: the human-written part when there is one,
 * otherwise the raw text, so a record never loses its preview entirely.
 */
export function promptPreview(text: string, maxLength: number): string {
  const cleaned = stripInjectedContext(text);
  return (cleaned || text).slice(0, maxLength);
}

/** Single-line session title, or undefined when only injected context remains. */
export function cleanSessionTitle(text: string | undefined, maxLength = 80): string | undefined {
  if (!text) return undefined;
  const out = stripInjectedContext(text).replace(/\s+/g, ' ').trim();
  if (!out) return undefined;
  return out.length > maxLength ? `${out.slice(0, maxLength - 1).trimEnd()}…` : out;
}
