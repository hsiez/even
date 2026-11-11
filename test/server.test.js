import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';

test('authentication and origin checks run before inspection', async t => {
  let reads = 0;
  const server = await startServer({ async inventory() { reads++; return { agents: [] }; } });
  t.after(() => server.close());
  const url = server.url + '/api/v1/agents';
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { authorization: 'Bearer wrong' } })).status, 401);
  const headers = { authorization: 'Bearer ' + server.token };
  assert.equal((await fetch(url, { headers: { ...headers, origin: 'https://attacker.example' } })).status, 403);
  const reboundStatus = await new Promise((resolve, reject) => {
    const req = request(url, { headers: { ...headers, host: 'attacker.example' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(reboundStatus, 403);
  assert.equal(reads, 0);
  const response = await fetch(url, { headers });
  assert.deepEqual(await response.json(), { agents: [] });
  assert.equal(reads, 1);
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:/);
});

test('each launch gets a new authentication token', async t => {
  const adapter = { async inventory() { return { agents: [] }; } };
  const first = await startServer(adapter);
  const second = await startServer(adapter);
  t.after(() => Promise.all([first.close(), second.close()]));
  assert.notEqual(first.token, second.token);
  assert.equal((await fetch(second.url + '/api/v1/agents', {
    headers: { authorization: 'Bearer ' + first.token },
  })).status, 401);
});
