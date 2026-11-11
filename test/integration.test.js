import { checkResponse, checkSchema } from './helpers/contract.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEve } from '../src/eve-adapter.js';
import { startRuntime } from '../src/runtime.js';
import { startServer } from '../src/server.js';

test('real Eve delivers messages, replays events and records traces through HTTP', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
  timeout: 120000,
}, async t => {
  const project = await mkdtemp(join(tmpdir(), 'even-contract-'));

  await cp(new URL('./fixtures/project/', import.meta.url), project, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  const server = await startServer(await loadEve(project));
  t.after(async () => {
    await server.close();
    await rm(project, { recursive: true, force: true });
  });
  const headers = { authorization: 'Bearer ' + server.token, 'content-type': 'application/json' };
  const post = (path, value) => fetch(server.url + path, { method: 'POST', headers, body: JSON.stringify(value) });
  const created = await post('/api/v1/sessions', {});
  const session = await created.json();
  assert.equal(created.status, 201, JSON.stringify(session));
  checkResponse('/sessions', 'post', created.status, session);
  const competing = startRuntime(project);
  assert.equal((await competing.ready).ownership, 'attached');
  await competing.close();
  const foreign = await post('/api/v1/sessions/not-owned/messages', { message: 'hello' });
  assert.equal(foreign.status, 404);
  const base = '/api/v1/sessions/' + session.id;
  const sent = await post(base + '/messages', { message: 'hello' });
  assert.equal(sent.status, 202);
  checkResponse('/sessions/{sessionId}/messages', 'post', sent.status, await sent.json());
  const controller = new AbortController();
  const response = await fetch(server.url + base + '/events', { headers, signal: controller.signal });
  assert.equal(response.status, 200);
  let text = '';
  for await (const bytes of response.body) {
    text += new TextDecoder().decode(bytes);
    if (text.includes('"type":"delivery.settled"')) break;
  }
  controller.abort();
  for (const match of text.matchAll(/^data: (.+)$/gm)) checkSchema('EveEvent', JSON.parse(match[1]));
  assert.ok(text.includes('Even fixture reply'));
  const ids = [...text.matchAll(/^id: (.+)$/gm)].map(match => match[1]);
  assert.ok(ids.length > 3);
  const replay = await fetch(server.url + base + '/events?follow=false', {
    headers: { ...headers, 'last-event-id': ids[1] },
  });
  const replayText = await replay.text();
  assert.ok(replayText.startsWith('id: ' + ids[2] + '\n'));
  assert.ok(replayText.includes('"type":"delivery.settled"'));
  const traces = await (await fetch(server.url + '/api/v1/agents/root/traces', { headers })).json();
  checkResponse('/agents/{agentId}/traces', 'get', 200, traces);
  assert.ok(traces.traces.some(trace => trace.conversationIds.includes(session.id)));
});
