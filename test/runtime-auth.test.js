import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEve } from '../src/eve-adapter.js';
import { createEveClient } from '../src/eve-client.js';
import { startRuntime } from '../src/runtime.js';

test('Eve channel retains identity rules and accepts explicitly configured credentials', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
  timeout: 120000,
}, async t => {
  const project = await mkdtemp(join(tmpdir(), 'even-runtime-auth-'));
  await cp(new URL('./fixtures/project/', import.meta.url), project, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  const channelPath = join(project, 'agent/channels/eve.js');
  const channel = 'import { eveChannel } from "eve/channels/eve"; import { httpBasic } from "eve/channels/auth"; export default eveChannel({ auth: httpBasic({ username: "tester", password: "fixture-secret" }) });';
  await writeFile(channelPath, channel);
  const runtime = startRuntime(project);
  t.after(async () => {
    await runtime.close();
    await rm(project, { recursive: true, force: true });
  });
  const ready = await runtime.ready;
  const adapter = await loadEve(project);
  const anonymous = await createEveClient(adapter, ready.url);
  await assert.rejects(anonymous.sessions.create(), error => error.status === 401);
  const wrong = await createEveClient(adapter, ready.url, { authorization: 'Basic ' + Buffer.from('tester:wrong').toString('base64') });
  await assert.rejects(wrong.sessions.create(), error => error.status === 401);
  const accepted = await createEveClient(adapter, ready.url, { authorization: 'Basic ' + Buffer.from('tester:fixture-secret').toString('base64') });
  assert.ok((await accepted.sessions.create()).session.id);
  assert.equal(await readFile(channelPath, 'utf8'), channel);
});
