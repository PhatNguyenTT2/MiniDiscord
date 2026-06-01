/**
 * Util to extract combined advanced search filters from plain text input.
 * Handles Vietnamese and English prefixes seamlessly.
 *
 * e.g. "lỗi kết nối từ: tulatu8573 có: hình ảnh" 
 *   => { q: "lỗi kết nối", from: "tulatu8573", has: "hình ảnh" }
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

  // Pattern: (prefix): (value) matching till next whitespace or boundary
  // Multi-prefix matches: từ, from, trong, in, có, has, đề cập, mentions
  const regex = /(?:từ|from|trong|in|có|has|đề cập|mentions)\s*:\s*([^\s:]+)/gi;

  let remaining = input;
  let match: RegExpExecArray | null;

  // We copy the string to iterate safely over matches
  const matchesToProcess: { full: string; prefix: string; value: string }[] = [];

  // Reset regex index
  regex.lastIndex = 0;
  while ((match = regex.exec(input)) !== null) {
    const fullMatch = match[0];
    const value = match[1];
    const colonIndex = fullMatch.indexOf(":");
    const prefix = fullMatch.slice(0, colonIndex).trim().toLowerCase();

    matchesToProcess.push({ full: fullMatch, prefix, value });
  }

  // Deduct extracted filter segments from plain query string
  for (const item of matchesToProcess) {
    remaining = remaining.replace(item.full, "");

    if (["từ", "from"].includes(item.prefix)) {
      filters.from = item.value;
    } else if (["trong", "in"].includes(item.prefix)) {
      filters.channel = item.value;
    } else if (["có", "has"].includes(item.prefix)) {
      filters.has = item.value;
    } else if (["đề cập", "mentions"].includes(item.prefix)) {
      filters.mentions = item.value;
    }
  }

  // Clean trailing spaces and use leftovers as text query parameter "q"
  const qCleaned = remaining.replace(/\s+/g, " ").trim();
  if (qCleaned) {
    filters.q = qCleaned;
  }

  return filters;
}
