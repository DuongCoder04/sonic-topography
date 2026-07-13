import { createNeteaseCookieHeaders } from './neteaseCookie';
import { createQQCookieHeaders } from './qqCookie';
import type { CloudPlaylistSummary, MusicProvider, NeteaseSong, SavedPlaylist } from '../types';
import {
  buildNeteasePlaybackUrl,
  buildQQPlaybackUrl,
  type PlaybackQualitySettings,
} from './playbackQuality';

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

export interface SongListPayload {
  songs?: NeteaseSong[];
  playlists?: CloudPlaylistSummary[];
  status?: string;
  fallback?: boolean;
  rawCount?: number;
  loadedCount?: number;
  totalCount?: number;
  rawTrackCount?: number;
  playlist?: { trackCount?: number };
  error?: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    data: await response.json() as T,
  };
}

export function providerCookieHeaders(provider: MusicProvider, cookie: string) {
  return provider === 'qq' ? createQQCookieHeaders(cookie) : createNeteaseCookieHeaders(cookie);
}

export function syncNeteaseProxyCookie(cookie: string) {
  return requestJson<{ valid?: boolean }>('/api/netease/cookie', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  });
}

export function syncQQProxyCookie(cookie: string) {
  return requestJson<{ loggedIn?: boolean }>('/api/qq/login/cookie', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookie }),
  });
}

export async function logoutQQProxy() {
  await fetch('/api/qq/logout');
}

export function loadServerPlaylists() {
  return requestJson<{ playlists?: SavedPlaylist[] }>('/api/playlists');
}

export function saveServerPlaylists(playlists: SavedPlaylist[]) {
  return requestJson<{ playlists?: SavedPlaylist[] }>('/api/playlists', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playlists }),
  });
}

export function loadCloudPayload<T = SongListPayload>(url: string, provider: MusicProvider, cookie: string) {
  return requestJson<T>(url, { headers: providerCookieHeaders(provider, cookie) });
}

export function buildMusicSearchUrl(provider: MusicProvider, keywords: string, hasCookie: boolean) {
  const encoded = encodeURIComponent(keywords);
  if (provider === 'qq') return `/api/qq/search?keywords=${encoded}&limit=30`;
  return `/api/netease/search?keywords=${encoded}${hasCookie ? '&limit=30' : ''}`;
}

export function searchCloudMusic(provider: MusicProvider, keywords: string, cookie: string) {
  return loadCloudPayload(
    buildMusicSearchUrl(provider, keywords, Boolean(cookie)),
    provider,
    cookie,
  );
}

export function loadSongLyrics(song: NeteaseSong, neteaseCookie: string, qqCookie: string) {
  const provider = song.provider || 'netease';
  if (provider === 'qq') {
    const mid = song.mid || song.songmid || String(song.id);
    return loadCloudPayload<{ lyric?: string; translatedLyric?: string; tlyric?: string; qrc?: string }>(
      `/api/qq/lyric?mid=${encodeURIComponent(mid)}&id=${encodeURIComponent(String(song.qqId || ''))}`,
      provider,
      qqCookie,
    );
  }
  return loadCloudPayload<{ lyric?: string; translatedLyric?: string; tlyric?: string; qrc?: string }>(
    `/api/netease/lyric?id=${encodeURIComponent(String(song.id))}`,
    provider,
    neteaseCookie,
  );
}

export async function loadSongPlaybackResources(
  song: NeteaseSong,
  settings: PlaybackQualitySettings,
  neteaseCookie: string,
  qqCookie: string,
) {
  const provider = song.provider || 'netease';
  if (provider === 'qq') {
    const mid = song.mid || song.songmid || String(song.id);
    const qqSong = { mid, mediaMid: song.mediaMid || '' };
    const [playback, lyrics] = await Promise.all([
      loadCloudPayload<{ url?: string; message?: string }>(
        buildQQPlaybackUrl('/api/qq/song/url', qqSong, settings), provider, qqCookie,
      ),
      loadSongLyrics(song, neteaseCookie, qqCookie),
    ]);
    return { provider, qqSong, urlData: playback.data, lyricData: lyrics.data };
  }
  const [playback, lyrics] = await Promise.all([
    loadCloudPayload<{ url?: string; message?: string }>(
      buildNeteasePlaybackUrl('/api/netease/url', song.id, settings), provider, neteaseCookie,
    ),
    loadSongLyrics(song, neteaseCookie, qqCookie),
  ]);
  return { provider, urlData: playback.data, lyricData: lyrics.data };
}
