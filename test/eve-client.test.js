import test from 'node:test';
import assert from 'node:assert/strict';
import { createEveClient } from '../src/eve-client.js';
import { loadEve } from '../src/eve-adapter.js';
import { resolve } from 'node:path';

test('client uses Eve credential callback per request and explicit authorization takes precedence', {
  skip: !process.env.EVEN_TEST_NODE_MODULES,
}, async () => {
  const installed = await loadEve(resolve(process.env.EVEN_TEST_NODE_MODULES, '..'));
  let calls = 0;
  const project = '/selected/project';
  const adapter = {
    project,
    async internal(path) {
      if (path === 'services/dev-client/request-headers.js') {
        return { async resolveLinkedDevelopmentOidcToken(root) {
          assert.equal(root, project);
          return 'credential-' + ++calls;
        } };
      }
      if (path === 'client/index.js') {
        return { Client: class { constructor(options) { this.options = options; } } };
      }
      return installed.internal(path);
    },
  };
  const client = await createEveClient(adapter, 'http://127.0.0.1:1234');
  assert.equal(client.options.redirect, 'manual');
  assert.equal(await client.options.auth.bearer(), 'credential-1');
  assert.equal(await client.options.auth.bearer(), 'credential-2');
  assert.equal(client.options.headers?.['x-eve-dev-interactive-client'], undefined);
  const explicit = await createEveClient(adapter, 'http://127.0.0.1:1234', { Authorization: 'Bearer custom' });
  assert.equal(explicit.options.auth, undefined);
  assert.equal(explicit.options.headers.Authorization, 'Bearer custom');
  assert.equal(calls, 2);
});
