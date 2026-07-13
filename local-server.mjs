import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerQQMusicExpressRoutes } from './server/qq-music.mjs';
import { streamNeteaseAudioResponse } from './server/netease-audio-proxy.mjs';
import { mapNeteaseSong, normalizeNeteasePlaylistLimit } from './server/netease-library.mjs';
import { registerUpdateExpressRoutes } from './server/update-service.mjs';
import { createNeteaseService } from './server/netease-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 45437);
const dataDir = process.env.SONIC_DATA_DIR || path.join(__dirname, 'data');

const neteaseService = createNeteaseService({ dataDir });
const {
  normalizeNeteaseCookie, readNeteaseCookie, createNeteaseHeaders,
  getNeteasePlayableUrl, fetchNeteaseSearchSongs, fetchAnonymousNeteaseSearchSongs,
  getNeteaseAccount, filterPlayableSongs, getDailyRecommendSongs, getUserPlaylists,
  getPlaylistPlayableSongs, readPlaylistsFile, writePlaylistsFile, searchCache, searchCacheTtl,
} = neteaseService;

const app = express();
app.use(express.json({ limit: '1mb' }));
registerQQMusicExpressRoutes(app);
registerUpdateExpressRoutes(app);

app.get('/api/playlists', async (_req, res) => {
  res.json({ playlists: await readPlaylistsFile() });
});

app.put('/api/playlists', async (req, res) => {
  try {
    const playlists = await writePlaylistsFile(req.body?.playlists);
    res.json({ playlists });
  } catch (error) {
    res.status(500).json({ error: 'Unable to save playlists' });
  }
});

app.get('/api/netease/cookie', async (_req, res) => {
  try {
    const account = await getNeteaseAccount(neteaseService.getBrowserCookie());
    res.json({
      hasCookie: Boolean(neteaseService.getBrowserCookie()),
      valid: account.valid,
      userId: account.userId,
      nickname: account.nickname,
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to check Netease cookie' });
  }
});

app.put('/api/netease/cookie', async (req, res) => {
  try {
    neteaseService.setBrowserCookie(req.body?.cookie);
    playableUrlCache.clear();
    searchCache.clear();
    const account = await getNeteaseAccount(neteaseService.getBrowserCookie());
    res.json({ hasCookie: Boolean(neteaseService.getBrowserCookie()), valid: account.valid, userId: account.userId, nickname: account.nickname });
  } catch (error) {
    res.status(500).json({ error: 'Unable to save Netease cookie' });
  }
});

app.get('/api/netease/search', async (req, res) => {
  try {
    const keywords = String(req.query.keywords || '').trim();
    const requestedLimit = Number(req.query.limit || '30');
    const cookie = readNeteaseCookie(req);
    const hasCookie = Boolean(normalizeNeteaseCookie(cookie));
    const resultLimit = hasCookie
      ? (Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 40)) : 30)
      : (Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 20)) : 12);
    const includeDebug = String(req.query.debug || '') === '1';

    if (!keywords) {
      res.status(400).json({ error: 'Missing keywords' });
      return;
    }

    const searchMode = hasCookie ? `cookie::${normalizeNeteaseCookie(cookie)}` : 'anonymous-baseline';
    const cacheKey = `${keywords.toLowerCase()}::${resultLimit}::${searchMode}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ ...cached.payload, cached: true });
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

    res.json(includeDebug ? { ...payload, debug: searchResult.debug } : payload);
  } catch (error) {
    res.status(500).json({ error: 'Netease search failed' });
  }
});

app.get('/api/netease/liked', async (req, res) => {
  try {
    const resultLimit = normalizeNeteasePlaylistLimit(req.query.limit || 'all');
    const cookie = readNeteaseCookie(req);
    const userPlaylists = await getUserPlaylists(cookie);

    if (!userPlaylists.valid || userPlaylists.playlists.length === 0) {
      res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
      return;
    }

    const likedPlaylist = userPlaylists.playlists[0];
    const result = await getPlaylistPlayableSongs(String(likedPlaylist.id), cookie, resultLimit);
    res.json({
      songs: result.songs,
      playlist: { ...likedPlaylist, loadedCount: result.songs.length },
      totalCount: result.trackCount || likedPlaylist.trackCount,
      rawTrackCount: result.rawTrackCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Netease liked songs failed' });
  }
});

app.get('/api/netease/playlists', async (req, res) => {
  try {
    const cookie = readNeteaseCookie(req);
    const userPlaylists = await getUserPlaylists(cookie);

    if (!userPlaylists.valid) {
      res.status(401).json({ error: 'Netease cookie is invalid or expired', playlists: [] });
      return;
    }

    res.json({ playlists: userPlaylists.playlists.slice(1) });
  } catch (error) {
    res.status(500).json({ error: 'Netease playlists failed' });
  }
});

app.get('/api/netease/playlist', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const resultLimit = normalizeNeteasePlaylistLimit(req.query.limit || 'all');
    const cookie = readNeteaseCookie(req);

    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    const account = await getNeteaseAccount(cookie);
    if (!account.valid) {
      res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
      return;
    }

    const result = await getPlaylistPlayableSongs(id, cookie, resultLimit);
    res.json({
      songs: result.songs,
      loadedCount: result.songs.length,
      totalCount: result.trackCount,
      rawTrackCount: result.rawTrackCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Netease playlist failed' });
  }
});

app.get('/api/netease/daily-recommend', async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || '30');
    const resultLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 50)) : 30;
    const cookie = readNeteaseCookie(req);
    const result = await getDailyRecommendSongs(cookie, resultLimit);

    if (!result.valid) {
      res.status(401).json({ error: 'Netease cookie is invalid or expired', songs: [] });
      return;
    }

    res.json({ songs: result.songs });
  } catch (error) {
    res.status(500).json({ error: 'Netease daily recommend failed' });
  }
});

app.get('/api/netease/lyric', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const cookie = readNeteaseCookie(req);
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    const response = await fetch(`https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=-1&kv=-1&tv=-1`, {
      headers: createNeteaseHeaders(cookie),
    });
    const data = await response.json();
    res.json({
      lyric: data?.lrc?.lyric || '',
      translatedLyric: data?.tlyric?.lyric || '',
    });
  } catch (error) {
    res.status(500).json({ error: 'Netease lyric failed' });
  }
});

app.get('/api/netease/url', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const bitrate = String(req.query.br || '');
    const cookie = readNeteaseCookie(req);
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    res.json({ url: await getNeteasePlayableUrl(id, cookie, bitrate) });
  } catch (error) {
    res.status(500).json({ error: 'Netease url failed' });
  }
});

app.get('/api/netease/audio', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    const bitrate = String(req.query.br || '');
    const cookie = readNeteaseCookie(req);
    if (!id) {
      res.status(400).json({ error: 'Missing id' });
      return;
    }

    const playableUrl = await getNeteasePlayableUrl(id, cookie, bitrate);
    if (!playableUrl) {
      res.status(404).json({ error: 'No playable url for this song' });
      return;
    }

    const headers = createNeteaseHeaders(cookie);
    if (req.headers.range) headers.Range = req.headers.range;

    const audioResponse = await fetch(playableUrl, { headers });
    await streamNeteaseAudioResponse(req, res, audioResponse);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Netease audio proxy failed' });
    } else if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sonic Topography is running at http://127.0.0.1:${port}`);
});


