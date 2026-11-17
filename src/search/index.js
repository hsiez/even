import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { fold, projectTrace } from './projection.js';
import { matchExcerpt, parseTraceQuery } from './query.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
// Bump when extraction or canonical-operation interpretation changes.
const projectionVersion = 2;
const fingerprintFiles = (files) =>
  hash(JSON.stringify([projectionVersion, files]));
const scopedFields = ['output', 'error', 'arguments'];
const textFields = ['input', 'output', 'context', 'reply', 'error'];
const orderColumns = {
  latest: 'started_ms',
  duration: 'duration_ms',
  failures: 'errors',
  inputTokens: 'input_tokens',
};
export const badRequest = (message) =>
  Object.assign(new Error(message), { status: 400 });

export function validateSearch(options = {}) {
  const { q = '', agentId, sort = 'latest', limit = 50, cursor } = options;
  const parsed = parseTraceQuery(q);
  if (parsed.error) throw badRequest(parsed.error);
  if (agentId !== undefined && (typeof agentId !== 'string' || !agentId))
    throw badRequest('agentId must identify a workspace source.');
  if (!Object.hasOwn(orderColumns, sort))
    throw badRequest(
      'sort must be latest, duration, failures, or inputTokens.'
    );
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw badRequest('limit must be an integer from 1 to 100.');
  if (
    cursor !== undefined &&
    (typeof cursor !== 'string' || cursor.length > 2048)
  )
    throw badRequest('Invalid search cursor.');
  return { q, agentId, sort, limit, cursor, parsed };
}

// Text matching remains literal substring matching. Trigrams narrow candidates
// for 3+ Unicode code points; instr is always the final check, including short
// strings, punctuation and quoted FTS operators. No user SQL/FTS is executed.
function literal(alias, term) {
  const value = fold(term);
  const params = [];
  let sql = '';
  if (Array.from(value).length >= 3) {
    sql = `${alias}.id IN (SELECT rowid FROM document_fts WHERE document_fts MATCH ?) AND `;
    params.push('"' + value.replaceAll('"', '""') + '"');
  }
  return {
    sql: `(${sql}instr(${alias}.folded, ?) > 0)`,
    params: [...params, value],
  };
}
function docPredicate(token, opAlias) {
  const text = literal('d', token.value);
  const field = token.field === 'text' ? "d.field <> 'context'" : 'd.field = ?';
  const params = token.field === 'text' ? [] : [token.field];
  const scope = opAlias
    ? ` AND (d.field NOT IN ('output','error','arguments') OR d.operation_span_id = ${opAlias}.span_id)`
    : '';
  return {
    sql: `${field} AND ${text.sql}${scope}`,
    params: [...params, ...text.params],
  };
}
function textPredicate(token, opAlias) {
  const doc = docPredicate(token, opAlias);
  const exists = `EXISTS (SELECT 1 FROM documents d WHERE d.trace_pk=t.pk AND ${doc.sql})`;
  if (token.field !== 'text') return { sql: exists, params: doc.params };
  return {
    sql: `(${exists} OR EXISTS (SELECT 1 FROM names n WHERE n.trace_pk=t.pk AND n.kind IN ('trace','label','agent') AND instr(n.folded,?)>0))`,
    params: [...doc.params, fold(token.value)],
  };
}
function compile(parsed) {
  const conditions = [],
    params = [],
    opConditions = [],
    opParams = [];
  const withTool = parsed.tokens.some(
    (token) => token.field === 'tool' || token.field === 'tool.status'
  );
  for (const token of parsed.tokens) {
    const { field, value } = token;
    if (field === 'tool') {
      opConditions.push('o.tool_folded=?');
      opParams.push(fold(value));
    } else if (field === 'tool.status') opConditions.push('o.status=2');
    else if (['agent', 'trace', 'session'].includes(field)) {
      conditions.push(
        'EXISTS (SELECT 1 FROM names n WHERE n.trace_pk=t.pk AND n.kind=? AND n.folded=?)'
      );
      params.push(field, fold(value));
    } else if (field === 'duration') {
      conditions.push(`t.duration_ms ${token.comparison.operator} ?`);
      params.push(token.comparison.ms);
    } else if (field === 'has') conditions.push('t.errors>0');
    else {
      const expression = textPredicate(token, withTool ? 'o' : undefined);
      // Tool filters and scoped payload predicates share a single operation.
      if (withTool && (field === 'text' || scopedFields.includes(field))) {
        opConditions.push(expression.sql);
        opParams.push(...expression.params);
      } else {
        conditions.push(expression.sql);
        params.push(...expression.params);
      }
    }
  }
  const operation = {
    sql: opConditions.join(' AND ') || '1',
    params: opParams,
  };
  if (withTool) {
    conditions.push(
      `EXISTS (SELECT 1 FROM operations o WHERE o.trace_pk=t.pk AND ${operation.sql})`
    );
    params.push(...opParams);
  }
  return { sql: conditions.join(' AND ') || '1', params, operation, withTool };
}

export class TraceSearchIndex {
  constructor(
    path,
    sources,
    helpers,
    { maxTraceBytes = 64 * 1024 * 1024, maxSegments = 10000 } = {}
  ) {
    this.sources = sources;
    this.helpers = helpers;
    this.maxTraceBytes = maxTraceBytes;
    this.maxSegments = maxSegments;
    this.db = new DatabaseSync(path, { timeout: 5000 });
    try {
      this.db.exec(
        'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;'
      );
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 0 && version !== 1)
        throw new Error(
          'Search index version is incompatible. Stop Even and remove its .even/search-v1.sqlite cache to rebuild.'
        );
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), epoch TEXT NOT NULL, revision INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS traces (
          pk INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, trace_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL, projection_hash TEXT NOT NULL, retry INTEGER NOT NULL,
          summary TEXT NOT NULL, started_ms REAL NOT NULL, duration_ms REAL NOT NULL,
          errors INTEGER NOT NULL, input_tokens REAL NOT NULL, UNIQUE(agent_id,trace_id));
        CREATE INDEX IF NOT EXISTS trace_order ON traces(started_ms DESC,pk);
        CREATE TABLE IF NOT EXISTS names (trace_pk INTEGER NOT NULL REFERENCES traces(pk) ON DELETE CASCADE, kind TEXT NOT NULL, value TEXT NOT NULL, folded TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS name_filter ON names(kind,folded,trace_pk);
        CREATE TABLE IF NOT EXISTS operations (trace_pk INTEGER NOT NULL REFERENCES traces(pk) ON DELETE CASCADE, span_id TEXT NOT NULL, tool TEXT, tool_folded TEXT, status INTEGER NOT NULL, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS operation_filter ON operations(tool_folded,status,trace_pk);
        CREATE INDEX IF NOT EXISTS operation_trace ON operations(trace_pk,span_id);
        CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, trace_pk INTEGER NOT NULL REFERENCES traces(pk) ON DELETE CASCADE, field TEXT NOT NULL, operation_span_id TEXT, folded TEXT NOT NULL, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS document_trace ON documents(trace_pk,field,operation_span_id);
        CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(folded,content='documents',content_rowid='id',tokenize='trigram case_sensitive 1');
        CREATE TRIGGER IF NOT EXISTS document_insert AFTER INSERT ON documents BEGIN INSERT INTO document_fts(rowid,folded) VALUES(new.id,new.folded); END;
        CREATE TRIGGER IF NOT EXISTS document_delete AFTER DELETE ON documents BEGIN INSERT INTO document_fts(document_fts,rowid,folded) VALUES('delete',old.id,old.folded); END;
        PRAGMA user_version=1; COMMIT;`);
      this.db
        .prepare('INSERT OR IGNORE INTO state VALUES(1,?,0)')
        .run(randomUUID());
      this.db.exec(
        "INSERT INTO document_fts(document_fts,rank) VALUES('secure-delete',1)"
      );
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  change(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      work();
      this.db.exec('UPDATE state SET revision=revision+1 WHERE id=1; COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  remove(pk) {
    this.change(() => this.db.prepare('DELETE FROM traces WHERE pk=?').run(pk));
  }
  put(agentId, traceId, fingerprint, projection, retry) {
    const payload = JSON.stringify(projection),
      digest = hash(payload);
    const previous = this.db
      .prepare('SELECT * FROM traces WHERE agent_id=? AND trace_id=?')
      .get(agentId, traceId);
    if (
      previous?.fingerprint === fingerprint &&
      previous.projection_hash === digest &&
      previous.retry === Number(retry)
    )
      return;
    this.change(() => {
      if (previous)
        this.db.prepare('DELETE FROM traces WHERE pk=?').run(previous.pk);
      const summary = projection.summary;
      const { lastInsertRowid: pk } = this.db
        .prepare(
          'INSERT INTO traces(agent_id,trace_id,fingerprint,projection_hash,retry,summary,started_ms,duration_ms,errors,input_tokens) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(
          agentId,
          traceId,
          fingerprint,
          digest,
          Number(retry),
          JSON.stringify(summary),
          Date.parse(summary.startedAt),
          summary.durationMs,
          summary.errorSpanCount,
          summary.inputTokens
        );
      const name = this.db.prepare('INSERT INTO names VALUES(?,?,?,?)');
      for (const [kind, value] of projection.names)
        name.run(pk, kind, value, fold(value));
      const op = this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?)');
      for (const value of projection.operations)
        op.run(
          pk,
          value.spanId,
          value.tool ?? null,
          value.tool ? fold(value.tool) : null,
          value.status,
          JSON.stringify(value)
        );
      const doc = this.db.prepare(
        'INSERT INTO documents(trace_pk,field,operation_span_id,folded,data) VALUES(?,?,?,?,?)'
      );
      for (const value of projection.documents)
        doc.run(
          pk,
          value.field,
          value.operationSpanId ?? null,
          fold(value.text),
          JSON.stringify(value)
        );
    });
  }
  async files(source, traceId) {
    const names = await this.helpers.listLocalTraceSegments(
      source.appRoot,
      traceId
    );
    if (names === undefined) return undefined;
    const files = [];
    for (const name of names) {
      const info = await lstat(
        join(source.appRoot, '.eve/traces/v1', traceId, 'segments', name),
        { bigint: true }
      );
      if (!info.isFile())
        throw new Error('A segment changed while indexing. Retry the search.');
      files.push({
        name,
        size: Number(info.size),
        signature: `${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`,
      });
    }
    return files;
  }
  async refresh() {
    const coverage = {
      complete: true,
      discoveredTraces: 0,
      indexedTraces: 0,
      unreadableSegments: 0,
      skippedTraces: 0,
      issues: [],
      checkedAt: new Date().toISOString(),
    };
    const available = [];
    const report = (agentId, traceId, message) => {
      coverage.complete = false;
      if (coverage.issues.length < 20)
        coverage.issues.push({
          agentId,
          ...(traceId ? { traceId } : {}),
          message,
        });
    };
    // Reconcile removed workspace members as well as source retention.
    const sourceIds = new Set(this.sources.map((source) => source.id));
    for (const row of this.db.prepare('SELECT pk,agent_id FROM traces').all())
      if (!sourceIds.has(row.agent_id)) this.remove(row.pk);
    for (const source of this.sources) {
      let ids;
      try {
        ids = await this.helpers.listLocalTraceIds(source.appRoot);
      } catch {
        report(source.id, undefined, 'Trace source could not be listed.');
        continue;
      }
      available.push(source.id);
      coverage.discoveredTraces += ids.length;
      const present = new Set(ids);
      const stale = this.db
        .prepare('SELECT pk,trace_id FROM traces WHERE agent_id=?')
        .all(source.id)
        .filter((row) => !present.has(row.trace_id));
      for (const row of stale) this.remove(row.pk);
      for (const traceId of ids) {
        const previous = this.db
          .prepare(
            'SELECT pk,fingerprint,retry FROM traces WHERE agent_id=? AND trace_id=?'
          )
          .get(source.id, traceId);
        try {
          const files = await this.files(source, traceId);
          if (!files?.length) {
            if (previous) this.remove(previous.pk);
            continue;
          }
          if (
            files.length > this.maxSegments ||
            files.reduce((sum, file) => sum + file.size, 0) > this.maxTraceBytes
          )
            throw new Error(
              `Trace exceeds the search indexing limit (${this.maxTraceBytes} bytes or ${this.maxSegments} segments).`
            );
          const fingerprint = fingerprintFiles(files);
          if (previous?.fingerprint === fingerprint && !previous.retry) {
            coverage.indexedTraces++;
            continue;
          }
          const spans = [];
          let unreadable = 0;
          for (const file of files) {
            const parsed = await this.helpers.readLocalTraceSegment(
              source.appRoot,
              traceId,
              file.name
            );
            if (!parsed.length) unreadable++;
            else spans.push(...parsed);
          }
          // Do not checkpoint a moving snapshot; filenames alone are insufficient
          // to notice replacement, redaction, or removal of an existing segment.
          const after = await this.files(source, traceId);
          if (fingerprintFiles(after) !== fingerprint)
            throw new Error('Trace changed while indexing. Retry the search.');
          coverage.unreadableSegments += unreadable;
          if (unreadable)
            report(
              source.id,
              traceId,
              'One or more segments could not be parsed; they will be retried.'
            );
          if (!spans.length) {
            if (previous) this.remove(previous.pk);
            coverage.skippedTraces++;
            continue;
          }
          const projection = projectTrace(
            source.id,
            traceId,
            spans,
            this.helpers
          );
          this.put(source.id, traceId, fingerprint, projection, unreadable > 0);
          coverage.indexedTraces++;
        } catch (error) {
          // Changed or unreadable source data must not leave old payloads searchable.
          if (
            previous &&
            this.db.prepare('SELECT 1 FROM traces WHERE pk=?').get(previous.pk)
          )
            this.remove(previous.pk);
          coverage.skippedTraces++;
          report(source.id, traceId, error.message);
        }
      }
    }
    return { coverage, available };
  }
  explain(row, parsed, compiled) {
    const evidence = [];
    let truncated = false;
    let witnesses = [];
    if (compiled.withTool)
      witnesses = this.db
        .prepare(
          `SELECT o.data FROM operations o JOIN traces t ON t.pk=o.trace_pk WHERE t.pk=? AND ${compiled.operation.sql} LIMIT 11`
        )
        .all(row.pk, ...compiled.operation.params)
        .map((value) => JSON.parse(value.data));
    const add = (value) => evidence.push(value);
    for (const token of parsed.tokens) {
      if (token.field === 'tool' || token.field === 'tool.status') {
        for (const op of witnesses)
          add({
            field: 'tool',
            text: `${op.tool ?? 'Unknown tool'}${op.status === 2 ? ' · recorded error' : ''}`,
            spanId: token.field === 'tool.status' ? op.statusSpanId : op.spanId,
            operationSpanId: op.spanId,
            operation: op.name,
            source:
              token.field === 'tool.status' ? 'statusCode' : op.toolSource,
            term: token.field === 'tool' ? token.value : 'recorded error',
          });
      } else if (token.field === 'duration')
        add({
          field: 'duration',
          text: `${JSON.parse(row.summary).durationMs} ms elapsed`,
          term: '',
        });
      else if (token.field === 'has') {
        const firstError = JSON.parse(row.summary).firstError;
        const doc = this.db
          .prepare(
            "SELECT data FROM documents WHERE trace_pk=? AND field='error' AND json_extract(data,'$.spanId')=? LIMIT 1"
          )
          .get(row.pk, firstError?.spanId ?? '');
        add(
          doc
            ? { ...JSON.parse(doc.data), term: '' }
            : {
                field: 'error',
                text: 'This trace contains recorded errors',
                spanId: firstError?.spanId,
                operation: firstError?.name,
                source: 'statusCode',
                term: 'recorded errors',
              }
        );
      } else if (['agent', 'trace', 'session'].includes(token.field)) {
        const name = this.db
          .prepare(
            'SELECT value FROM names WHERE trace_pk=? AND kind=? AND folded=? LIMIT 1'
          )
          .get(row.pk, token.field, fold(token.value));
        if (name)
          add({ field: token.field, text: name.value, term: token.value });
      } else {
        const predicate = docPredicate(token);
        const scope = compiled.withTool
          ? ` AND (d.field NOT IN ('output','error','arguments') OR d.operation_span_id IN (${witnesses.map(() => '?').join(',')}))`
          : '';
        const docs = this.db
          .prepare(
            `SELECT d.data FROM documents d WHERE d.trace_pk=? AND ${predicate.sql}${scope} LIMIT 11`
          )
          .all(
            row.pk,
            ...predicate.params,
            ...(compiled.withTool ? witnesses.map((op) => op.spanId) : [])
          );
        for (const doc of docs)
          add({ ...JSON.parse(doc.data), term: token.value });
        if (docs.length > 10) truncated = true;
        if (token.field === 'text') {
          const name = this.db
            .prepare(
              "SELECT kind,value FROM names WHERE trace_pk=? AND kind IN ('agent','trace','label') AND instr(folded,?)>0 LIMIT 1"
            )
            .get(row.pk, fold(token.value));
          if (name)
            add({ field: name.kind, text: name.value, term: token.value });
        }
      }
    }
    const unique = [
      ...new Map(
        evidence.map((item) => [
          `${item.spanId}:${item.field}:${item.source}:${item.path}:${item.text}`,
          item,
        ])
      ).values(),
    ];
    unique.sort(
      (a, b) =>
        Number(textFields.includes(b.field)) -
          Number(textFields.includes(a.field)) ||
        Number(!!b.spanId) - Number(!!a.spanId)
    );
    return {
      matches: unique.slice(0, 10).map(({ text, ...item }) => ({
        ...item,
        term: matchExcerpt({ text, term: item.term }, 160).term,
        excerpt: matchExcerpt({ text, term: item.term }, 160).text,
      })),
      matchesTruncated: truncated || unique.length > 10,
    };
  }
  async search(input) {
    const options = validateSearch(input);
    if (
      options.agentId !== undefined &&
      !this.sources.some((source) => source.id === options.agentId)
    )
      throw badRequest('Select an agentId from this project inventory.');
    const { coverage, available } = await this.refresh();
    const compiled = compile(options.parsed);
    const scopes = available.filter(
      (id) => options.agentId === undefined || options.agentId === id
    );
    this.db.exec('BEGIN');
    try {
      const state = this.db.prepare('SELECT * FROM state WHERE id=1').get();
      const identity = hash(
        JSON.stringify([options.q, options.agentId, options.sort])
      );
      const scopeHash = hash(JSON.stringify(scopes));
      let cursor;
      if (options.cursor !== undefined) {
        try {
          cursor = JSON.parse(
            Buffer.from(options.cursor, 'base64url').toString()
          );
          if (
            cursor.query !== identity ||
            typeof cursor.scope !== 'string' ||
            typeof cursor.epoch !== 'string' ||
            !Number.isSafeInteger(cursor.revision) ||
            !Number.isSafeInteger(cursor.pk) ||
            cursor.pk <= 0 ||
            !Number.isFinite(cursor.value)
          )
            throw new Error();
        } catch {
          throw badRequest(
            'Invalid cursor or cursor does not belong to this query.'
          );
        }
        if (
          cursor.scope !== scopeHash ||
          cursor.epoch !== state.epoch ||
          cursor.revision !== state.revision
        )
          throw Object.assign(
            new Error(
              'Search data changed. Restart pagination without a cursor.'
            ),
            { status: 409 }
          );
      }
      const where = `${scopes.length ? `t.agent_id IN (${scopes.map(() => '?').join(',')})` : '0'} AND (${compiled.sql})`;
      const params = [...scopes, ...compiled.params];
      const total = this.db
        .prepare(`SELECT COUNT(*) AS count FROM traces t WHERE ${where}`)
        .get(...params).count;
      const column = orderColumns[options.sort];
      const paging = cursor
        ? ` AND (t.${column} < ? OR (t.${column} = ? AND t.pk > ?))`
        : '';
      const rows = this.db
        .prepare(
          `SELECT t.* FROM traces t WHERE ${where}${paging} ORDER BY t.${column} DESC,t.pk ASC LIMIT ?`
        )
        .all(
          ...params,
          ...(cursor ? [cursor.value, cursor.value, cursor.pk] : []),
          options.limit + 1
        );
      const page = rows.slice(0, options.limit);
      const last = page.at(-1);
      const nextCursor =
        rows.length > options.limit
          ? Buffer.from(
              JSON.stringify({
                epoch: state.epoch,
                scope: scopeHash,
                revision: state.revision,
                query: identity,
                pk: last.pk,
                value: last[column],
              })
            ).toString('base64url')
          : null;
      const results = page.map((row) => ({
        trace: JSON.parse(row.summary),
        ...this.explain(row, options.parsed, compiled),
      }));
      this.db.exec('COMMIT');
      return { results, total, nextCursor, coverage };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
