import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contract, checkResponse, checkSchema } from './helpers/contract.js';
import { startServer } from '../src/server.js';

test('OpenAPI validates and covers every implemented route', async () => {
  const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  const routes = [...source.matchAll(/app\.(get|post)\('\/api\/v1([^']+)'/g)]
    .map(([,method,path]) => method + ' ' + path.replace(/:([A-Za-z]+)/g, '{$1}')).sort();
  const documented = Object.entries(contract.paths).flatMap(([path,methods]) => Object.keys(methods).map(method => method+' '+path)).sort();
  assert.deepEqual(documented, routes);
  assert.throws(() => checkSchema('Session', { id: 'missing-agent' }));
  assert.throws(() => checkSchema('Message', { message: '   ' }));
});

test('HTTP inspection and error responses conform to OpenAPI', async t => {
  const server = await startServer({
    inventory: async () => ({agents:[{id:'root',appRoot:'/fixture'}]}),
    traces: async id => id === undefined ? [] : undefined,
  });
  t.after(() => server.close());
  const auth = {authorization:'Bearer '+server.token};
  for (const [path,method,headers,body] of [
    ['/agents','get',{}], ['/agents','get',{...auth,origin:'https://example.com'}],
    ['/agents','get',auth], ['/sessions','get',auth],
    ['/agents/root/traces','get',auth], ['/agents/root/traces/'+'a'.repeat(32),'get',auth],
    ['/sessions','post',auth,'{}'],
    ['/sessions','post',{...auth,'content-type':'application/json'},'{'],
    ['/sessions','post',{...auth,'content-type':'application/json'},' '.repeat(65537)],
  ]) {
    const result = await fetch(server.url+'/api/v1'+path,{method,headers,body});
    const pattern = path.replace('/root/','/{agentId}/').replace(/\/a{32}$/, '/{traceId}');
    checkResponse(pattern,method,result.status,await result.json());
  }
});
