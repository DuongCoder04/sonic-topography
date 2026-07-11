import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

export const ANALYTICS_ENDPOINT =
  'https://sonic-analysis.cn-shanghai.log.aliyuncs.com/logstores/sonic-event/track';
export const ANALYTICS_HEARTBEAT_MS = 60_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAnalytics({
  app,
  request = https.request,
  randomUUID = crypto.randomUUID,
  now = Date.now,
  platform = process.platform,
  arch = process.arch,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  let distinctId = '';
  let sessionId = '';
  let sessionStart = 0;
  let heartbeatTimer = null;
  let initialized = false;
  let closeSent = false;

  const idFile = () => path.join(app.getPath('userData'), 'analytics_id.json');

  function loadOrCreateDistinctId() {
    try {
      const parsed = JSON.parse(fs.readFileSync(idFile(), 'utf8'));
      if (UUID_PATTERN.test(parsed?.id || '')) {
        return { id: parsed.id, isFirstLaunch: false };
      }
    } catch {
      // A missing or unreadable ID file is treated as a first launch.
    }

    const id = randomUUID();
    fs.mkdirSync(path.dirname(idFile()), { recursive: true });
    fs.writeFileSync(idFile(), JSON.stringify({ id, created_at: now() }), 'utf8');
    return { id, isFirstLaunch: true };
  }

  function send(event, eventFields = {}) {
    if (!initialized) return;

    const url = new URL(ANALYTICS_ENDPOINT);
    const fields = {
      APIVersion: '0.6.0',
      event,
      distinct_id: distinctId,
      session_id: sessionId,
      app_version: app.getVersion(),
      os: platform,
      arch,
      ...eventFields,
    };
    for (const [key, value] of Object.entries(fields)) {
      url.searchParams.set(key, String(value));
    }

    try {
      const req = request(url, { method: 'GET', timeout: 3_000 });
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end();
    } catch {
      // Analytics must never block startup, playback, or shutdown.
    }
  }

  function close() {
    if (!initialized || closeSent) return;
    closeSent = true;
    if (heartbeatTimer) clearIntervalFn(heartbeatTimer);
    const durationSeconds = Math.max(0, Math.floor((now() - sessionStart) / 1_000));
    send('app_close', { duration_seconds: durationSeconds });
  }

  function init() {
    if (initialized) return;
    const identity = loadOrCreateDistinctId();
    distinctId = identity.id;
    sessionId = randomUUID();
    sessionStart = now();
    initialized = true;

    send('app_open', { is_first_launch: identity.isFirstLaunch });
    heartbeatTimer = setIntervalFn(() => send('app_heartbeat'), ANALYTICS_HEARTBEAT_MS);
    heartbeatTimer?.unref?.();
    app.once('before-quit', close);
  }

  return { init, close };
}
