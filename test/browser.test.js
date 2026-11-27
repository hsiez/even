import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
import { get } from 'node:http';

test('simultaneous Even launches keep separate browser sessions', async (t) => {
  const servers = await Promise.all(
    [0, 1].map(() => startServer({ inventory: async () => ({ agents: [] }) }))
  );
  t.after(() => Promise.all(servers.map((server) => server.close())));
  const cookies = await Promise.all(
    servers.map(async (server) => {
      const response = await fetch(server.url + '/api/v1/browser-session', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + server.token,
          origin: server.url,
        },
      });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    })
  );
  assert.notEqual(cookies[0].split('=')[0], cookies[1].split('=')[0]);
  for (const server of servers)
    assert.equal(
      (
        await fetch(server.url + '/api/v1/agents', {
          headers: {
            cookie: cookies.join('; '),
            'sec-fetch-site': 'same-origin',
          },
        })
      ).status,
      200
    );
  assert.equal(
    (
      await fetch(servers[1].url + '/api/v1/agents', {
        headers: { cookie: cookies[0], 'sec-fetch-site': 'same-origin' },
      })
    ).status,
    401
  );
});

test('public browser assets share one origin while APIs retain launch authentication', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'even-browser-'));
  let server;
  t.after(async () => {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, 'assets'));
  await writeFile(
    join(directory, 'index.html'),
    '<!doctype html><title>Even</title>'
  );
  await writeFile(
    join(directory, 'assets/app.js'),
    'export const browser = true;'
  );
  await writeFile(join(directory, 'private.js'), 'PRIVATE');
  await symlink(
    join(directory, 'private.js'),
    join(directory, 'assets/linked.js')
  );
  server = await startServer(
    { inventory: async () => ({ agents: [] }) },
    { browserDirectory: directory }
  );
  const root = await fetch(server.url);
  assert.equal(root.status, 200);
  assert.equal(
    root.headers.get('set-cookie'),
    null,
    'Public HTML cannot mint a browser credential'
  );
  assert.ok((await root.text()).includes('<title>Even</title>'));
  assert.ok(!root.headers.get('cache-control').includes('public'));
  assert.ok(
    root.headers
      .get('content-security-policy')
      .includes("frame-ancestors 'none'")
  );
  assert.equal(root.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await fetch(server.url + '/assets/app.js')).status, 200);
  assert.equal(
    (await fetch(server.url + '/assets/app.js', { method: 'HEAD' })).status,
    200
  );
  for (const path of [
    '/private.js',
    '/assets/linked.js',
    '/assets/%2e%2e%2fprivate.js',
    '/.even/search-v1.sqlite',
  ])
    assert.equal((await fetch(server.url + path)).status, 404);
  assert.equal((await fetch(server.url + '/api/v1/agents')).status, 401);
  const headers = {
    authorization: 'Bearer ' + server.token,
    origin: server.url,
  };
  assert.equal(
    (await fetch(server.url + '/api/v1/agents', { headers })).status,
    200
  );
  const handshake = await fetch(server.url + '/api/v1/browser-session', {
    method: 'POST',
    headers,
  });
  assert.equal(handshake.status, 200);
  const setCookie = handshake.headers.get('set-cookie');
  assert.ok(
    setCookie.includes('HttpOnly') &&
      setCookie.includes('SameSite=Strict') &&
      setCookie.includes('Path=/api/v1')
  );
  assert.ok(!setCookie.includes('Max-Age') && !setCookie.includes('Expires'));
  const cookie = setCookie.split(';')[0];
  const browser = { cookie, 'sec-fetch-site': 'same-origin' };
  assert.equal(
    (await fetch(server.url + '/api/v1/agents', { headers: browser })).status,
    200
  );
  for (const site of ['cross-site', 'same-site', 'none'])
    assert.equal(
      (
        await fetch(server.url + '/api/v1/agents', {
          headers: { cookie, 'sec-fetch-site': site },
        })
      ).status,
      401
    );
  assert.equal(
    (
      await fetch(server.url + '/api/v1/agents', {
        headers: { ...browser, authorization: 'Bearer wrong' },
      })
    ).status,
    401
  );
  assert.equal(
    (
      await fetch(server.url + '/api/v1/browser-session', {
        method: 'POST',
        headers: browser,
      })
    ).status,
    401
  );
  assert.equal(
    (
      await fetch(server.url + '/api/v1/sessions', {
        method: 'POST',
        headers: {
          ...browser,
          origin: server.url,
          'content-type': 'application/json',
        },
        body: '{',
      })
    ).status,
    400
  );
  const write = await fetch(server.url + '/api/v1/sessions', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(
    write.status,
    400,
    'Same-origin writes reach authenticated route validation'
  );
  for (const origin of [
    'https://example.com',
    'null',
    server.url + '.evil',
    'http://127.0.0.1:1',
  ])
    assert.equal(
      (
        await fetch(server.url + '/api/v1/agents', {
          headers: { ...headers, origin },
        })
      ).status,
      403
    );
  const wrongHost = await new Promise((resolve, reject) => {
    get(
      server.url + '/api/v1/agents',
      { headers: { ...headers, host: '127.0.0.1:1' } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      }
    ).on('error', reject);
  });
  assert.equal(wrongHost, 403);
  const malformed = await new Promise((resolve, reject) => {
    get(server.url, { path: 'http://[' }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(malformed, 400);
  assert.equal(
    (await fetch(server.url + '/api/v1/agents', { headers })).status,
    200
  );
  assert.equal(new URL(server.browserUrl).hash, '#token=' + server.token);
  assert.ok(
    !(await (await fetch(server.browserUrl)).text()).includes(server.token)
  );
  const port = Number(new URL(server.url).port);
  await server.close();
  server = await startServer(
    { inventory: async () => ({ agents: [] }) },
    { port, browserDirectory: directory }
  );
  const previousCookieStatus = await new Promise((resolve, reject) => {
    get(
      server.url + '/api/v1/agents',
      { headers: browser, agent: false },
      (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
        response.once('error', reject);
      }
    ).on('error', reject);
  });
  assert.equal(
    previousCookieStatus,
    401,
    'Previous-launch cookies are rejected'
  );
});
