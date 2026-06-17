/**
 * Util to extract combined advanced search filters from plain text input.
 * Filter prefixes are always in English (from:, in:, has:, mentions:).
 *
 * e.g. "connection error from:tulatu8573 has:image" 
 *   => { q: "connection error", from: "tulatu8573", has: "image" }
 */
export interface ParsedFilters {
  q?: string;
  from?: string;
  channel?: string;
  has?: string;
  mentions?: string;
}

export function parseSearchFilters(input: string): ParsedFilters {
  const filters: ParsedFilters = {};
  if (!input.trim()) return filters;

  const regex = /(?:from|in|has|mentions)\s*:\s*([^\s:]+)/gi;

  let remaining = input;
  let match: RegExpExecArray | null;

  const matchesToProcess: { full: string; prefix: string; value: string }[] = [];

  regex.lastIndex = 0;
  while ((match = regex.exec(input)) !== null) {
    const fullMatch = match[0];
    const value = match[1];
    const colonIndex = fullMatch.indexOf(":");
    const prefix = fullMatch.slice(0, colonIndex).trim().toLowerCase();

    matchesToProcess.push({ full: fullMatch, prefix, value });
  }

  for (const item of matchesToProcess) {
    remaining = remaining.replace(item.full, "");

    if (item.prefix === "from") {
      filters.from = item.value;
    } else if (item.prefix === "in") {
      filters.channel = item.value;
    } else if (item.prefix === "has") {
      filters.has = item.value;
    } else if (item.prefix === "mentions") {
      filters.mentions = item.value;
    }
  }

  const qCleaned = remaining.replace(/\s+/g, " ").trim();
  if (qCleaned) {
    filters.q = qCleaned;
  }

  return filters;
}

