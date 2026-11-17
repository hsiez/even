import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  symlink,
  mkdir,
  writeFile,
  rm,
  stat,
  readdir,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEve } from '../src/eve-adapter.js';
import { startServer } from '../src/server.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkResponse } from './helpers/contract.js';
import { DatabaseSync } from 'node:sqlite';

const attributes = (values) =>
  Object.entries(values).map(([key, value]) => ({
    key,
    value:
      typeof value === 'boolean'
        ? { boolValue: value }
        : typeof value === 'number'
          ? { doubleValue: value }
          : { stringValue: value },
  }));
const traceId = (n) => n.toString(16).padStart(32, '0');
const spanId = (n) => n.toString(16).padStart(16, '0');
const rawSpan = (trace, n, name, attrs = {}, parent, code = 0) => ({
  traceId: trace,
  spanId: spanId(n),
  name,
  parentSpanId: parent ? spanId(parent) : undefined,
  startTimeUnixNano: '1000000000',
  endTimeUnixNano: '2000000000',
  status: {
    code,
    ...(code === 2 ? { message: 'Recorded wrapper error' } : {}),
  },
  attributes: attributes(attrs),
});

test(
  'worker-backed search retries initialization after a temporary SQLite lock',
  { skip: !process.env.EVEN_TEST_NODE_MODULES, timeout: 20000 },
  async (t) => {
    const project = await mkdtemp(join(tmpdir(), 'even-search-retry-'));
    let server, blocking;
    t.after(async () => {
      await server?.close();
      blocking?.close();
      await rm(project, { recursive: true, force: true });
    });
    await cp(new URL('./fixtures/project/', import.meta.url), project, {
      recursive: true,
    });
    await symlink(
      resolve(process.env.EVEN_TEST_NODE_MODULES),
      join(project, 'node_modules')
    );
    await writeFile(
      join(project, 'agent/agent.js'),
      'throw new Error("SEARCH MUST NOT EXECUTE AUTHORED MODULES"); export default {};'
    );
    await mkdir(join(project, '.even'));
    blocking = new DatabaseSync(join(project, '.even/search-v1.sqlite'));
    blocking.exec('BEGIN EXCLUSIVE; CREATE TABLE locked_startup (id INTEGER);');
    server = await startServer(await loadEve(project));
    const search = () =>
      fetch(server.url + '/api/v1/traces/search', {
        headers: { authorization: 'Bearer ' + server.token },
      });
    const failed = await search();
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /database is locked/);
    blocking.exec('ROLLBACK');
    blocking.close();
    blocking = undefined;
    for (const response of await Promise.all([search(), search()])) {
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.total, 0);
      assert.equal(result.coverage.complete, true);
      checkResponse('/traces/search', 'get', response.status, result);
    }
  }
);

test(
  'installed Eve parsing, operation pairing and worker-backed HTTP search remain passive and durable',
  { skip: !process.env.EVEN_TEST_NODE_MODULES },
  async (t) => {
    const project = await mkdtemp(join(tmpdir(), 'even-search-real-'));
    let server;
    t.after(async () => {
      await server?.close();
      await rm(project, { recursive: true, force: true });
    });
    await cp(new URL('./fixtures/project/', import.meta.url), project, {
      recursive: true,
    });
    await symlink(
      resolve(process.env.EVEN_TEST_NODE_MODULES),
      join(project, 'node_modules')
    );
    await writeFile(
      join(project, 'agent/agent.js'),
      'throw new Error("SEARCH MUST NOT EXECUTE AUTHORED MODULES"); export default {};'
    );
    const write = async (id, span) => {
      const directory = join(project, '.eve/traces/v1', id, 'segments');
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, span.spanId + '.otlp.json'),
        JSON.stringify({
          resourceSpans: [{ scopeSpans: [{ spans: [span] }] }],
        })
      );
    };
    const first = traceId(1),
      second = traceId(2);
    await write(
      first,
      rawSpan(first, 1, 'agent.activation', {
        'agent.name': 'root',
        'agent.run.id': 'actual-session',
        'agent.channel.delivery.input': 'Original SOURCE_NEEDLE',
        'agent.session.title': 'Inspect logs',
      })
    );
    await write(
      first,
      rawSpan(
        first,
        2,
        'agent.action',
        { 'agent.action.kind': 'tool-call', 'agent.action.name': 'read_logs' },
        1,
        2
      )
    );
    await write(
      first,
      rawSpan(
        first,
        3,
        'execute_tool read_logs',
        {
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': 'read_logs',
        },
        2
      )
    );
    await write(
      first,
      rawSpan(
        first,
        4,
        'agent.step',
        { 'agent.usage.input_tokens': 40, 'agent.usage.output_tokens': 20 },
        1
      )
    );
    await write(
      first,
      rawSpan(
        first,
        5,
        'model',
        {
          'gen_ai.operation.name': 'chat',
          'gen_ai.usage.input_tokens': 40,
          'gen_ai.usage.output_tokens': 20,
        },
        4
      )
    );
    await write(
      second,
      rawSpan(second, 6, 'agent.activation', {
        'agent.name': 'root',
        'agent.run.id': 'actual-session',
        'gen_ai.input.messages': JSON.stringify([
          { role: 'user', content: 'Original SOURCE_NEEDLE' },
        ]),
      })
    );
    await write(
      second,
      rawSpan(
        second,
        7,
        'execute_tool read_logs',
        {
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': 'read_logs',
          'gen_ai.tool.call.result': JSON.stringify({
            message: 'Recovered from ECONNRESET',
            type: 'retryable',
          }),
        },
        6
      )
    );
    await write(
      second,
      rawSpan(
        second,
        8,
        'execute_tool publish_release',
        {
          'gen_ai.operation.name': 'execute_tool',
          'gen_ai.tool.name': 'publish_release',
        },
        6,
        2
      )
    );
    const adapter = await loadEve(project);
    server = await startServer(adapter);
    const search = async (q = '', extra = '') => {
      const response = await fetch(
        server.url + '/api/v1/traces/search?q=' + encodeURIComponent(q) + extra,
        { headers: { authorization: 'Bearer ' + server.token } }
      );
      const data = await response.json();
      checkResponse('/traces/search', 'get', response.status, data);
      assert.equal(response.status, 200, JSON.stringify(data));
      return data;
    };
    assert.equal(
      (await fetch(server.url + '/api/v1/traces/search')).status,
      401
    );
    await assert.rejects(access(join(project, '.even')));
    const failed = await search('tool:read_logs tool.status:error');
    assert.equal(failed.total, 1);
    assert.equal(failed.results[0].trace.toolCalls, 1);
    assert.equal(failed.results[0].trace.modelCalls, 1);
    assert.equal(failed.results[0].trace.inputTokens, 40);
    assert.ok(
      failed.results[0].matches.some(
        (match) =>
          match.source === 'statusCode' &&
          match.spanId === spanId(2) &&
          match.operationSpanId === spanId(3)
      )
    );
    assert.equal((await search('tool:read_logs has:error')).total, 2);
    assert.equal((await search('input:SOURCE_NEEDLE')).total, 1);
    assert.equal((await search('context:SOURCE_NEEDLE')).total, 1);
    assert.equal(
      (await search('output:retryable')).total,
      1,
      'Tool result type values are content, not message envelope keys'
    );
    assert.equal((await search('session:actual-session')).total, 2);
    assert.equal((await search('session:actual')).total, 0);
    const concurrent = await Promise.all(
      Array.from({ length: 6 }, () => search('output:ECONNRESET'))
    );
    assert.ok(concurrent.every((result) => result.total === 1));
    assert.equal(
      (await stat(join(project, '.even/search-v1.sqlite'))).mode & 0o777,
      0o600
    );
    assert.deepEqual(await readdir(join(project, '.eve')), ['traces']);
    const listing = await (
      await fetch(server.url + '/api/v1/agents', {
        headers: { authorization: 'Bearer ' + server.token },
      })
    ).json();
    assert.equal(listing.agents[0].runtime.state, 'disconnected');
    await rm(
      join(
        project,
        '.eve/traces/v1',
        first,
        'segments',
        spanId(3) + '.otlp.json'
      )
    );
    const wrapperOnly = await search('tool:read_logs tool.status:error');
    assert.ok(
      wrapperOnly.results[0].matches.some(
        (match) =>
          match.source === 'agent.action.name' && match.spanId === spanId(2)
      )
    );
    // Embedding from stdin must not pass --input-type through to a file worker.
    const embedded = promisify(execFile)(
      process.execPath,
      ['--input-type=module', '-'],
      { timeout: 15000 }
    );
    embedded.child.stdin.end(`
    import { loadEve } from ${JSON.stringify(new URL('../src/eve-adapter.js', import.meta.url).href)};
    import { startServer } from ${JSON.stringify(new URL('../src/server.js', import.meta.url).href)};
    const server = await startServer(await loadEve(${JSON.stringify(project)}));
    try {
      const response = await fetch(server.url + '/api/v1/traces/search', {headers:{authorization:'Bearer '+server.token}});
      console.log(JSON.stringify({status:response.status,total:(await response.json()).total}));
    } finally { await server.close(); }
  `);
    assert.deepEqual(JSON.parse((await embedded).stdout), {
      status: 200,
      total: 2,
    });
    const page = await search('', '&limit=1');
    assert.ok(page.nextCursor);
    await server.close();
    server = await startServer(await loadEve(project));
    const continued = await search(
      '',
      '&limit=1&cursor=' + encodeURIComponent(page.nextCursor)
    );
    assert.equal(continued.results.length, 1);
    await rm(join(project, '.eve/traces/v1', second), { recursive: true });
    assert.equal((await search('output:ECONNRESET')).total, 0);
  }
);
