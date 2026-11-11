import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEve } from '../src/eve-adapter.js';
import { startRuntime } from '../src/runtime.js';
import { startServer } from '../src/server.js';
import { createEveClient } from '../src/eve-client.js';

test('workspace selection routes sessions and attached shutdown preserves the original server', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
  timeout: 120000,
}, async t => {
  const project = await mkdtemp(join(tmpdir(), 'even-workspace-'));
  let original;
  let even;
  t.after(async () => {
    await even?.close();
    await original?.close();
    await rm(project, { recursive: true, force: true });
  });
  await writeFile(join(project, 'package.json'), JSON.stringify({
    name: 'workspace-fixture', type: 'module', dependencies: { eve: '1.0.0-rc.6' },
  }));
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  for (const name of ['support', 'research']) {
    await mkdir(join(project, 'agents', name), { recursive: true });
    await cp(new URL('./fixtures/project/agent/', import.meta.url), join(project, 'agents', name, 'agent'), { recursive: true });
  }
  const adapter = await loadEve(project);
  assert.deepEqual((await adapter.inventory()).agents.map(agent => agent.id).sort(), ['research', 'support']);
  assert.throws(() => adapter.selectAgent('../outside'));
  assert.throws(() => adapter.selectAgent());
  const member = await loadEve(join(project, 'agents/support'));
  assert.equal((await member.inventory()).agents.length, 1);
  assert.throws(() => member.selectAgent('research'));
  await mkdir(join(project, 'agents/support/.eve'), { recursive: true });
  await writeFile(join(project, 'agents/support/.eve/dev-server-state.v1.json'), JSON.stringify({ url: 'http://127.0.0.1:1/' }));
  original = startRuntime(join(project, 'agents/support'));
  const originalReady = await original.ready;
  assert.equal(originalReady.ownership, 'started');
  even = await startServer(adapter);
  const headers = { authorization: 'Bearer ' + even.token, 'content-type': 'application/json' };
  const create = async agentId => {
    const response = await fetch(even.url + '/api/v1/sessions', { method: 'POST', headers, body: JSON.stringify({ agentId }) });
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    assert.equal(result.agentId, agentId);
    return result;
  };
  await Promise.all([create('support'), create('support')]);
  const research = await create('research');
  const response = await fetch(even.url + '/api/v1/sessions/' + research.id + '/messages', {
    method: 'POST', headers, body: JSON.stringify({ message: 'hello' }),
  });
  assert.equal(response.status, 202);
  const events = await fetch(even.url + '/api/v1/sessions/' + research.id + '/events', { headers, signal: AbortSignal.timeout(30000) });
  let eventText = '';
  for await (const bytes of events.body) {
    eventText += new TextDecoder().decode(bytes);
    if (eventText.includes('"type":"delivery.settled"')) break;
  }
  assert.ok(eventText.includes('Even fixture reply'));
  assert.equal((await fetch(even.url + '/api/v1/agents/unknown/traces', { headers })).status, 400);
  const researchTraces = await (await fetch(even.url + '/api/v1/agents/research/traces', { headers })).json();
  assert.ok(researchTraces.traces.some(trace => trace.conversationIds.includes(research.id)));
  const supportTraces = await (await fetch(even.url + '/api/v1/agents/support/traces', { headers })).json();
  assert.ok(supportTraces.traces.every(trace => !trace.conversationIds.includes(research.id)));
  const inventory = await (await fetch(even.url + '/api/v1/agents', { headers })).json();
  assert.equal(inventory.agents.find(c => c.id === 'support').runtime.ownership, 'attached');
  assert.equal(inventory.agents.find(c => c.id === 'research').runtime.ownership, 'started');
  assert.ok(inventory.agents.every(agent => agent.runtime.state === 'ready'));
  assert.equal(inventory.connections, undefined);
  const filtered = await (await fetch(even.url + '/api/v1/sessions?agentId=research', { headers })).json();
  assert.deepEqual(filtered.sessions, [{ id: research.id, agentId: 'research' }]);
  const traceId = researchTraces.traces.find(trace => trace.conversationIds.includes(research.id)).traceId;
  const detail = await (await fetch(even.url + '/api/v1/agents/research/traces/' + traceId, { headers })).json();
  assert.equal(detail.traceId, traceId);
  const researchUrl = inventory.agents.find(c => c.id === 'research').runtime.url;
  await even.close();
  even = undefined;
  const client = await createEveClient(member, originalReady.url);
  assert.ok((await client.sessions.create()).session.id);
  await assert.rejects(fetch(researchUrl, { signal: AbortSignal.timeout(1000) }));
});
