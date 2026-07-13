import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAYLIST_STORAGE_KEY,
  createDefaultPlaylists,
  readPinnedNeteasePlaylistsStorage,
  readSavedPlaylists,
  readSearchProviderStorage,
  writePinnedNeteasePlaylistsStorage,
  writeSavedPlaylists,
  writeSearchProviderStorage,
} from './uiStorage';

describe('UI storage compatibility', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the existing playlist storage key and defaults', () => {
    expect(PLAYLIST_STORAGE_KEY).toBe('sonic-topography-playlists-v1');
    expect(readSavedPlaylists()).toEqual(createDefaultPlaylists());
  });

  it('round-trips saved and pinned playlists', () => {
    const playlists = [{ id: 'favorites', name: 'Favorites', songs: [] }];
    writeSavedPlaylists(playlists);
    writePinnedNeteasePlaylistsStorage(['123']);
    expect(readSavedPlaylists()).toEqual(playlists);
    expect(readPinnedNeteasePlaylistsStorage()).toEqual(['123']);
  });

  it('falls back safely for malformed legacy data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(PLAYLIST_STORAGE_KEY, '{bad json');
    expect(readSavedPlaylists()).toEqual(createDefaultPlaylists());
    expect(warn).toHaveBeenCalled();
  });

  it('preserves provider defaults and QQ selection', () => {
    expect(readSearchProviderStorage()).toBe('netease');
    writeSearchProviderStorage('qq');
    expect(readSearchProviderStorage()).toBe('qq');
  });
});
