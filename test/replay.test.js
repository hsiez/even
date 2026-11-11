import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCursor, replayEvents } from '../src/sessions.js';

test('replay resumes inside a durable line without losing later facts', async () => {
  const events = [
    { type: 'a', meta: { position: { line: 4, index: 0 } } },
    { type: 'b', meta: { position: { line: 4, index: 1 }, endOfLine: true, next: 7 } },
    { type: 'c', meta: { position: { line: 7, index: 0 } } },
  ];
  const session = { async *stream(options) {
    assert.equal(options.startIndex, 4);
    assert.equal(options.follow, false);
    yield* events;
  } };
  const replay = await Array.fromAsync(replayEvents(session, { cursor: parseCursor('4:0'), follow: false }));
  assert.deepEqual(replay.map(item => item.id), ['4:1', '7:0']);
  assert.equal(replay[0].event.meta.next, 7);
  assert.throws(() => parseCursor('-1:0'));
  assert.throws(() => parseCursor('99999999999999999999:0'));
});
