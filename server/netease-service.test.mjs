import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createNeteaseService } from './netease-service.mjs';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sonic-netease-service-'));
let fetchCount = 0;
const service = createNeteaseService({
  dataDir,
  fetchImpl: async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ data: [{ url: 'https://audio.example/song.mp3' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

assert.equal(service.normalizeNeteaseCookie(' MUSIC_U=value;;\n'), 'MUSIC_U=value');
service.setBrowserCookie('MUSIC_U=value');
assert.equal(service.getBrowserCookie(), 'MUSIC_U=value');

const playlists = [{ id: 'favorites', name: 'Favorites', songs: [] }];
assert.deepEqual(await service.writePlaylistsFile(playlists), playlists);
assert.deepEqual(await service.readPlaylistsFile(), playlists);

assert.equal(await service.getNeteasePlayableUrl('1', '', '320000'), 'https://audio.example/song.mp3');
assert.equal(await service.getNeteasePlayableUrl('1', '', '320000'), 'https://audio.example/song.mp3');
assert.equal(fetchCount, 1, 'playable URL should be cached');
service.clearCaches();
await service.getNeteasePlayableUrl('1', '', '320000');
assert.equal(fetchCount, 2, 'clearCaches should invalidate playable URLs');

await fs.rm(path.join(dataDir, 'playlists.json'), { force: true });
await fs.rmdir(dataDir);
console.log('netease service tests passed');
