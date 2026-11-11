import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, cp, symlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';

if (!process.env.EVEN_TEST_NODE_MODULES) throw new Error('Set EVEN_TEST_NODE_MODULES to an installation containing Eve 1.0.0-rc.6.');
const temp = await mkdtemp(join(tmpdir(), 'even-pack-'));
let child;
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temp], { encoding: 'utf8' }))[0];
  execFileSync('npm', ['install', '--prefix', temp, '--no-audit', '--no-fund', join(temp, packed.filename)], { stdio: 'pipe' });
  const project = join(temp, 'project');
  await cp(new URL('../test/fixtures/project/', import.meta.url), project, { recursive: true });
  await symlink(resolve(process.env.EVEN_TEST_NODE_MODULES), join(project, 'node_modules'));
  const headerFile = join(temp, 'eve-headers.json');
  await writeFile(headerFile, JSON.stringify({ Authorization: 'Basic ' + Buffer.from('tester:pack-secret').toString('base64') }), { mode: 0o600 });
  await writeFile(join(project, 'agent/channels/eve.js'),
    'import { eveChannel } from "eve/channels/eve"; import { httpBasic } from "eve/channels/auth"; export default eveChannel({ auth: httpBasic({ username: "tester", password: "pack-secret" }) });');
  child = spawn(join(temp, 'node_modules/.bin/even'), ['--project', project, '--eve-headers', headerFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', bytes => { errors += bytes; });
  const launch = await new Promise((resolveLaunch, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('CLI startup timed out: ' + errors)), 15000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('CLI exited ' + code + ': ' + errors)); });
    child.stdout.on('data', bytes => {
      output += bytes;
      const end = output.indexOf('\n');
      if (end >= 0) {
        clearTimeout(timer);
        try { resolveLaunch(JSON.parse(output.slice(0, end))); } catch (error) { reject(error); }
      }
    });
  });
  const headers = { authorization: 'Bearer ' + launch.token, 'content-type': 'application/json' };
  assert.equal((await fetch(launch.url + '/api/v1/agents')).status, 401);
  assert.equal((await fetch(launch.url + '/api/v1/agents', { headers })).status, 200);
  const created = await fetch(launch.url + '/api/v1/sessions', { method: 'POST', headers, body: '{}' });
  const session = await created.json();
  assert.equal(created.status, 201, JSON.stringify(session));
  const base = launch.url + '/api/v1/sessions/' + session.id;
  const sent = await fetch(base + '/messages', { method: 'POST', headers, body: JSON.stringify({ message: 'hello' }) });
  assert.equal(sent.status, 202, await sent.text());
  const response = await fetch(base + '/events', { headers, signal: AbortSignal.timeout(60000) });
  let events = '';
  for await (const bytes of response.body) {
    events += new TextDecoder().decode(bytes);
    if (events.includes('"type":"delivery.settled"')) break;
  }
  assert.ok(events.includes('Even fixture reply'));
  const ids = [...events.matchAll(/^id: (.+)$/gm)].map(match => match[1]);
  const replay = await (await fetch(base + '/events?follow=false', { headers: { ...headers, 'last-event-id': ids[1] } })).text();
  assert.ok(replay.startsWith('id: ' + ids[2] + '\n'));
  const traces = await (await fetch(launch.url + '/api/v1/agents/root/traces', { headers })).json();
  assert.ok(traces.traces.some(trace => trace.conversationIds.includes(session.id)));
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  assert.equal((await exited)[0], 0);
  child = undefined;
  console.log('Packed CLI verified: authentication, inventory, sessions, messaging, live events, replay, traces, shutdown.');
  console.log('Tarball contents: ' + packed.files.map(file => file.path).join(', '));
} finally {
  child?.kill('SIGKILL');
  await rm(temp, { recursive: true, force: true });
}
