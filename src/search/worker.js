import { parentPort, workerData } from 'node:worker_threads';
import { mkdir, open, chmod, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEve } from '../eve-adapter.js';
import { TraceSearchIndex } from './index.js';

let index;
const ready = (async () => {
  const adapter = await loadEve(workerData.project);
  const modules = await Promise.all([
    adapter.internal('tracing/local/trace-reader.js'),
    adapter.internal('tracing/local/trace-summary.js'),
    adapter.internal('tracing/local/trace-operations.js'),
  ]);
  const directory = join(adapter.project, '.even');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error('Search cache directory must not be a symbolic link.');
  const path = join(directory, 'search-v1.sqlite');
  try {
    const file = await open(path, 'wx', 0o600);
    await file.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
    throw new Error('Search cache must be a regular, unlinked file.');
  await chmod(path, 0o600);
  index = new TraceSearchIndex(
    path,
    adapter.traceSources(),
    Object.assign({}, ...modules)
  );
})();
// Handle startup failure through the same request protocol; no unhandled rejection.
ready.catch(() => {});
let queue = Promise.resolve();
parentPort.on('message', ({ id, options }) => {
  queue = queue.then(async () => {
    try {
      await ready;
      parentPort.postMessage({ id, result: await index.search(options) });
    } catch (error) {
      parentPort.postMessage({
        id,
        error: { message: error.message, status: error.status ?? 503 },
      });
    }
  });
});
