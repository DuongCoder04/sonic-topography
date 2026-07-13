import fs from 'node:fs/promises';
import path from 'node:path';
import { buildNeteasePlayerUrl, neteasePlayableUrlCacheKey, normalizeNeteaseBitrate } from './netease-playback.mjs';
import {
  NETEASE_MAX_PLAYLISTS,
  NETEASE_MAX_PLAYLIST_TRACK_LIMIT,
  NETEASE_PLAYLIST_PAGE_LIMIT,
  collectNeteasePlaylistTrackIds,
  mapNeteasePlaylistSummary,
  mapNeteaseSong,
  mergeNeteasePlaylistTrackDetails,
  normalizeNeteasePlaylistLimit,
} from './netease-library.mjs';

export function createNeteaseService({ dataDir, fetchImpl = globalThis.fetch }) {
  if (!dataDir) throw new Error('createNeteaseService requires dataDir');
  const playlistsPath = path.join(dataDir, 'playlists.json');
  const neteaseHeaders = {
    Referer: 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0',
    Accept: 'application/json, text/plain, */*',
    Connection: 'close',
  };
  const neteaseCookieHeader = 'x-netease-cookie';
  
  const playableUrlCache = new Map();
  const searchCache = new Map();
  const playableUrlCacheTtl = 1000 * 60 * 10;
  const searchCacheTtl = 1000 * 60 * 5;
  let browserNeteaseCookie = '';
  
  function normalizeNeteaseCookie(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/;+$/, ''))
      .filter(Boolean)
      .join('; ');
  }
  
  function readNeteaseCookie(req) {
    const raw = req.headers?.[neteaseCookieHeader];
    const headerCookie = Array.isArray(raw) ? raw[0] : String(raw || '');
    return normalizeNeteaseCookie(headerCookie || browserNeteaseCookie);
  }
  
  function createNeteaseHeaders(cookie, extraHeaders = {}) {
    const normalizedCookie = normalizeNeteaseCookie(cookie);
    return {
      ...neteaseHeaders,
      ...(normalizedCookie ? { Cookie: normalizedCookie } : {}),
      ...extraHeaders,
    };
  }
  
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  async function fetchJsonWithRetry(url, options = {}, retries = 2) {
    let lastData = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetchImpl(url, options);
      const data = await response.json();
      lastData = data;
      if (response.ok && data?.code !== 400) return data;
      if (attempt < retries) await wait(180 * (attempt + 1));
    }
    return lastData || {};
  }
  
  
  async function getNeteasePlayableUrl(id, cookie = '', bitrate = '320000') {
    const normalizedCookie = normalizeNeteaseCookie(cookie);
    const normalizedBitrate = normalizeNeteaseBitrate(bitrate);
    const cacheKey = neteasePlayableUrlCacheKey(id, normalizedCookie, normalizedBitrate);
    const cached = playableUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
  
    const url = buildNeteasePlayerUrl(id, normalizedBitrate);
    const data = await fetchJsonWithRetry(url, { headers: createNeteaseHeaders(normalizedCookie) });
    const playableUrl = data?.data?.[0]?.url || null;
    playableUrlCache.set(cacheKey, { url: playableUrl, expiresAt: Date.now() + playableUrlCacheTtl });
    return playableUrl;
  }
  
  async function fetchNeteaseSearchSongs(keywords, resultLimit, cookie) {
    const upstreamLimit = Math.min(resultLimit * 5, 80);
    const body = new URLSearchParams({
      s: keywords,
      type: '1',
      offset: '0',
      total: 'true',
      limit: String(upstreamLimit),
      _: String(Date.now()),
    });
  
    const data = await fetchJsonWithRetry('https://music.163.com/api/search/get/web', {
      method: 'POST',
      headers: createNeteaseHeaders(cookie, {
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      body,
    });
    const primarySongs = data?.result?.songs || [];
  
    const fallbackUrl = new URL('https://music.163.com/api/cloudsearch/pc');
    fallbackUrl.searchParams.set('s', keywords);
    fallbackUrl.searchParams.set('type', '1');
    fallbackUrl.searchParams.set('offset', '0');
    fallbackUrl.searchParams.set('total', 'true');
    fallbackUrl.searchParams.set('limit', String(upstreamLimit));
    fallbackUrl.searchParams.set('_', String(Date.now()));
    const fallbackData = await fetchJsonWithRetry(fallbackUrl, {
      headers: createNeteaseHeaders(cookie),
    });
    const fallbackSongs = fallbackData?.result?.songs || [];
    const songsById = new Map();
    for (const song of [...primarySongs, ...fallbackSongs]) {
      if (song?.id && !songsById.has(song.id)) songsById.set(song.id, song);
    }
    return {
      songs: [...songsById.values()],
      debug: {
        primaryCode: data?.code,
        primaryCount: primarySongs.length,
        fallbackCode: fallbackData?.code,
        fallbackCount: fallbackSongs.length,
      },
    };
  }
  
  async function fetchAnonymousNeteaseSearchSongs(keywords, resultLimit) {
    const body = new URLSearchParams({
      s: keywords,
      type: '1',
      offset: '0',
      total: 'true',
      limit: String(Math.min(resultLimit * 3, 60)),
    });
  
    const response = await fetchImpl('https://music.163.com/api/search/get/web', {
      method: 'POST',
      headers: {
        ...neteaseHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await response.json();
    return data?.result?.songs || [];
  }
  
  async function validateNeteaseCookie(cookie) {
    const account = await getNeteaseAccount(cookie);
    return account.valid;
  }
  
  async function getNeteaseAccount(cookie) {
    const normalizedCookie = normalizeNeteaseCookie(cookie);
    if (!normalizedCookie) return { valid: false, userId: null, nickname: '' };
  
    const response = await fetchImpl('https://music.163.com/api/nuser/account/get', {
      headers: createNeteaseHeaders(normalizedCookie),
    });
    const data = await response.json();
    const userId = data?.profile?.userId || data?.account?.id || null;
    return {
      valid: Boolean(userId),
      userId,
      nickname: data?.profile?.nickname || '',
    };
  }
  
  
  async function filterPlayableSongs(rawSongs, resultLimit, cookie) {
    const playableSongs = [];
    const batchSize = 8;
  
    for (let i = 0; i < rawSongs.length && playableSongs.length < resultLimit; i += batchSize) {
      const batch = rawSongs.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (song) => ({
        song,
        playableUrl: await getNeteasePlayableUrl(String(song.id), cookie),
      })));
  
      for (const result of results) {
        if (result.playableUrl) playableSongs.push(result.song);
        if (playableSongs.length >= resultLimit) break;
      }
    }
  
    return playableSongs;
  }
  
  async function getDailyRecommendSongs(cookie, resultLimit) {
    const normalizedCookie = normalizeNeteaseCookie(cookie);
    if (!normalizedCookie) return { valid: false, songs: [] };
    const validCookie = await validateNeteaseCookie(normalizedCookie);
    if (!validCookie) return { valid: false, songs: [] };
  
    const response = await fetchImpl('https://music.163.com/api/v3/discovery/recommend/songs', {
      headers: createNeteaseHeaders(normalizedCookie),
    });
    const data = await response.json();
    const rawSongs = (data?.data?.dailySongs || data?.recommend || []).map(mapNeteaseSong);
    const songs = await filterPlayableSongs(rawSongs, resultLimit, normalizedCookie);
    return { valid: Boolean(data?.data?.dailySongs || data?.recommend), songs };
  }
  
  async function getUserPlaylists(cookie) {
    const account = await getNeteaseAccount(cookie);
    if (!account.valid || !account.userId) return { valid: false, playlists: [] };
  
    const playlists = [];
    for (let offset = 0; offset < NETEASE_MAX_PLAYLISTS; offset += NETEASE_PLAYLIST_PAGE_LIMIT) {
      const response = await fetchImpl(`https://music.163.com/api/user/playlist?uid=${encodeURIComponent(account.userId)}&limit=${NETEASE_PLAYLIST_PAGE_LIMIT}&offset=${offset}`, {
        headers: createNeteaseHeaders(cookie),
      });
      const data = await response.json();
      const page = Array.isArray(data?.playlist) ? data.playlist : [];
      playlists.push(...page);
      const total = Number(data?.more) ? Number.POSITIVE_INFINITY : Number(data?.playlistCount || data?.total || playlists.length);
      if (page.length < NETEASE_PLAYLIST_PAGE_LIMIT || playlists.length >= total) break;
    }
  
    const mappedPlaylists = playlists.map(mapNeteasePlaylistSummary);
  
    return { valid: true, playlists: mappedPlaylists };
  }
  
  async function getPlaylistPlayableSongs(playlistId, cookie, resultLimit) {
    const requestLimit = Math.min(resultLimit, NETEASE_MAX_PLAYLIST_TRACK_LIMIT);
    const response = await fetchImpl(`https://music.163.com/api/v6/playlist/detail?id=${encodeURIComponent(playlistId)}&n=${requestLimit}`, {
      headers: createNeteaseHeaders(cookie),
    });
    const data = await response.json();
    const playlist = data?.playlist || {};
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    const orderedIds = collectNeteasePlaylistTrackIds(playlist, resultLimit);
    const detailTracks = orderedIds.length > tracks.length
      ? await fetchNeteaseSongDetails(orderedIds, cookie)
      : [];
    const songs = mergeNeteasePlaylistTrackDetails(tracks, detailTracks, orderedIds)
      .map(mapNeteaseSong)
      .filter((song) => song.id && song.name)
      .slice(0, resultLimit);
    return {
      songs,
      trackCount: Number(playlist.trackCount || orderedIds.length || songs.length),
      rawTrackCount: orderedIds.length,
    };
  }
  
  async function fetchNeteaseSongDetails(ids, cookie) {
    const tracks = [];
    const batchSize = 400;
  
    for (let index = 0; index < ids.length; index += batchSize) {
      const batch = ids.slice(index, index + batchSize);
      const detailUrl = `https://music.163.com/api/song/detail?ids=${encodeURIComponent(JSON.stringify(batch.map((id) => Number(id))))}`;
      const data = await fetchJsonWithRetry(detailUrl, { headers: createNeteaseHeaders(cookie) });
      if (Array.isArray(data?.songs)) tracks.push(...data.songs);
    }
  
    return tracks;
  }

  function createDefaultPlaylists() {
    return [
      { id: 'favorites', name: 'Favorites', songs: [] },
      { id: 'visual-set', name: 'Visual Set', songs: [] },
    ];
  }

  function normalizePlaylists(value) {
    if (!Array.isArray(value) || value.length === 0) return createDefaultPlaylists();
    return value.map((playlist) => ({
      id: String(playlist.id || `playlist-${Date.now()}`),
      name: String(playlist.name || 'Playlist'),
      songs: Array.isArray(playlist.songs) ? playlist.songs : [],
    }));
  }

  async function readPlaylistsFile() {
    try {
      return normalizePlaylists(JSON.parse(await fs.readFile(playlistsPath, 'utf8')));
    } catch {
      return createDefaultPlaylists();
    }
  }

  async function writePlaylistsFile(playlists) {
    await fs.mkdir(dataDir, { recursive: true });
    const normalized = normalizePlaylists(playlists);
    await fs.writeFile(playlistsPath, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }
  
  
  return {
    normalizeNeteaseCookie,
    readNeteaseCookie,
    createNeteaseHeaders,
    getNeteasePlayableUrl,
    fetchNeteaseSearchSongs,
    fetchAnonymousNeteaseSearchSongs,
    getNeteaseAccount,
    filterPlayableSongs,
    getDailyRecommendSongs,
    getUserPlaylists,
    getPlaylistPlayableSongs,
    fetchNeteaseSongDetails,
    readPlaylistsFile,
    writePlaylistsFile,
    getBrowserCookie: () => browserNeteaseCookie,
    setBrowserCookie: (cookie) => { browserNeteaseCookie = normalizeNeteaseCookie(cookie); return browserNeteaseCookie; },
    clearCaches: () => { playableUrlCache.clear(); searchCache.clear(); },
    searchCache,
    searchCacheTtl,
  };
}
