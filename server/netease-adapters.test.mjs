import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
const local = await readFile(new URL('../local-server.mjs', import.meta.url), 'utf8');

const expectedRoutes = [
  '/api/playlists',
  '/api/netease/search',
  '/api/netease/cookie',
  '/api/netease/liked',
  '/api/netease/playlists',
  '/api/netease/playlist',
  '/api/netease/daily-recommend',
  '/api/netease/lyric',
  '/api/netease/url',
  '/api/netease/audio',
];

for (const route of expectedRoutes) {
  assert.ok(vite.includes(`'${route}'`), `Vite adapter should register ${route}`);
  assert.ok(local.includes(`'${route}'`), `Express adapter should register ${route}`);
}

for (const implementationName of ['fetchNeteaseSearchSongs', 'getDailyRecommendSongs', 'getPlaylistPlayableSongs']) {
  assert.doesNotMatch(vite, new RegExp(`(?:async )?function ${implementationName}\\(`));
  assert.doesNotMatch(local, new RegExp(`(?:async )?function ${implementationName}\\(`));
}

assert.match(vite, /createNeteaseService\(\{ dataDir \}\)/);
assert.match(local, /createNeteaseService\(\{ dataDir \}\)/);
console.log('netease adapter contract tests passed');
