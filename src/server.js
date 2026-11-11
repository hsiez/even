import { createSessions, parseCursor, replayEvents } from './sessions.js';
import { once } from 'node:events';
import polka from 'polka';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export async function startServer(adapter, { port = 0, eveHeaders } = {}) {
  const token = randomBytes(32).toString('hex');
  const expected = Buffer.from('Bearer ' + token);
  const app = polka();
  const sessions = createSessions(adapter, { eveHeaders });
  function json(response, status, value) {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
  }
  app.use((request, response, next) => {
    // Reject browser cross-origin traffic and DNS rebinding before routing.
    if (request.headers.origin || !/^127\.0\.0\.1:\d+$/.test(request.headers.host ?? '')) {
      return json(response, 403, { error: 'Forbidden origin or host' });
    }
    const actual = Buffer.from(request.headers.authorization ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return json(response, 401, { error: 'Bearer authentication required' });
    }
    next();
  });
  app.get('/api/v1/agents', async (_request, response) => {
    try {
      const inventory = await adapter.inventory();
      const agents = await Promise.all(inventory.agents.map(async agent => ({
        ...agent, runtime: await sessions.runtime(agent.id),
      })));
      json(response, 200, { ...inventory, agents });
    } catch (error) {
      json(response, 422, { error: error.message });
    }
  });
  app.get('/api/v1/agents/:agentId/traces', async (request, response) => {
    try {
      const agentId = request.params.agentId;
      json(response, 200, { traces: await adapter.traces(undefined, agentId, request.query.sessionId) });
    } catch (error) {
      json(response, error.status ?? 500, { error: error.message });
    }
  });
  app.get('/api/v1/agents/:agentId/traces/:traceId', async (request, response) => {
    try {
      const trace = await adapter.traces(request.params.traceId, request.params.agentId);
      json(response, trace ? 200 : 404, trace ?? { error: 'Trace not found' });
    } catch (error) {
      json(response, error.status ?? 500, { error: error.message });
    }
  });

  async function body(request) {
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
      throw Object.assign(new Error('Expected application/json.'), { status: 415 });
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) throw Object.assign(new Error('Request body exceeds 64 KiB.'), { status: 413 });
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
      return value;
    } catch {
      throw Object.assign(new Error('Expected a JSON object.'), { status: 400 });
    }
  }
  app.get('/api/v1/sessions', (request, response) => {
    try {
      const agentId = new URL(request.url, 'http://localhost').searchParams.get('agentId') ?? undefined;
      json(response, 200, { sessions: sessions.list(agentId) });
    } catch (error) { json(response, error.status ?? 500, { error: error.message }); }
  });
  app.post('/api/v1/sessions', async (request, response) => {
    try {
      const input = await body(request);
      if (Object.keys(input).some(key => key !== 'agentId') || (input.agentId !== undefined && typeof input.agentId !== 'string')) {
        throw Object.assign(new Error('Expected an agentId string.'), { status: 400 });
      }
      json(response, 201, await sessions.create(input.agentId));
    } catch (error) { json(response, error.status ?? 502, { error: error.message }); }
  });
  app.post('/api/v1/sessions/:sessionId/messages', async (request, response) => {
    try {
      sessions.get(request.params.sessionId);
      const input = await body(request);
      if (Object.keys(input).some(key => key !== 'message') || typeof input.message !== 'string' || !input.message.trim()) {
        throw Object.assign(new Error('Expected a nonempty message string.'), { status: 400 });
      }
      json(response, 202, await sessions.send(request.params.sessionId, input.message));
    } catch (error) { json(response, error.status ?? 502, { error: error.message }); }
  });
  app.get('/api/v1/sessions/:sessionId/events', async (request, response) => {
    const controller = new AbortController();
    response.once('close', () => controller.abort());
    try {
      const session = sessions.get(request.params.sessionId);
      const query = new URL(request.url, 'http://localhost').searchParams;
      const cursor = parseCursor(request.headers['last-event-id'] ?? query.get('after') ?? undefined);
      const follow = query.get('follow') !== 'false';
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      response.flushHeaders();
      for await (const item of replayEvents(session, { cursor, follow, signal: controller.signal })) {
        if (!response.write('id: ' + item.id + '\nevent: eve\ndata: ' + JSON.stringify(item.event) + '\n\n')) {
          await once(response, 'drain', { signal: controller.signal });
        }
      }
      response.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!response.headersSent) json(response, error.status ?? 502, { error: error.message });
      else response.end('event: error\ndata: ' + JSON.stringify({ error: error.message }) + '\n\n');
    }
  });
  await new Promise((resolve, reject) => {
    app.listen(port, '127.0.0.1', resolve);
    app.server.once('error', reject);
  });
  return {
    url: 'http://127.0.0.1:' + app.server.address().port,
    token,
    async close() {
      const closed = new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
      app.server.closeAllConnections();
      await sessions.close();
      await closed;
    },
  };
}
