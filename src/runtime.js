import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function startRuntime(project) {
  const child = fork(fileURLToPath(new URL('./runtime-child.js', import.meta.url)), [], {
    cwd: project,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    execArgv: [],
  });
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    child.on('message', message => {
      if (message.type === 'ready') {
        settled = true;
        resolve(message);
      } else if (message.type === 'error') {
        settled = true;
        reject(new Error(message.message));
      }
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (!settled) reject(new Error('Eve runtime exited before readiness (' + (signal ?? code) + ').'));
    });
  });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let closing;
  return {
    ready,
    get alive() { return child.exitCode === null && child.signalCode === null; },
    close() {
      return closing ??= (async () => {
        if (child.connected) child.send({ type: 'close' });
        const timeout = setTimeout(() => child.kill('SIGKILL'), 20000);
        timeout.unref();
        await exited;
        clearTimeout(timeout);
      })();
    },
  };
}
