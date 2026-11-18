import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { openBrowser } from '../src/open-browser.js';

test('opens the launch URL with the platform launcher without shell interpolation', () => {
  const url = 'http://127.0.0.1:5000/#token=example';
  for (const [platform, command, args] of [
    ['darwin', 'open', [url]],
    ['linux', 'xdg-open', [url]],
    ['win32', 'rundll32', ['url.dll,FileProtocolHandler', url]],
  ]) {
    let invocation,
      unreferenced = false;
    const child = new EventEmitter();
    child.unref = () => {
      unreferenced = true;
    };
    openBrowser(url, {
      platform,
      launch: (...values) => {
        invocation = values;
        return child;
      },
    });
    assert.deepEqual(invocation, [
      command,
      args,
      { stdio: 'ignore', detached: true },
    ]);
    assert.equal(unreferenced, true);
  }
});

test('an unavailable browser does not crash the running server', () => {
  let failed = 0;
  const child = new EventEmitter();
  child.unref = () => {};
  openBrowser('http://127.0.0.1:5000/', {
    launch: () => child,
    onFailure: () => failed++,
  });
  child.emit('error', new Error('No browser installed'));
  assert.equal(failed, 1);
});
