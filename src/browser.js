import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(
  new URL('../frontend/dist/', import.meta.url)
);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export async function serveBrowser(
  request,
  response,
  pathname,
  directory = defaultDirectory
) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }
  try {
    const entry = pathname === '/' || pathname === '/index.html';
    if (!entry && !pathname.startsWith('/assets/')) throw { code: 'ENOENT' };
    const decoded = decodeURIComponent(entry ? '/index.html' : pathname);
    if (decoded.split('/').includes('..') || decoded.includes('\\'))
      throw { code: 'ENOENT' };
    const root = await realpath(directory);
    const path = await realpath(resolve(root, '.' + decoded));
    if (
      !(entry
        ? path === resolve(root, 'index.html')
        : path.startsWith(resolve(root, 'assets') + sep)) ||
      !types[extname(path)]
    )
      throw { code: 'ENOENT' };
    const content = await readFile(path);
    response.writeHead(200, {
      'content-type': types[extname(path)],
      'cache-control': entry
        ? 'no-store'
        : 'public, max-age=31536000, immutable',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    const entry = pathname === '/' || pathname === '/index.html';
    response.writeHead(entry ? 503 : 404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(
      request.method === 'HEAD'
        ? undefined
        : entry
          ? 'Even browser files are unavailable. In a checkout, install frontend dependencies and run npm run build:ui.'
          : 'Not found.'
    );
  }
}
