import test from 'node:test';
import assert from 'node:assert/strict';
import { searchContent } from '../src/search/content.js';

test('decodes one payload boundary and preserves literal string leaves', () => {
  const values = [
    'null',
    '1234567890123456789',
    '1e3',
    '-0',
    '"quoted"',
    '{"nested":"value"}',
  ];
  for (const value of values) {
    assert.deepEqual(searchContent(JSON.stringify({ content: value })), [
      { text: value, path: '$["content"]' },
    ]);
    assert.deepEqual(searchContent(JSON.stringify(value)), [
      { text: value, path: '$' },
    ]);
    assert.deepEqual(searchContent({ content: value }), [
      { text: value, path: '$["content"]' },
    ]);
  }
  for (const value of ['null', '1234567890123456789', '1e3', '-0', 'not JSON'])
    assert.deepEqual(searchContent(value), [{ text: value, path: '$' }]);
});

test('preserves message content, leaf boundaries and the nesting bound', () => {
  assert.deepEqual(
    searchContent(
      JSON.stringify([
        { role: 'assistant', content: [{ type: 'text', text: 'null' }] },
      ]),
      '$',
      0,
      true
    ),
    [{ text: 'null', path: '$[0]["content"][0]["text"]' }]
  );
  assert.deepEqual(
    searchContent(
      JSON.stringify({ first: 'one', second: 'two', absent: null })
    ),
    [
      { text: 'one', path: '$["first"]' },
      { text: 'two', path: '$["second"]' },
    ]
  );
  let deep = 'value';
  for (let i = 0; i < 42; i++) deep = [deep];
  assert.throws(() => searchContent(JSON.stringify(deep)), /nesting limit/);
});
