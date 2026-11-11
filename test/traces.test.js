import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEve } from '../src/eve-adapter.js';

test('Eve trace store follows linked spools, reads new segments, and filters exact session identity', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'even-traces-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL('./fixtures/project/', import.meta.url), root, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(root, 'node_modules'));
  const id = 'a'.repeat(32);
  const segments = join(root, 'outside/traces/v1', id, 'segments');
  await mkdir(segments, { recursive: true });
  await symlink(join(root, 'outside'), join(root, '.eve'));
  const span = (spanId, sessionId) => JSON.stringify({ resourceSpans: [{ scopeSpans: [{ spans: [{
    traceId: id, spanId, name: 'agent.run', startTimeUnixNano: '100', endTimeUnixNano: '200',
    attributes: [
      { key: 'agent.run.id', value: { stringValue: sessionId } },
      { key: 'gen_ai.conversation.id', value: { stringValue: 'shared-conversation' } },
    ],
  }] }] }] });
  await writeFile(join(root, 'secret.json'), span('3333333333333333', 'secret'));
  await symlink(join(root, 'secret.json'), join(segments, '3333333333333333.otlp.json'));
  await writeFile(join(segments, '1111111111111111.otlp.json'), span('1111111111111111', 'parent-session'));
  const adapter = await loadEve(root);
  assert.equal(await adapter.traces('../secret'), undefined);
  assert.equal((await adapter.traces(id)).spans.length, 1);
  assert.equal((await adapter.traces(undefined, 'root', 'parent-session')).length, 1);
  assert.deepEqual(await adapter.traces(undefined, 'root', 'shared-conversation'), []);
  assert.deepEqual(await adapter.traces(undefined, 'root', 'child-session'), []);
  await writeFile(join(segments, '2222222222222222.otlp.json'), span('2222222222222222', 'child-session'));
  const updated = await adapter.traces(undefined, 'root', 'child-session');
  assert.equal(updated.length, 1);
  assert.equal(updated[0].spans.length, 2);
  assert.deepEqual(await adapter.traces(undefined, 'root', 'secret'), []);
  await rm(join(root, 'outside/traces/v1', id), { recursive: true });
  assert.equal(await adapter.traces(id), undefined);
});
