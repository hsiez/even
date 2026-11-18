import { createSessions, parseCursor, replayEvents } from './sessions.js';
import { createReloadMonitor } from './reloads.js';
import { createTraceSearch } from './search/service.js';
import { serveBrowser } from './browser.js';
import { once } from 'node:events';
import polka from 'polka';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export async function startServer(adapter, { port = 0, eveHeaders, traceSearch = createTraceSearch(adapter), browserDirectory } = {}) {
  const token = randomBytes(32).toString('hex');
  const expected = Buffer.from('Bearer ' + token);
  const browserSecret = randomBytes(32).toString('hex');
  const browserExpected = Buffer.from(browserSecret);
  const app = polka();
  const sessions = createSessions(adapter, { eveHeaders });
  const reloads = createReloadMonitor(adapter);
  function json(response, status, value) {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
  }
  app.use(async (request, response, next) => {
    const host = '127.0.0.1:' + app.server.address().port;
    const origin = 'http://' + host;
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    // Browser writes may carry our exact origin. Foreign origins, null origins,
    // and alternate Host headers remain forbidden before routing or file access.
    if (request.headers.host !== host || (request.headers.origin !== undefined && request.headers.origin !== origin)) {
      return json(response, 403, { error: 'Forbidden origin or host' });
    }
    let pathname;
    try {
      const target = new URL(request.url, origin);
      if (target.origin !== origin) return json(response, 403, { error: 'Forbidden request target' });
      pathname = target.pathname;
    } catch { return json(response, 400, { error: 'Invalid request target' }); }
    if (!pathname.startsWith('/api/')) return serveBrowser(request, response, pathname, browserDirectory);
    const actual = Buffer.from(request.headers.authorization ?? '');
    const bearer = actual.length === expected.length && timingSafeEqual(actual, expected);
    const cookieName = 'even_browser_' + app.server.address().port;
    const cookies = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(cookieName + '='));
    const cookie = Buffer.from(cookies.length === 1 ? cookies[0].slice(cookieName.length + 1) : '');
    const sameOriginBrowser = request.headers['sec-fetch-site'] === 'same-origin' || request.headers.origin === origin;
    const browserSession = sameOriginBrowser && cookie.length === browserExpected.length && timingSafeEqual(cookie, browserExpected);
    // An explicit Authorization header must itself be valid; cookies do not
    // turn invalid programmatic credentials into a successful request.
    if (!(request.headers.authorization !== undefined ? bearer : browserSession)) {
      return json(response, 401, { error: 'Even authentication required' });
    }
    next();
  });
  app.post('/api/v1/browser-session', (request, response) => {
    const actual = Buffer.from(request.headers.authorization ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return json(response, 401, { error: 'Launch bearer token required' });
    }
    // Cookie names include the port so simultaneous Even launches can coexist.
    // No expiry makes this a browser-session cookie; its value rotates at launch.
    response.setHeader('set-cookie', 'even_browser_' + app.server.address().port + '=' + browserSecret + '; Path=/api/v1; HttpOnly; SameSite=Strict');
    json(response, 200, { connected: true });
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
  app.get('/api/v1/traces/search', async (request, response) => {
    try {
      const query = new URL(request.url, 'http://localhost').searchParams;
      const allowed = new Set(['q', 'agentId', 'sort', 'direction', 'limit', 'cursor']);
      for (const key of query.keys()) {
        if (!allowed.has(key) || query.getAll(key).length !== 1) throw Object.assign(new Error('Unknown or repeated search parameter: ' + key), { status: 400 });
      }
      const input = Object.fromEntries(query);
      if (input.limit !== undefined) {
        if (!/^[1-9]\d*$/.test(input.limit)) throw Object.assign(new Error('limit must be an integer from 1 to 100.'), { status: 400 });
        input.limit = Number(input.limit);
      }
      json(response, 200, await traceSearch.search(input));
    } catch (error) { json(response, error.status ?? 503, { error: error.message }); }
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
  app.get('/api/v1/agents/:agentId/reloads', async (request, response) => {
    try {
      json(response, 200, await reloads.list(request.params.agentId));
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
  const url = 'http://127.0.0.1:' + app.server.address().port;
  return {
    url,
    browserUrl: url + '/#token=' + token,
    token,
    async close() {
      const closed = new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
      app.server.closeAllConnections();
      await traceSearch.close();
      await reloads.close();
      await sessions.close();
      await closed;
    },
  };
}
