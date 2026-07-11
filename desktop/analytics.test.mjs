import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAnalytics } from './analytics.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sonic-analytics-test-'));
const requests = [];
const appEvents = new EventEmitter();
const app = Object.assign(appEvents, {
  getPath: () => tempRoot,
  getVersion: () => '1.2.0-test',
});
const uuids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
];
let now = 1_000_000;
let heartbeatCallback;
let timerCleared = false;

function request(url) {
  requests.push(new URL(url));
  const req = new EventEmitter();
  req.end = () => {};
  req.destroy = () => {};
  return req;
}

const analytics = createAnalytics({
  app,
  request,
  randomUUID: () => uuids.shift(),
  now: () => now,
  platform: 'win32',
  arch: 'x64',
  setIntervalFn: (callback, delay) => {
    assert.equal(delay, 60_000);
    heartbeatCallback = callback;
    return { unref() {} };
  },
  clearIntervalFn: () => { timerCleared = true; },
});

analytics.init();
assert.equal(requests.length, 1);
assert.deepEqual(Object.fromEntries(requests[0].searchParams), {
  APIVersion: '0.6.0',
  event: 'app_open',
  distinct_id: '11111111-1111-4111-8111-111111111111',
  session_id: '22222222-2222-4222-8222-222222222222',
  app_version: '1.2.0-test',
  os: 'win32',
  arch: 'x64',
  is_first_launch: 'true',
});

heartbeatCallback();
assert.equal(requests[1].searchParams.get('event'), 'app_heartbeat');
assert.equal(requests[1].searchParams.has('duration_seconds'), false);

now += 125_000;
app.emit('before-quit');
assert.equal(timerCleared, true);
assert.equal(requests[2].searchParams.get('event'), 'app_close');
assert.equal(requests[2].searchParams.get('duration_seconds'), '125');
assert.deepEqual([...requests[2].searchParams.keys()].sort(), [
  'APIVersion', 'app_version', 'arch', 'distinct_id', 'duration_seconds', 'event', 'os', 'session_id',
].sort());

app.emit('before-quit');
assert.equal(requests.length, 3);
assert.equal(JSON.parse(fs.readFileSync(path.join(tempRoot, 'analytics_id.json'), 'utf8')).id,
  '11111111-1111-4111-8111-111111111111');

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('analytics tests passed');
