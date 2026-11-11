// Isolate Eve's environment and launcher from Even's HTTP server.
import lockfile from 'proper-lockfile';
import { loadEve } from './eve-adapter.js';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

let server;
let stopping;
const startup = start();

function send(message) {
  if (process.connected) process.send(message);
}

async function start() {
  const adapter = await loadEve(process.cwd());
  const { resolveDiscoveryProject } = await adapter.internal('discover/project.js');
  const roots = await resolveDiscoveryProject(adapter.project);
  if (roots.appRoot !== adapter.project) {
    throw new Error('Select the Eve application root for execution: ' + roots.appRoot);
  }
  try {
    if (!(await stat(join(adapter.project, '.eve'))).isDirectory()) {
      throw new Error('The project .eve path must resolve to a directory.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const { loadDevelopmentEnvironmentFiles } = await adapter.internal('cli/dev/environment.js');
  await loadDevelopmentEnvironmentFiles(adapter.project);
  delete process.env.EVE_DEV_STATE_DIR;
  const { DevelopmentServerState } = await adapter.internal('internal/nitro/host/dev-server-state.js');
  const { readDevelopmentRuntimeArtifactsRevision } = await adapter.internal('services/dev-client/runtime-artifacts.js');
  const state = new DevelopmentServerState({ appRoot: adapter.project });
  async function existing() {
    const url = await state.read();
    if (!url) return;
    const parsed = new URL(url);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.username || parsed.password) return;
    if (await readDevelopmentRuntimeArtifactsRevision({ serverUrl: url, timeoutMs: 1000 }) !== undefined) return url;
  }
  const release = await lockfile.lock(adapter.project, {
    lockfilePath: join(adapter.project, '.even-startup.lock'),
    retries: { retries: 180, minTimeout: 1000, maxTimeout: 1000 },
  });
  try {
    const url = await existing();
    if (url) {
      send({ type: 'ready', url, ownership: 'attached' });
      return;
    }
    const { createDevelopmentServer } = await adapter.internal('cli/dev/local-server-process.js');
    server = createDevelopmentServer(adapter.project, {
      host: '127.0.0.1', port: 0, existing: 'reject', output: 'stderr',
      developmentExtensions: { enabled: [] },
    });
    try {
      const handle = await server.start();
      send({ type: 'ready', url: handle.url, ownership: 'started' });
    } catch (error) {
      await server.close();
      server = undefined;
      const url = await existing();
      if (!url) throw error;
      send({ type: 'ready', url, ownership: 'attached' });
      return;
    }
  } finally {
    await release();
  }
  server.wait().catch(error => {
    send({ type: 'error', message: error.message });
    stop(1);
  });
}

function stop(code = 0) {
  return stopping ??= (async () => {
    await startup.catch(() => {});
    await server?.close();
    process.exit(code);
  })();
}

process.on('message', message => {
  if (message?.type === 'close') stop();
});
process.once('disconnect', () => stop());
process.once('SIGTERM', () => stop());
process.once('SIGINT', () => stop());
startup.catch(error => {
  send({ type: 'error', message: error.message });
  stop(1);
});
