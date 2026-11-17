import { Worker } from 'node:worker_threads';
import { validateSearch } from './index.js';

// A lazy worker keeps passive inventory/session APIs independent of indexing.
export function createTraceSearch(adapter) {
  let worker,
    sequence = 0,
    closed = false;
  const pending = new Map();
  const unavailable = (message) =>
    Object.assign(new Error(message), { status: 503 });
  function rejectPending(error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  function start() {
    if (
      typeof adapter.project !== 'string' ||
      typeof adapter.traceSources !== 'function'
    )
      throw unavailable('Trace search requires a project-backed Eve adapter.');
    const active = new Worker(new URL('./worker.js', import.meta.url), {
      workerData: { project: adapter.project },
      // This worker is plain JS. Host/test/entrypoint flags can be invalid for
      // workers, including --input-type and V8 options expanded by node --test.
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    worker = active;
    active.on('message', ({ id, result, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error)
        request.reject(
          Object.assign(new Error(error.message), { status: error.status })
        );
      else request.resolve(result);
    });
    active.on('error', (error) => {
      if (worker !== active) return;
      worker = undefined;
      rejectPending(
        unavailable(
          `Trace search worker failed (${error.code ?? 'runtime error'}). Retry the request.`
        )
      );
    });
    active.on('exit', () => {
      if (worker !== active) return;
      worker = undefined;
      rejectPending(
        unavailable('Trace search worker stopped. Retry the request.')
      );
    });
  }
  return {
    async search(input) {
      validateSearch(input);
      if (closed) throw unavailable('Trace search is closed.');
      if (input.agentId !== undefined) adapter.selectAgent(input.agentId);
      if (pending.size >= 16)
        throw unavailable('Trace search is busy. Retry shortly.');
      if (!worker) start();
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          worker.postMessage({ id, options: input });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    },
    async close() {
      closed = true;
      rejectPending(unavailable('Trace search is closed.'));
      const active = worker;
      worker = undefined;
      await active?.terminate();
    },
  };
}
