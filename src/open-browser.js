import { spawn } from 'node:child_process';

export function openBrowser(
  url,
  { platform = process.platform, launch = spawn, onFailure = () => {} } = {}
) {
  const command =
    platform === 'darwin'
      ? ['open', [url]]
      : platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  try {
    const child = launch(command[0], command[1], {
      stdio: 'ignore',
      detached: true,
    });
    child.once('error', onFailure);
    child.once('exit', (code) => {
      if (code !== 0 && code !== null) onFailure();
    });
    child.unref();
  } catch {
    onFailure();
  }
}
