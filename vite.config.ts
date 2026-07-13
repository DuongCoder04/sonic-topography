import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { registerQQMusicViteMiddlewares } from './server/qq-music.mjs';
import { streamNeteaseAudioResponse } from './server/netease-audio-proxy.mjs';
import { mapNeteaseSong, normalizeNeteasePlaylistLimit } from './server/netease-library.mjs';
import { registerUpdateViteMiddlewares } from './server/update-service.mjs';
import { createNeteaseService } from './server/netease-service.mjs';

const dataDir = path.resolve(__dirname, 'data');
const neteaseService = createNeteaseService({ dataDir });
const {
  normalizeNeteaseCookie, readNeteaseCookie, createNeteaseHeaders,
  getNeteasePlayableUrl: getNeteasePlayableUrlWithCookie,
  fetchNeteaseSearchSongs, fetchAnonymousNeteaseSearchSongs,
  getNeteaseAccount, filterPlayableSongs, getDailyRecommendSongs, getUserPlaylists,
  getPlaylistPlayableSongs, readPlaylistsFile, writePlaylistsFile, searchCache, searchCacheTtl,
} = neteaseService;

function writeJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readRequestBody(req: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function neteaseApiPlugin() {
  return {
    name: 'netease-api-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/playlists', async (req: any, res: any, next: any) => {
        try {
          if (req.method === 'GET') {
            writeJson(res, 200, { playlists: await readPlaylistsFile() });
            return;
          }

          if (req.method === 'PUT') {
            const body = await readRequestBody(req);
            const parsed = body ? JSON.parse(body) : {};
            const playlists = await writePlaylistsFile(parsed.playlists);
            writeJson(res, 200, { playlists });
            return;
          }
        } catch (error) {
          writeJson(res, 500, { error: 'Unable to save playlists' });
          return;
        }

        next();
      });

      registerQQMusicViteMiddlewares(server, writeJson);
      registerUpdateViteMiddlewares(server, writeJson);

      server.middlewares.use('/api/netease/search', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const keywords = requestUrl.searchParams.get('keywords')?.trim();
          const requestedLimit = Number(requestUrl.searchParams.get('limit') || '30');
          const cookie = readNeteaseCookie(req);
          const hasCookie = Boolean(normalizeNeteaseCookie(cookie));
          const resultLimit = hasCookie
            ? (Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 40)) : 30)
            : (Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 20)) : 12);
          const includeDebug = requestUrl.searchParams.get('debug') === '1';

          if (!keywords) {
            writeJson(res, 400, { error: 'Missing keywords' });
            return;
          }

          const searchMode = hasCookie ? `cookie::${normalizeNeteaseCookie(cookie)}` : 'anonymous-baseline';
          const cacheKey = `${keywords.toLowerCase()}::${resultLimit}::${searchMode}`;
          const cached = searchCache.get(cacheKey);
          if (cached && cached.expiresAt > Date.now()) {
            writeJson(res, 200, { ...cached.payload, cached: true });
            return;
          }

          const searchResult = hasCookie
            ? await fetchNeteaseSearchSongs(keywords, resultLimit, cookie)
            : { songs: await fetchAnonymousNeteaseSearchSongs(keywords, resultLimit), debug: { mode: 'anonymous-github' } };
          const rawSongs = searchResult.songs.map(mapNeteaseSong);
          const songs = await filterPlayableSongs(rawSongs, resultLimit, cookie);
          const payload = { songs, rawCount: rawSongs.length, filteredCount: songs.length };
          if (rawSongs.length > 0 || songs.length > 0) {
            searchCache.set(cacheKey, { payload, expiresAt: Date.now() + searchCacheTtl });
          }

          writeJson(res, 200, includeDebug ? { ...payload, debug: searchResult.debug } : payload);
        } catch (error) {
          writeJson(res, 500, { error: 'Netease search failed' });
        }
      });

      server.middlewares.use('/api/netease/cookie', async (req: any, res: any, next: any) => {
        try {
          if (req.method === 'GET') {
            const account = await getNeteaseAccount(neteaseService.getBrowserCookie());
            writeJson(res, 200, {
              hasCookie: Boolean(neteaseService.getBrowserCookie()),
              valid: account.valid,
              userId: account.userId,
              nickname: account.nickname,
            });
            return;
          }

          if (req.method === 'PUT') {
            const body = await readRequestBody(req);
            const parsed = body ? JSON.parse(body) : {};
            neteaseService.setBrowserCookie(parsed.cookie);
            neteaseService.clearCaches();
            const account = await getNeteaseAccount(neteaseService.getBrowserCookie());
            writeJson(res, 200, { hasCookie: Boolean(neteaseService.getBrowserCookie()), valid: account.valid, userId: account.userId, nickname: account.nickname });
            return;
          }
        } catch (error) {
          writeJson(res, 500, { error: 'Unable to check or save Netease cookie' });
          return;
        }

        next();
      });

      server.middlewares.use('/api/netease/liked', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const resultLimit = normalizeNeteasePlaylistLimit(requestUrl.searchParams.get('limit') || 'all');
          const cookie = readNeteaseCookie(req);
          const userPlaylists = await getUserPlaylists(cookie);

          if (!userPlaylists.valid || userPlaylists.playlists.length === 0) {
            writeJson(res, 401, { error: 'Netease cookie is invalid or expired', songs: [] });
            return;
          }

          const likedPlaylist = userPlaylists.playlists[0];
          const result = await getPlaylistPlayableSongs(String(likedPlaylist.id), cookie, resultLimit);
          writeJson(res, 200, {
            songs: result.songs,
            playlist: { ...likedPlaylist, loadedCount: result.songs.length },
            totalCount: result.trackCount || likedPlaylist.trackCount,
            rawTrackCount: result.rawTrackCount,
          });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease liked songs failed' });
        }
      });

      server.middlewares.use('/api/netease/playlists', async (req: any, res: any) => {
        try {
          const cookie = readNeteaseCookie(req);
          const userPlaylists = await getUserPlaylists(cookie);

          if (!userPlaylists.valid) {
            writeJson(res, 401, { error: 'Netease cookie is invalid or expired', playlists: [] });
            return;
          }

          writeJson(res, 200, { playlists: userPlaylists.playlists.slice(1) });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease playlists failed' });
        }
      });

      server.middlewares.use('/api/netease/playlist', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const id = requestUrl.searchParams.get('id');
          const resultLimit = normalizeNeteasePlaylistLimit(requestUrl.searchParams.get('limit') || 'all');
          const cookie = readNeteaseCookie(req);

          if (!id) {
            writeJson(res, 400, { error: 'Missing id' });
            return;
          }

          const account = await getNeteaseAccount(cookie);
          if (!account.valid) {
            writeJson(res, 401, { error: 'Netease cookie is invalid or expired', songs: [] });
            return;
          }

          const result = await getPlaylistPlayableSongs(id, cookie, resultLimit);
          writeJson(res, 200, {
            songs: result.songs,
            loadedCount: result.songs.length,
            totalCount: result.trackCount,
            rawTrackCount: result.rawTrackCount,
          });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease playlist failed' });
        }
      });

      server.middlewares.use('/api/netease/daily-recommend', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const requestedLimit = Number(requestUrl.searchParams.get('limit') || '30');
          const resultLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 50)) : 30;
          const cookie = readNeteaseCookie(req);
          const result = await getDailyRecommendSongs(cookie, resultLimit);

          if (!result.valid) {
            writeJson(res, 401, { error: 'Netease cookie is invalid or expired', songs: [] });
            return;
          }

          writeJson(res, 200, { songs: result.songs });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease daily recommend failed' });
        }
      });

      server.middlewares.use('/api/netease/lyric', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const id = requestUrl.searchParams.get('id');
          const cookie = readNeteaseCookie(req);

          if (!id) {
            writeJson(res, 400, { error: 'Missing id' });
            return;
          }

          const response = await fetch(`https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=-1&kv=-1&tv=-1`, {
            headers: createNeteaseHeaders(cookie),
          });
          const data = await response.json() as any;
          writeJson(res, 200, {
            lyric: data?.lrc?.lyric || '',
            translatedLyric: data?.tlyric?.lyric || '',
          });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease lyric failed' });
        }
      });

      server.middlewares.use('/api/netease/url', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const id = requestUrl.searchParams.get('id');
          const bitrate = requestUrl.searchParams.get('br') || '';
          const cookie = readNeteaseCookie(req);

          if (!id) {
            writeJson(res, 400, { error: 'Missing id' });
            return;
          }

          writeJson(res, 200, { url: await getNeteasePlayableUrlWithCookie(id, cookie, bitrate) });
        } catch (error) {
          writeJson(res, 500, { error: 'Netease url failed' });
        }
      });

      server.middlewares.use('/api/netease/audio', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://localhost');
          const id = requestUrl.searchParams.get('id');
          const bitrate = requestUrl.searchParams.get('br') || '';
          const cookie = readNeteaseCookie(req);

          if (!id) {
            writeJson(res, 400, { error: 'Missing id' });
            return;
          }

          const playableUrl = await getNeteasePlayableUrlWithCookie(id, cookie, bitrate);
          if (!playableUrl) {
            writeJson(res, 404, { error: 'No playable url for this song' });
            return;
          }

          const headers: Record<string, string> = createNeteaseHeaders(cookie);
          if (req.headers.range) headers.Range = req.headers.range;

          const audioResponse = await fetch(playableUrl, { headers });
          await streamNeteaseAudioResponse(req, res, audioResponse);
        } catch (error) {
          if (!res.headersSent) {
            writeJson(res, 500, { error: 'Netease audio proxy failed' });
          } else if (!res.destroyed && !res.writableEnded) {
            res.end();
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), neteaseApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify芒聙聰file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});


