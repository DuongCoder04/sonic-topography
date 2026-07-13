import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMusicSearchUrl, loadSongLyrics, syncNeteaseProxyCookie } from './musicApi';

describe('music API client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))));

  it('keeps provider-specific search contracts', () => {
    expect(buildMusicSearchUrl('qq', 'hello world', true)).toBe('/api/qq/search?keywords=hello%20world&limit=30');
    expect(buildMusicSearchUrl('netease', 'hello world', false)).toBe('/api/netease/search?keywords=hello%20world');
    expect(buildMusicSearchUrl('netease', 'hello world', true)).toBe('/api/netease/search?keywords=hello%20world&limit=30');
  });

  it('syncs the Netease proxy cookie using the existing payload', async () => {
    await syncNeteaseProxyCookie('MUSIC_U=value');
    expect(fetch).toHaveBeenCalledWith('/api/netease/cookie', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ cookie: 'MUSIC_U=value' }),
    }));
  });

  it('builds QQ lyric requests from the shared song type', async () => {
    await loadSongLyrics({
      provider: 'qq', id: 'mid-1', qqId: 42, mid: 'mid-1', name: 'Song', artist: '', album: '', duration: 0, fee: 0,
    }, '', 'uin=1');
    expect(fetch).toHaveBeenCalledWith('/api/qq/lyric?mid=mid-1&id=42', expect.objectContaining({
      headers: expect.objectContaining({ 'X-QQ-Music-Cookie': expect.any(String) }),
    }));
  });
});
