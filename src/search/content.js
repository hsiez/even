// Readable payload leaves shared by the staging UI and persistent projection.
export function searchContent(value, path = '$', depth = 0, message = false) {
  // Attributes may serialize a container or string once. After that boundary,
  // string leaves are recorded content, even when they also look like JSON.
  if (typeof value === 'string') {
    try {
      const decoded = JSON.parse(value);
      if (
        typeof decoded === 'string' ||
        (decoded && typeof decoded === 'object')
      )
        value = decoded;
    } catch {
      // Plain text and malformed JSON remain searchable verbatim.
    }
  }
  return contentLeaves(value, path, depth, message);
}

function contentLeaves(value, path, depth, message) {
  if (depth > 40)
    throw new Error(
      'Captured content exceeds the search nesting limit (40 levels).'
    );
  if (typeof value === 'string') {
    return [{ text: value, path }];
  }
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      contentLeaves(item, `${path}[${index}]`, depth + 1, message)
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
        contentLeaves(
          item,
          `${path}[${JSON.stringify(key)}]`,
          depth + 1,
          message
        )
      );
  }
  return value == null ? [] : [{ text: String(value), path }];
}
