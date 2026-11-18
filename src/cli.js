#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadEve } from './eve-adapter.js';
import { startServer } from './server.js';
import { openBrowser } from './open-browser.js';

try {
  const { values } = parseArgs({
    options: {
      project: { type: 'string', default: process.cwd() },
      port: { type: 'string', default: '0' },
      'eve-headers': { type: 'string' },
      'no-open': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: even [--project PATH] [--port PORT] [--eve-headers JSON_FILE] [--no-open]\nStarts the local workbench and opens it in your browser.');
  } else {
    const port = Number(values.port);
    if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port > 65535) {
      throw new Error('Port must be an integer from 0 through 65535.');
    }
    let eveHeaders;
    if (values['eve-headers']) {
      eveHeaders = JSON.parse(await readFile(values['eve-headers'], 'utf8'));
      if (!eveHeaders || Array.isArray(eveHeaders) || typeof eveHeaders !== 'object' ||
          Object.values(eveHeaders).some(value => typeof value !== 'string')) {
        throw new Error('Eve headers file must contain a JSON object of string header values.');
      }
      const validated = new Headers(eveHeaders);
      if (['host', 'origin', 'content-length', 'connection', 'transfer-encoding'].some(name => validated.has(name)) ||
          [...validated.keys()].some(name => name.startsWith('x-eve-dev-'))) {
        throw new Error('Eve headers file contains a reserved transport header.');
      }
      eveHeaders = Object.fromEntries(validated);
    }
    const adapter = await loadEve(values.project);
    const server = await startServer(adapter, { port, eveHeaders });
    console.log(JSON.stringify({ url: server.url, browserUrl: server.browserUrl, token: server.token, project: adapter.project, eveVersion: adapter.version }));
    if (!values['no-open']) openBrowser(server.browserUrl, {
      onFailure: () => console.error('Could not open a browser automatically. Open the browserUrl printed above.'),
    });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await server.close();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
