// Readable payload leaves shared by the staging UI and persistent projection.
export function searchContent(value, path = '$', depth = 0, message = false) {
  if (depth > 40)
    throw new Error(
      'Captured content exceeds the search nesting limit (40 levels).'
    );
  if (typeof value === 'string') {
    let decoded;
    try {
      decoded = JSON.parse(value);
    } catch {
      return [{ text: value, path }];
    }
    return searchContent(decoded, path, depth + 1, message);
  }
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      searchContent(item, `${path}[${index}]`, depth + 1, message)
    );
  if (value && typeof value === 'object') {
    const envelope =
      message &&
      ((typeof value.role === 'string' &&
        ('content' in value || 'parts' in value)) ||
        ['text', 'reasoning', 'tool-call', 'tool-result'].includes(value.type));
    return Object.entries(value)
      .filter(([key]) => !envelope || !['role', 'type'].includes(key))
      .flatMap(([key, item]) =>
        searchContent(
          item,
          `${path}[${JSON.stringify(key)}]`,
          depth + 1,
          message
        )
      );
  }
  return value == null ? [] : [{ text: String(value), path }];
}
