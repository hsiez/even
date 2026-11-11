import { createEveClient } from './eve-client.js';
import { startRuntime } from './runtime.js';

export function createSessions(adapter, { eveHeaders } = {}) {
  let closed = false;
  const connections = new Map();
  const sessions = new Map();
  async function connection(agentId) {
    if (closed) throw new Error('Execution is closed.');
    const agent = adapter.selectAgent(agentId);
    let entry = connections.get(agent.id);
    if (!entry) {
      const runtime = startRuntime(agent.appRoot);
      entry = { runtime, agentId: agent.id, status: 'starting' };
      connections.set(agent.id, entry);
      entry.promise = (async () => {
        const ready = await runtime.ready;
        entry.status = ready.ownership;
        entry.url = ready.url;
        return createEveClient(adapter, ready.url, eveHeaders);
      })().catch(async error => {
        entry.status = 'failed';
        await runtime.close();
        connections.delete(agent.id);
        throw error;
      });
    }
    if (!entry.runtime.alive) throw new Error('Eve connection has stopped. Restart Even to execute again.');
    return { client: await entry.promise, agent };
  }
  function get(id) {
    const entry = sessions.get(id);
    if (!entry) throw Object.assign(new Error('Session not found in this Even launch.'), { status: 404 });
    return entry.session;
  }
  return {
    async create(agentId) {
      const { client, agent } = await connection(agentId);
      const { session } = await client.sessions.create();
      sessions.set(session.id, { session, agentId: agent.id });
      return { id: session.id, agentId: agent.id };
    },
    async runtime(agentId) {
      const entry = connections.get(agentId);
      if (!entry) return { state: 'disconnected', ownership: null };
      if (entry.status === 'starting') return { state: 'starting', ownership: null };
      const { readDevelopmentRuntimeArtifactsRevision } = await adapter.internal('services/dev-client/runtime-artifacts.js');
      const revision = entry.runtime.alive
        ? await readDevelopmentRuntimeArtifactsRevision({ serverUrl: entry.url, timeoutMs: 1000 })
        : undefined;
      return {
        state: revision === undefined ? 'unavailable' : 'ready',
        ownership: entry.status,
        url: entry.url,
      };
    },
    list(agentId) {
      if (agentId !== undefined) adapter.selectAgent(agentId);
      return [...sessions].filter(([, entry]) => agentId === undefined || entry.agentId === agentId)
        .map(([id, entry]) => ({ id, agentId: entry.agentId }));
    },
    async send(id, message) {
      const delivery = await get(id).send(message);
      return { sessionId: delivery.sessionId, deliveryId: delivery.deliveryId };
    },
    get,
    async close() {
      closed = true;
      await Promise.all([...connections.values()].map(async entry => {
        await entry.runtime.close();
        await entry.promise.catch(() => {});
      }));
    },
  };
}

export function parseCursor(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+:\d+$/.test(value)) throw Object.assign(new Error('Invalid event cursor.'), { status: 400 });
  const [line, index] = value.split(':').map(Number);
  if (!Number.isSafeInteger(line) || !Number.isSafeInteger(index)) throw Object.assign(new Error('Invalid event cursor.'), { status: 400 });
  return { line, index };
}

export async function* replayEvents(session, { cursor, follow, signal }) {
  let caughtUp = false;
  for await (const event of session.stream({
    startIndex: cursor?.line ?? 0, follow, signal, reconnect: false,
    onCaughtUp: follow === false ? () => { caughtUp = true; } : undefined,
  })) {
    const { line, index } = event.meta.position;
    if (cursor && (line < cursor.line || (line === cursor.line && index <= cursor.index))) continue;
    yield { id: line + ':' + index, event };
  }
  if (follow === false && !signal?.aborted && !caughtUp) {
    throw new Error('Replay ended before reaching the captured history tail.');
  }
}
