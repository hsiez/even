import { randomUUID } from 'node:crypto';

export function createReloadMonitor(adapter, { intervalMs = 1000 } = {}) {
  const entries = new Map();
  let closed = false;
  let helpers;

  async function readRevision(appRoot) {
    helpers ??= Promise.all([
      adapter.internal('internal/nitro/host/dev-server-state.js'),
      adapter.internal('services/dev-client/runtime-artifacts.js'),
    ]);
    const [{ DevelopmentServerState }, { readDevelopmentRuntimeArtifactsRevision }] = await helpers;
    const address = await new DevelopmentServerState({ appRoot }).read();
    if (!address) return;
    const url = new URL(address);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) return;
    return readDevelopmentRuntimeArtifactsRevision({ serverUrl: url.href, timeoutMs: 1000 });
  }

  function sample(entry) {
    if (entry.pending) return entry.pending;
    clearTimeout(entry.timer);
    entry.pending = (async () => {
      let revision;
      try { revision = await readRevision(entry.appRoot); } catch { revision = undefined; }
      entry.available = typeof revision === 'string' && revision.length > 0;
      if (!entry.available) return;
      if (entry.revision !== undefined && revision !== entry.revision) {
        entry.reloads.push({ id: randomUUID(), type: 'agent.reloaded', observedAt: new Date().toISOString() });
      }
      entry.revision = revision;
    })().finally(() => {
      entry.pending = undefined;
      if (!closed) entry.timer = setTimeout(() => { void sample(entry); }, intervalMs).unref();
    });
    return entry.pending;
  }

  return {
    async list(agentId) {
      if (closed) throw new Error('Reload observation is closed.');
      const agent = adapter.selectAgent(agentId);
      let entry = entries.get(agent.appRoot);
      if (!entry) {
        entry = { appRoot: agent.appRoot, observingSince: new Date().toISOString(), reloads: [], available: false };
        entries.set(agent.appRoot, entry);
      }
      await sample(entry);
      return { observingSince: entry.observingSince, available: entry.available, reloads: entry.reloads.map(item => ({ ...item })) };
    },
    async close() {
      closed = true;
      for (const entry of entries.values()) clearTimeout(entry.timer);
      await Promise.allSettled([...entries.values()].map(entry => entry.pending));
    },
  };
}
