// Shared browser/backend search syntax. Keep this module free of platform APIs.
const fields = new Set([
  'agent',
  'tool',
  'tool.status',
  'has',
  'input',
  'output',
  'context',
  'reply',
  'error',
  'trace',
  'session',
  'duration',
]);
const lower = (value) => String(value ?? '').toLowerCase();

export function parseTraceQuery(query) {
  if (typeof query !== 'string' || query.length > 2000 || query.includes('\0'))
    return {
      tokens: [],
      error: 'Search must be a string of at most 2000 characters.',
    };
  const tokens = [];
  let index = 0;
  while (index < query.length) {
    if (/\s/u.test(query[index])) {
      index++;
      continue;
    }
    const start = index;
    let value = '',
      quoted = false,
      colon = -1;
    while (index < query.length && (quoted || !/\s/u.test(query[index]))) {
      const char = query[index++];
      if (char === '"') quoted = !quoted;
      else if (char === '\\' && /["\\]/u.test(query[index] ?? ''))
        value += query[index++];
      else {
        if (char === ':' && !quoted && colon < 0) colon = value.length;
        value += char;
      }
    }
    if (quoted)
      return { tokens, error: 'Close the quote to finish this search.' };
    const field = colon < 0 ? 'text' : value.slice(0, colon).toLowerCase();
    const term = colon < 0 ? value : value.slice(colon + 1);
    if (field !== 'text' && !fields.has(field))
      return {
        tokens,
        error: `Unknown field “${field}”. Try tool, agent, input, output, or duration.`,
      };
    if (!term.trim())
      return {
        tokens,
        error: `Add a value${field === 'text' ? '' : ` after ${field}:`}.`,
      };
    if ((field === 'tool.status' || field === 'has') && term !== 'error')
      return { tokens, error: `${field}: supports “error”.` };
    let comparison;
    if (field === 'duration') {
      const match = /^(>=|<=|>|<|=)?(\d+(?:\.\d+)?)(ms|s)$/u.exec(term);
      if (
        !match ||
        !Number.isFinite(Number(match[2]) * (match[3] === 's' ? 1000 : 1))
      )
        return {
          tokens,
          error: 'Use a duration such as duration:>3s or duration:>=500ms.',
        };
      comparison = {
        operator: match[1] ?? '=',
        ms: Number(match[2]) * (match[3] === 's' ? 1000 : 1),
      };
    }
    if (tokens.length >= 32)
      return { tokens, error: 'Use at most 32 search terms.' };
    tokens.push({
      field,
      value: term,
      start,
      end: index,
      raw: query.slice(start, index),
      comparison,
    });
  }
  return { tokens };
}

export function removeQueryToken(query, token) {
  return `${query.slice(0, token.start).trimEnd()} ${query.slice(token.end).trimStart()}`.trim();
}

export function matchExcerpt(match, length = 100) {
  const text = match.text.replace(/\s+/gu, ' ').trim();
  const term = match.term?.replace(/\s+/gu, ' ').trim() ?? '';
  const index = term ? lower(text).indexOf(lower(term)) : -1;
  const start = Math.max(0, index - 28);
  const end = Math.min(
    text.length,
    Math.max(start + length, index + term.length)
  );
  return {
    text: `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
    term,
  };
}
