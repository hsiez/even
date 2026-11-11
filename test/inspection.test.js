import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, rm, writeFile, access, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../src/server.js';
import { loadEve, isWithin } from '../src/eve-adapter.js';

test('real Eve inspection never evaluates authored modules or creates runtime state', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
}, async t => {
  const project = await mkdtemp(join(tmpdir(), 'even-inspection-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await cp(new URL('./fixtures/project/', import.meta.url), project, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  await writeFile(join(project, 'agent/agent.js'), 'throw new Error("AUTHORED MODULE EXECUTED"); export default {};');
  const before = await readdir(project);
  const adapter = await loadEve(project);
  const inventory = await adapter.inventory();
  assert.equal(inventory.agents.length, 1);
  assert.deepEqual(await adapter.traces(), []);
  assert.deepEqual(await readdir(project), before);
  await assert.rejects(access(join(project, '.eve')));
  const child = await loadEve(join(project, 'agent'));
  const nested = await child.inventory();
  assert.ok(nested.agents.every(agent => isWithin(child.project, agent.appRoot) && isWithin(child.project, agent.agentRoot)));
});


test('empty and malformed traces are omitted and detail returns 404 until a valid span exists', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
}, async t => {
  const project = await mkdtemp(join(tmpdir(), 'even-empty-traces-'));
  let server;
  t.after(async () => {
    await server?.close();
    await rm(project, { recursive: true, force: true });
  });
  await cp(new URL('./fixtures/project/', import.meta.url), project, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  const emptyId = 'a'.repeat(32);
  const malformedId = 'b'.repeat(32);
  const segments = id => join(project, '.eve/traces/v1', id, 'segments');
  await mkdir(segments(emptyId), { recursive: true });
  await mkdir(segments(malformedId), { recursive: true });
  await writeFile(join(segments(malformedId), '2222222222222222.otlp.json'), '{broken');
  server = await startServer(await loadEve(project));
  const headers = { authorization: 'Bearer ' + server.token };
  const base = server.url + '/api/v1/agents/root/traces';
  assert.deepEqual(await (await fetch(base, { headers })).json(), { traces: [] });
  for (const id of [emptyId, malformedId]) {
    assert.equal((await fetch(base + '/' + id, { headers })).status, 404);
  }
  await writeFile(join(segments(emptyId), '1111111111111111.otlp.json'), JSON.stringify({
    resourceSpans: [{ scopeSpans: [{ spans: [{
      traceId: emptyId, spanId: '1111111111111111', name: 'test',
      startTimeUnixNano: '100', endTimeUnixNano: '200',
      attributes: [{ key: 'agent.run.id', value: { stringValue: 'recorded-session' } }],
    }] }] }],
  }));
  const list = await (await fetch(base, { headers })).json();
  assert.deepEqual(list.traces.map(trace => trace.traceId), [emptyId]);
  assert.equal((await (await fetch(base + '?sessionId=recorded-session', { headers })).json()).traces.length, 1);
  assert.deepEqual(await (await fetch(base + '?sessionId=other-session', { headers })).json(), { traces: [] });
  const detail = await fetch(base + '/' + emptyId, { headers });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).spans.length, 1);
});
