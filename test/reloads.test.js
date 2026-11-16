import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createReloadMonitor } from '../src/reloads.js';

function fixture() {
  const revisions = new Map([['/a', 'first'], ['/b', 'other']]);
  const addresses = new Map([['/a', 'http://127.0.0.1:1234/a'], ['/b', 'http://127.0.0.1:1234/b']]);
  const reads = [];
  return {
    revisions, addresses, reads,
    adapter: {
      selectAgent(id) {
        if (!['a', 'b'].includes(id)) throw Object.assign(new Error('Unknown agent'), { status: 400 });
        return { id, appRoot: '/' + id };
      },
      async internal(path) {
        if (path.endsWith('dev-server-state.js')) return {
          DevelopmentServerState: class {
            constructor({ appRoot }) { this.root = appRoot; }
            async read() { return addresses.get(this.root); }
          },
        };
        assert.ok(path.endsWith('runtime-artifacts.js'));
        return { async readDevelopmentRuntimeArtifactsRevision({ serverUrl }) {
          reads.push(serverUrl);
          await delay(2);
          return revisions.get(new URL(serverUrl).pathname);
        } };
      },
    },
  };
}

test('reload observation establishes a baseline and deduplicates concurrent polls, without exposing revisions', async t => {
  const f = fixture();
  const monitor = createReloadMonitor(f.adapter);
  t.after(() => monitor.close());
  const initial = await monitor.list('a');
  assert.deepEqual(initial.reloads, []);
  assert.equal(initial.available, true);
  assert.ok(Date.parse(initial.observingSince));
  f.revisions.set('/a', 'second');
  const [one, two] = await Promise.all([monitor.list('a'), monitor.list('a')]);
  assert.equal(one.reloads.length, 1);
  assert.deepEqual(two, one);
  assert.equal(one.reloads[0].type, 'agent.reloaded');
  assert.ok(Date.parse(one.reloads[0].observedAt));
  assert.deepEqual(Object.keys(one.reloads[0]).sort(), ['id', 'observedAt', 'type']);
  one.reloads[0].type = 'tampered';
  assert.equal((await monitor.list('a')).reloads[0].type, 'agent.reloaded');
  assert.deepEqual((await monitor.list('b')).reloads, []);
  assert.equal((await monitor.list('a')).reloads.length, 1);
  await assert.rejects(monitor.list('missing'), error => error.status === 400);
});

test('unavailable samples preserve the baseline and remote server records are never fetched', async t => {
  const f = fixture();
  const monitor = createReloadMonitor(f.adapter);
  t.after(() => monitor.close());
  await monitor.list('a');
  for (const address of [undefined, 'http://example.com/a', 'http://user:password@localhost/a', 'file:///a', 'malformed']) {
    f.addresses.set('/a', address);
    const before = f.reads.length;
    const current = await monitor.list('a');
    assert.equal(current.available, false);
    assert.equal(current.reloads.length, 0);
    assert.equal(f.reads.length, before);
  }
  f.addresses.set('/a', 'http://127.0.0.1:1234/a');
  assert.equal((await monitor.list('a')).reloads.length, 0);
  f.revisions.set('/a', undefined);
  assert.equal((await monitor.list('a')).available, false);
  f.revisions.set('/a', 'third');
  assert.equal((await monitor.list('a')).reloads.length, 1);
});

test('background observation captures changes between UI requests and stops on close', async () => {
  const f = fixture();
  const monitor = createReloadMonitor(f.adapter, { intervalMs: 5 });
  try {
    await monitor.list('a');
    f.revisions.set('/a', 'second');
    for (let attempts = 0; f.reads.length < 2 && attempts < 50; attempts++) await delay(5);
    // Wait for the in-flight sample before publishing the next change.
    await delay(5);
    f.revisions.set('/a', 'third');
    const response = await monitor.list('a');
    assert.equal(response.reloads.length, 2);
    assert.notEqual(response.reloads[0].id, response.reloads[1].id);
  } finally { await monitor.close(); }
  const count = f.reads.length;
  await delay(15);
  assert.equal(f.reads.length, count);
  await assert.rejects(monitor.list('a'), /closed/);
});
