import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TraceSearchIndex, validateSearch } from '../src/search/index.js';
import { parseTraceQuery } from '../src/search/query.js';
import { startServer } from '../src/server.js';

const id = (n) => n.toString(16).padStart(32, '0');
const sid = (n) => n.toString(16).padStart(16, '0');
const spool = (source, traceId) =>
  join(source.appRoot, '.eve/traces/v1', traceId, 'segments');
const span = (n, attributes = {}, extra = {}) => ({
  spanId: sid(n),
  name: `operation-${n}`,
  startTimeNs: '1000000000',
  endTimeNs: '2000000000',
  statusCode: 0,
  attributes,
  events: [],
  ...extra,
});
const tool = (n, name, error = false, output) =>
  span(
    n,
    {
      'gen_ai.operation.name': 'execute_tool',
      'gen_ai.tool.name': name,
      ...(output === undefined
        ? {}
        : { 'gen_ai.tool.call.result': JSON.stringify(output) }),
    },
    { name, statusCode: error ? 2 : 0 }
  );
const missing = async (work) => {
  try {
    return await work();
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
};

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'even-search-unit-'));
  let index;
  t.after(async () => {
    index?.close();
    await rm(root, { recursive: true, force: true });
  });
  const sources = [
    { id: 'support', appRoot: join(root, 'support') },
    { id: 'release', appRoot: join(root, 'release') },
  ];
  let reads = 0;
  const helpers = {
    async listLocalTraceIds(appRoot) {
      return (
        (await missing(() =>
          readdir(join(appRoot, '.eve/traces/v1'), { withFileTypes: true })
        )) ?? []
      )
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    },
    async listLocalTraceSegments(appRoot, traceId) {
      return (
        await missing(() =>
          readdir(join(appRoot, '.eve/traces/v1', traceId, 'segments'), {
            withFileTypes: true,
          })
        )
      )
        ?.filter((e) => e.isFile() && /^[a-f0-9]{16}\.otlp\.json$/.test(e.name))
        .map((e) => e.name)
        .sort();
    },
    async readLocalTraceSegment(appRoot, traceId, file) {
      reads++;
      try {
        return JSON.parse(
          await readFile(
            join(appRoot, '.eve/traces/v1', traceId, 'segments', file),
            'utf8'
          )
        ).map((s) => ({
          ...s,
          startTimeNs: BigInt(s.startTimeNs),
          endTimeNs: BigInt(s.endTimeNs),
        }));
      } catch {
        return [];
      }
    },
    uniqueLocalTraceSpans: (spans) => [
      ...new Map(spans.map((s) => [s.spanId, s])).values(),
    ],
    localTraceOperations: (spans) =>
      spans
        .filter((s) => s.attributes['gen_ai.operation.name'] === 'execute_tool')
        .map((s) => ({ category: 'tool', span: s })),
    traceToolName: (s) => s.attributes['gen_ai.tool.name'],
    summarizeLocalTrace(traceId, spans) {
      return {
        traceId,
        startedAt: new Date(
          Number(spans[0].startTimeNs / 1000000n)
        ).toISOString(),
        durationMs:
          Number(
            spans.reduce(
              (end, s) => (s.endTimeNs > end ? s.endTimeNs : end),
              0n
            ) - spans[0].startTimeNs
          ) / 1e6,
        spanCount: spans.length,
        agentNames: [
          ...new Set(
            spans.map((s) => s.attributes['agent.name']).filter(Boolean)
          ),
        ],
        sessionIds: [
          ...new Set(
            spans.map((s) => s.attributes['agent.run.id']).filter(Boolean)
          ),
        ],
        conversationIds: ['conversation-only'],
        models: [],
        toolNames: spans
          .map((s) => s.attributes['gen_ai.tool.name'])
          .filter(Boolean),
        toolCalls: spans.filter((s) => s.attributes['gen_ai.tool.name']).length,
        modelCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorSpanCount: spans.filter((s) => s.statusCode === 2).length,
      };
    },
  };
  const path = join(root, 'search.sqlite');
  const create = (options) => {
    index = new TraceSearchIndex(path, sources, helpers, options);
    return index;
  };
  const write = async (
    trace,
    value,
    source = sources[0],
    file = `${value[0].spanId}.otlp.json`
  ) => {
    await mkdir(spool(source, trace), { recursive: true });
    await writeFile(join(spool(source, trace), file), JSON.stringify(value));
  };
  await write(id(1), [
    span(1, {
      'agent.name': 'Support',
      'agent.run.id': 'shared-session',
      'agent.channel.delivery.input': 'Please deploy preview',
    }),
    tool(2, 'read_logs', true),
  ]);
  await write(id(2), [
    span(3, {
      'agent.run.id': 'shared-session',
      'gen_ai.input.messages': JSON.stringify([
        { role: 'user', content: 'Please deploy preview' },
      ]),
    }),
    tool(4, 'read_logs', false, {
      message: 'Recovered from ECONNRESET; Straße 🙂 a"b OR /api/orders',
    }),
    tool(5, 'publish_release', true),
  ]);
  await write(id(3), [
    span(6),
    tool(7, 'read_logs', false, {
      message: 'ECONNRESET again',
      unrelated: 'do not join me',
    }),
  ]);
  await write(id(4), [
    span(8, {
      'agent.trace.content.input': false,
      'agent.trace.content.output': false,
    }),
    tool(9, 'read_logs'),
  ]);
  await write(
    id(1),
    [span(1, { 'agent.name': 'Release' }), tool(2, 'publish_release')],
    sources[1]
  );
  return {
    root,
    sources,
    helpers,
    path,
    create,
    write,
    reads: () => reads,
    close: () => {
      index.close();
      index = undefined;
    },
  };
}

test('search scopes errors to one tool operation and returns original field evidence', async (t) => {
  const f = await fixture(t),
    index = f.create();
  const failed = await index.search({ q: 'tool:read_logs tool.status:error' });
  assert.equal(failed.total, 1);
  assert.equal(failed.results[0].trace.traceId, id(1));
  assert.equal(failed.results[0].matches[0].spanId, sid(2));
  assert.equal(
    (await index.search({ q: 'tool:read_logs has:error' })).total,
    2
  );
  const output = await index.search({
    q: 'tool:read_logs output:"ECONNRESET"',
  });
  assert.equal(output.total, 2);
  assert.ok(
    output.results.every(
      (r) =>
        r.matches[0].field === 'output' &&
        r.matches[0].source === 'gen_ai.tool.call.result'
    )
  );
  assert.equal(
    (await index.search({ q: 'tool:publish_release output:ECONNRESET' })).total,
    0
  );
  assert.equal(
    (
      await index.search({
        q: 'tool:read_logs tool.status:error output:ECONNRESET',
      })
    ).total,
    0
  );
  assert.equal(failed.results[0].trace.complete, undefined);
  assert.equal(failed.results[0].trace.spans, undefined);
});

test('literal matching handles Unicode, quotes, short strings, punctuation, and excludes JSON keys', async (t) => {
  const f = await fixture(t),
    index = f.create();
  for (const q of ['output:STRASSE', 'output:message', 'output:"again do not"'])
    assert.equal((await index.search({ q })).total, 0, q);
  for (const q of [
    'output:STRAẞE',
    'output:🙂',
    'output:OR',
    'output:"a\\"b"',
    'output:/api/orders',
    'output:CONNRESET',
  ])
    assert.equal(
      (await index.search({ q })).total,
      q === 'output:CONNRESET' ? 2 : 1,
      q
    );
  assert.equal((await index.search({ q: '"deploy preview"' })).total, 1);
  assert.equal((await index.search({ q: 'input:"deploy preview"' })).total, 1);
  assert.equal(
    (await index.search({ q: 'context:"deploy preview"' })).total,
    1
  );
});

test('metadata works without capture; source IDs scope identical trace IDs and session IDs are exact', async (t) => {
  const f = await fixture(t),
    index = f.create();
  const all = await index.search({ q: '' });
  assert.equal(all.total, 5);
  assert.equal(
    all.results.find((r) => r.trace.traceId === id(4)).trace
      .contentAvailability,
    'not-recorded'
  );
  assert.equal((await index.search({ q: 'trace:' + id(1) })).total, 2);
  assert.equal(
    (await index.search({ q: 'trace:' + id(1), agentId: 'release' })).total,
    1
  );
  assert.equal((await index.search({ q: 'agent:SUPPORT' })).total, 4);
  assert.equal((await index.search({ q: 'session:shared-session' })).total, 2);
  assert.equal(
    (await index.search({ q: 'session:conversation-only' })).total,
    0
  );
  assert.equal(
    (await index.search({ q: 'duration:>=1s duration:<2s' })).total,
    5
  );
  await assert.rejects(index.search({ agentId: 'not-in-workspace' }), {
    status: 400,
  });
});

test('index survives reopening and reconciles additions, replacements, retention and linked segments', async (t) => {
  const f = await fixture(t);
  let index = f.create();
  await index.search({ q: '' });
  const reads = f.reads();
  f.close();
  index = f.create();
  await index.search({ q: '' });
  assert.equal(f.reads(), reads);
  await f.write(id(1), [
    tool(10, 'new_tool', false, { message: 'Fresh searchable payload' }),
  ]);
  assert.equal((await index.search({ q: 'output:searchable' })).total, 1);
  const file = join(spool(f.sources[0], id(1)), `${sid(10)}.otlp.json`);
  await writeFile(
    file,
    JSON.stringify([
      tool(10, 'new_tool', false, { message: 'Redacted payload' }),
    ])
  );
  await utimes(file, new Date(0), new Date(0));
  assert.equal((await index.search({ q: 'output:searchable' })).total, 0);
  await f.write(
    id(99),
    [tool(99, 'secret', false, { message: 'linked-secret' })],
    f.sources[1]
  );
  await symlink(
    join(spool(f.sources[1], id(99)), `${sid(99)}.otlp.json`),
    join(spool(f.sources[0], id(1)), `${sid(98)}.otlp.json`)
  );
  assert.equal(
    (await index.search({ q: 'output:linked-secret', agentId: 'support' }))
      .total,
    0
  );
  await rm(spool(f.sources[0], id(1)), { recursive: true });
  assert.equal((await index.search({ q: 'tool:new_tool' })).total, 0);
  assert.equal(
    index.db
      .prepare(
        'SELECT count(*) AS n FROM document_fts WHERE document_fts MATCH \'"searchable"\''
      )
      .get().n,
    0
  );
});

test('malformed segments are retried and changed invalid data cannot retain old searchable payloads', async (t) => {
  const f = await fixture(t),
    index = f.create();
  await index.search({ q: '' });
  const file = join(spool(f.sources[0], id(2)), `${sid(3)}.otlp.json`);
  await writeFile(file, '{broken');
  const broken = await index.search({ q: 'output:ECONNRESET' });
  assert.equal(broken.total, 1);
  assert.equal(broken.coverage.complete, false);
  assert.equal(broken.coverage.unreadableSegments, 1);
  const calls = f.reads();
  await index.search({ q: '' });
  assert.ok(f.reads() > calls);
  await writeFile(
    file,
    JSON.stringify([
      tool(3, 'repaired', false, { message: 'Repair confirmed' }),
    ])
  );
  const repaired = await index.search({ q: 'output:Repair' });
  assert.equal(repaired.total, 1);
  assert.equal(repaired.coverage.complete, true);
  index.maxTraceBytes = 1;
  const oversized = await index.search({ q: '' });
  assert.equal(oversized.total, 0);
  assert.equal(oversized.coverage.complete, false);
});

test('failed transactions leave no checkpoint and a later search can recover', async (t) => {
  const f = await fixture(t),
    index = f.create();
  index.db.exec(
    "CREATE TRIGGER reject_document BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT,'temporary failure'); END"
  );
  const failed = await index.search({ q: 'output:ECONNRESET' });
  assert.equal(failed.total, 0);
  assert.equal(failed.coverage.complete, false);
  index.db.exec('DROP TRIGGER reject_document');
  const recovered = await index.search({ q: 'output:ECONNRESET' });
  assert.equal(recovered.total, 2);
  assert.equal(recovered.coverage.complete, true);
});

test('pagination is deterministic, survives reopening, rejects mismatched and stale cursors', async (t) => {
  const f = await fixture(t);
  let index = f.create();
  const first = await index.search({ limit: 2 });
  assert.equal(first.results.length, 2);
  assert.ok(first.nextCursor);
  const second = await index.search({ limit: 2, cursor: first.nextCursor });
  assert.equal(second.results.length, 2);
  assert.equal(
    new Set(
      [...first.results, ...second.results].map(
        (r) => r.trace.agentId + ':' + r.trace.traceId
      )
    ).size,
    4
  );
  f.close();
  index = f.create();
  assert.deepEqual(
    (await index.search({ limit: 2, cursor: first.nextCursor })).results,
    second.results
  );
  await assert.rejects(
    index.search({ q: 'tool:read_logs', cursor: first.nextCursor }),
    { status: 400 }
  );
  await assert.rejects(index.search({ cursor: 'not-a-cursor' }), {
    status: 400,
  });
  await f.write(id(5), [tool(20, 'extra')]);
  await assert.rejects(index.search({ cursor: first.nextCursor }), {
    status: 409,
  });
});

test('query validation is shared and rejects invalid fields, lengths, and unsafe limits', () => {
  for (const q of [
    'tool:',
    'status:error',
    'duration:later',
    'input:"open',
    'x'.repeat(2001),
    'a\0b',
    Array(34).fill('term').join(' '),
  ])
    assert.throws(() => validateSearch({ q }), { status: 400 });
  for (const limit of [0, 101, 1.5, '5', NaN])
    assert.throws(() => validateSearch({ limit }), { status: 400 });
  assert.throws(() => validateSearch({ sort: '__proto__' }), { status: 400 });
  assert.equal(
    parseTraceQuery('"https://example.com"').tokens[0].field,
    'text'
  );
});

test('HTTP search validates parameters and protects index access with launch authentication', async (t) => {
  let calls = 0;
  const response = {
    results: [],
    total: 0,
    nextCursor: null,
    coverage: {
      complete: true,
      discoveredTraces: 0,
      indexedTraces: 0,
      unreadableSegments: 0,
      skippedTraces: 0,
      issues: [],
      checkedAt: new Date().toISOString(),
    },
  };
  const server = await startServer(
    {},
    {
      traceSearch: {
        async search(input) {
          calls++;
          validateSearch(input);
          return response;
        },
        async close() {},
      },
    }
  );
  t.after(() => server.close());
  const url = server.url + '/api/v1/traces/search',
    headers = { authorization: 'Bearer ' + server.token };
  assert.equal((await fetch(url)).status, 401);
  assert.equal(
    (
      await fetch(url, {
        headers: { ...headers, origin: 'https://example.com' },
      })
    ).status,
    403
  );
  assert.equal(calls, 0);
  for (const suffix of [
    '?limit=0',
    '?limit=1.5',
    '?q=tool%3A',
    '?wat=1',
    '?q=a&q=b',
  ])
    assert.equal((await fetch(url + suffix, { headers })).status, 400, suffix);
  assert.deepEqual(
    await (await fetch(url + '?limit=5', { headers })).json(),
    response
  );
});

test('unavailable sources are excluded rather than serving cached results and invalidate pagination', async (t) => {
  const f = await fixture(t),
    index = f.create();
  const page = await index.search({ limit: 1 });
  assert.ok(page.nextCursor);
  const read = f.helpers.listLocalTraceIds;
  f.helpers.listLocalTraceIds = async (root) => {
    if (root === f.sources[0].appRoot) throw new Error('Unavailable');
    return read(root);
  };
  const unavailable = await index.search({});
  assert.equal(unavailable.total, 1);
  assert.equal(unavailable.coverage.complete, false);
  await assert.rejects(index.search({ cursor: page.nextCursor }), {
    status: 409,
  });
  f.helpers.listLocalTraceIds = read;
  assert.equal((await index.search({})).total, 5);
});

test('all tool payload terms must belong to one invocation and event errors preserve source location', async (t) => {
  const f = await fixture(t),
    index = f.create();
  const first = tool(40, 'repeat', false, { message: 'ONLY_FIRST' }),
    second = tool(41, 'repeat', false, { message: 'ONLY_SECOND' });
  second.statusCode = 2;
  second.events = [
    {
      name: 'exception',
      attributes: { 'exception.message': 'EVENT_ONLY_ERROR' },
    },
  ];
  await f.write(id(10), [first, second]);
  assert.equal(
    (
      await index.search({
        q: 'tool:repeat output:ONLY_FIRST output:ONLY_SECOND',
      })
    ).total,
    0
  );
  assert.equal(
    (await index.search({ q: 'tool:repeat ONLY_FIRST ONLY_SECOND' })).total,
    0
  );
  const event = await index.search({ q: 'tool:repeat error:EVENT_ONLY_ERROR' });
  assert.equal(event.total, 1);
  assert.equal(
    event.results[0].matches[0].source,
    'events[0].exception.message'
  );
  const errors = await index.search({ q: 'tool:read_logs has:error' });
  assert.ok(
    errors.results.every((row) => row.matches.some((match) => match.spanId))
  );
});
