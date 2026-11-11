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
    options.onCaughtUp();
  } };
  const replay = await Array.fromAsync(replayEvents(session, { cursor: parseCursor('4:0'), follow: false }));
  assert.deepEqual(replay.map(item => item.id), ['4:1', '7:0']);
  assert.equal(replay[0].event.meta.next, 7);
  assert.throws(() => parseCursor('-1:0'));
  assert.throws(() => parseCursor('99999999999999999999:0'));
});


test('finite replay rejects an early end, accepts an empty captured history, and permits cancellation', async () => {
  const partial = { async *stream() {
    yield { type: 'a', meta: { position: { line: 0, index: 0 } } };
  } };
  await assert.rejects(Array.fromAsync(replayEvents(partial, { follow: false })), /captured history tail/);
  const empty = { async *stream(options) { options.onCaughtUp(); } };
  assert.deepEqual(await Array.fromAsync(replayEvents(empty, { follow: false })), []);
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await Array.fromAsync(replayEvents({ async *stream() {} }, {
    follow: false, signal: controller.signal,
  })), []);
});

test('installed Eve client detects incomplete finite replay on EOF and socket loss', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
}, async t => {
  const { createServer } = await import('node:http');
  const { once } = await import('node:events');
  const { resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const { Client } = await import(pathToFileURL(resolve(process.env.EVEN_TEST_NODE_MODULES, 'eve/dist/src/client/index.js')).href);
  let disconnect = false;
  const upstream = createServer((_request, response) => {
    response.writeHead(200, {
      'x-eve-stream-version': '27', 'x-eve-stream-tail-index': '5',
      'content-type': 'application/x-ndjson',
    });
    response.write(JSON.stringify({ at: '2026-01-01T00:00:00Z', facts: [
      { type: 'delivery.settled', data: { deliveryId: 'example' } },
    ] }) + '\n');
    if (disconnect) setImmediate(() => response.destroy());
    else response.end();
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const client = new Client({ baseUrl: 'http://127.0.0.1:' + upstream.address().port });
  for (const loseSocket of [false, true]) {
    disconnect = loseSocket;
    await assert.rejects(Array.fromAsync(replayEvents(client.sessions.attach('example'), {
      follow: false,
    })), /captured history tail/);
  }
});
