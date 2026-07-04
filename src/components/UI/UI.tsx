import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, SkipForward, SkipBack, Palette, Plus, ListMusic, Shuffle, Repeat, Trash2, Minus, Square, X, Search, Lock, Unlock, Menu, Settings, Pin, ChevronDown, ChevronUp, Mic } from 'lucide-react';
import { engine } from '../../lib/AudioEngine';
import { BUILT_IN_THEME_IDS, CUSTOM_THEME_ID, createCustomThemePreset, themes, type CustomThemeSettings, type ThemeColors, type ThemeRotationSettings } from '../../lib/themes';
import {
  DEFAULT_FLOATING_BLOCK_INTENSITY,
  DEFAULT_FLOATING_BLOCK_MAX_SIZE,
  DEFAULT_FLOATING_BLOCK_MIN_SIZE,
  DEFAULT_FLOATING_BLOCK_SPEED,
  DEFAULT_FLOATING_BLOCKS_ENABLED,
  DEFAULT_FLOATING_BLOCK_COUNT,
  DEFAULT_GROUND_EQ_VALUE,
  DEFAULT_GROUND_MOTION_SPEED,
  DEFAULT_TERRAIN_DENSITY,
  defaultGroundEqBands,
  deriveTerrainGridSettings,
  type GroundEqBandId,
  type StoredGroundEqSettings,
} from '../../lib/groundEqSettings';
import { LyricsDisplay } from './LyricsDisplay';
import { SplashScreen } from './SplashScreen';
import {
  readDisplaySettingsStorage,
  writeDisplaySettingsStorage,
  type DisplaySettings,
} from '../../lib/displaySettings';
import { ClockDisplay } from './ClockDisplay';
import { extractAudioMetadata } from '../../lib/metadata';
import {
  createNeteaseCookieHeaders,
  readNeteaseCookieStorage,
  writeNeteaseCookieStorage,
} from '../../lib/neteaseCookie';
import {
  createQQCookieHeaders,
  getQQCookieLoginState,
  readQQCookieStorage,
  writeQQCookieStorage,
} from '../../lib/qqCookie';
import {
  readTriggerSettingsStorage,
  writeTriggerSettingsStorage,
  type StoredTriggerConfig,
} from '../../lib/triggerSettings';
import {
  createPresetTransferPackage,
  normalizePresetTransferPackage,
  writePresetTransferPackage,
  type PresetTransferPackage,
} from '../../lib/presetTransfer';
import {
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_SPATIAL_ORBIT_OFFSET,
  MAX_CHARS_PER_LINE_MAX,
  MAX_CHARS_PER_LINE_MIN,
  SPATIAL_ORBIT_OFFSET_MAX,
  SPATIAL_ORBIT_OFFSET_MIN,
  type LyricsSettings
} from '../../lib/lyricsSettings';
import { readLastPlayedStorage, writeLastPlayedStorage, type LastPlayedState } from '../../lib/lastPlayedStorage';
import {
  buildNeteasePlaybackUrl,
  buildQQPlaybackUrl,
  NETEASE_PLAYBACK_BITRATE_OPTIONS,
  QQ_PLAYBACK_QUALITY_OPTIONS,
  readPlaybackQualitySettingsStorage,
  writePlaybackQualitySettingsStorage,
  type NeteasePlaybackBitrate,
  type PlaybackQualitySettings,
  type QQPlaybackQuality,
} from '../../lib/playbackQuality';
import {
  hasMediaDeviceSupport,
  listAudioInputDevices,
  type AudioInputDevice,
  type AudioInputMode,
} from '../../lib/audioInput';
import {
  readSkippedUpdateVersionStorage,
  shouldShowUpdatePrompt,
  writeSkippedUpdateVersionStorage,
} from '../../lib/updatePrompt';

interface UIProps {
  theme: string;
  resolvedTheme: ThemeColors;
  customThemes: CustomThemeSettings[];
  activeCustomThemeId: string;
  themeRotation: ThemeRotationSettings;
  groundEqSettings: StoredGroundEqSettings;
  onThemeChange: (theme: string) => void;
  onCustomThemesChange: (settings: CustomThemeSettings[], activeId?: string) => void;
  onThemeRotationChange: (settings: ThemeRotationSettings) => void;
  onGroundEqSettingsChange: (settings: StoredGroundEqSettings) => void;
  lyricsSettings: LyricsSettings;
  onLyricsSettingsChange: (settings: LyricsSettings) => void;
  globalSceneSettings: { rotationSpeed: number };
  onGlobalSceneSettingsChange: (patch: { rotationSpeed?: number }) => void;
  onCurrentSongChange?: (song: NeteaseSong | null) => void;
  onCurrentLyricsChange?: (lyrics: string) => void;
  onLyricsVisibilityChange?: (visible: boolean) => void;
  onCoverVisibilityChange?: (visible: boolean) => void;
  isPerspectiveEditMode?: boolean;
  onPerspectiveEditModeChange?: (mode: boolean) => void;
  onResetCamera?: () => void;
}

interface NeteaseSong {
  provider?: 'netease' | 'qq';
  id: number | string;
  qqId?: number | string;
  mid?: string;
  songmid?: string;
  mediaMid?: string;
  cover?: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
}

interface SavedPlaylist {
  id: string;
  name: string;
  songs: NeteaseSong[];
}

interface NeteasePlaylistSummary {
  provider?: 'netease' | 'qq';
  id: number | string;
  name: string;
  trackCount: number;
  loadedCount?: number;
  cover?: string;
  creator?: string;
  isFavorite?: boolean;
}

type PlayMode = 'sequence' | 'shuffle';
type OptionsTab = 'Pulse' | 'Meteor' | 'FloatingBlocks' | 'GroundEq' | 'Color' | 'Audio' | 'Account' | 'Lyrics' | 'Display';
type NeteaseCloudTab = 'liked' | 'playlists' | 'daily';
type CloudProvider = 'netease' | 'qq';
type SearchProvider = 'netease' | 'qq';
type PendingDelete =
  | { type: 'song'; playlistId: string; songId: number | string; label: string }
  | { type: 'playlist'; playlistId: string; label: string };

interface UpdateReleaseInfo {
  tagName?: string;
  name?: string;
  htmlUrl?: string;
  publishedAt?: string;
  notes?: string;
}

interface AvailableUpdateInfo {
  configured?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  release?: UpdateReleaseInfo;
}

interface UpdateDownloadJob {
  id: string;
  status: 'queued' | 'downloading' | 'ready' | 'failed';
  version?: string;
  name?: string;
  received?: number;
  total?: number;
  filePath?: string;
  error?: string;
  channelName?: string;
}

const PLAYLIST_STORAGE_KEY = 'sonic-topography-playlists-v1';
const SIDE_NAV_HINT_STORAGE_KEY = 'sonic-topography-side-nav-hint-seen-v1';
const SEARCH_PROVIDER_STORAGE_KEY = 'sonic-topography-search-provider-v1';
const baseUrl = import.meta.env.BASE_URL || '/';

const PINNED_NETEASE_PLAYLISTS_STORAGE_KEY = 'sonic-topography-pinned-netease-v1';
const PINNED_QQ_PLAYLISTS_STORAGE_KEY = 'sonic-topography-pinned-qq-v1';

function readPinnedNeteasePlaylistsStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINNED_NETEASE_PLAYLISTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writePinnedNeteasePlaylistsStorage(pinned: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PINNED_NETEASE_PLAYLISTS_STORAGE_KEY, JSON.stringify(pinned));
}

function readPinnedQQPlaylistsStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINNED_QQ_PLAYLISTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writePinnedQQPlaylistsStorage(pinned: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PINNED_QQ_PLAYLISTS_STORAGE_KEY, JSON.stringify(pinned));
}

function readSideNavHintSeen() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDE_NAV_HINT_STORAGE_KEY) === '1';
}

function writeSideNavHintSeen() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDE_NAV_HINT_STORAGE_KEY, '1');
}

function readSearchProviderStorage(): SearchProvider {
  if (typeof window === 'undefined') return 'netease';
  return window.localStorage.getItem(SEARCH_PROVIDER_STORAGE_KEY) === 'qq' ? 'qq' : 'netease';
}

function writeSearchProviderStorage(provider: SearchProvider) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEARCH_PROVIDER_STORAGE_KEY, provider);
}

function createDefaultPlaylists(): SavedPlaylist[] {
  return [
    { id: 'favorites', name: 'Favorites', songs: [] },
    { id: 'visual-set', name: 'Visual Set', songs: [] },
  ];
}

function readSavedPlaylists(): SavedPlaylist[] {
  try {
    const raw = window.localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (!raw) return createDefaultPlaylists();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return createDefaultPlaylists();
    return parsed.map((playlist: SavedPlaylist) => ({
      id: playlist.id,
      name: playlist.name,
      songs: Array.isArray(playlist.songs) ? playlist.songs : [],
    }));
  } catch (error) {
    console.warn('Unable to read saved playlists:', error);
    return createDefaultPlaylists();
  }
}

function hasSavedSongs(playlists: SavedPlaylist[]): boolean {
  return playlists.some((playlist) => playlist.songs.length > 0);
}

function songIdentity(song: Pick<NeteaseSong, 'id' | 'provider'>) {
  return `${song.provider || 'netease'}:${String(song.id)}`;
}

function songSourceLabel(song: NeteaseSong | null) {
  if (!song) return 'Local Audio';
  return song.provider === 'qq' ? 'QQ Music' : 'Netease Cloud';
}

function MarqueeTitle({ title }: { title: string }) {
  return (
    <div className="player-panel-title-marquee" title={title}>
      <div className="player-panel-title-track" aria-hidden="true">
        <span>{title}</span>
        <span>{title}</span>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

function CoverArt({
  src,
  title,
  className = '',
  iconSize = 18,
}: {
  src?: string;
  title: string;
  className?: string;
  iconSize?: number;
}) {
  const baseClass = `shrink-0 overflow-hidden rounded-sm border border-white/10 bg-white/[0.04] ${className}`;

  if (src) {
    return (
      <img
        src={src}
        alt={`${title} album cover`}
        className={`${baseClass} object-cover`}
        loading="lazy"
        draggable={false}
      />
    );
  }

  return (
    <div className={`${baseClass} grid place-items-center text-white/35`}>
      <ListMusic size={iconSize} />
    </div>
  );
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '22d3ee';
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function rgbFromHex(hex: string) {
  const normalized = hex.replace('#', '');
  const value = /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized : '22d3ee';
  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
  };
}

function relativeLuminanceFromHex(hex: string) {
  const { red, green, blue } = rgbFromHex(hex);
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function readableAccentColor(accentHex: string, isLightSurface: boolean) {
  const { red, green, blue } = rgbFromHex(accentHex);
  const max = Math.max(red, green, blue) / 255;
  const min = Math.min(red, green, blue) / 255;
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case red / 255:
        hue = ((green / 255 - blue / 255) / delta + (green < blue ? 6 : 0)) * 60;
        break;
      case green / 255:
        hue = ((blue / 255 - red / 255) / delta + 2) * 60;
        break;
      default:
        hue = ((red / 255 - green / 255) / delta + 4) * 60;
    }
  }

  const readableLightness = isLightSurface ? Math.min(lightness * 100, 34) : Math.max(lightness * 100, 62);
  const readableSaturation = Math.max(saturation * 100, isLightSurface ? 45 : 52);
  return `hsl(${Math.round(hue)} ${Math.round(readableSaturation)}% ${Math.round(readableLightness)}%)`;
}

function themedPanelStyle(accentHex: string, opacity = 0.84): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${colorWithAlpha(accentHex, 0.11)}, rgba(8, 11, 16, ${opacity}) 34%, rgba(8, 11, 16, ${Math.min(opacity + 0.06, 0.96)}))`,
    borderColor: colorWithAlpha(accentHex, 0.24),
    boxShadow: `0 24px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${colorWithAlpha(accentHex, 0.05)}`,
  };
}

function activeControlStyle(accentHex: string): React.CSSProperties {
  return {
    backgroundColor: colorWithAlpha(accentHex, 0.16),
    borderColor: colorWithAlpha(accentHex, 0.45),
    color: accentHex,
  };
}

function primaryGhostStyle(accentHex: string): React.CSSProperties {
  return {
    backgroundColor: colorWithAlpha(accentHex, 0.14),
    borderColor: colorWithAlpha(accentHex, 0.35),
    color: accentHex,
  };
}

function applyStoredTriggerConfig(config: typeof engine.pulseTrigger, stored?: Partial<StoredTriggerConfig>) {
  if (!stored) return;
  if (typeof stored.enabled === 'boolean') config.enabled = stored.enabled;
  if (stored.mode === 'Auto Beat' || stored.mode === 'Advanced') config.mode = stored.mode;
  if (Number.isFinite(stored.freqIndex)) config.freqIndex = Number(stored.freqIndex);
  if (Number.isFinite(stored.threshold)) config.threshold = Number(stored.threshold);
  if (Number.isFinite(stored.sensitivity)) config.sensitivity = Number(stored.sensitivity);
  if (Number.isFinite(stored.cooldown)) config.cooldown = Number(stored.cooldown);
  if (Number.isFinite(stored.bandStart)) config.bandStart = Number(stored.bandStart);
  if (Number.isFinite(stored.bandEnd)) config.bandEnd = Number(stored.bandEnd);
  if (Number.isFinite(stored.pulseStrength)) config.pulseStrength = Number(stored.pulseStrength);
  if (typeof stored.autoTrack === 'boolean') config.autoTrack = stored.autoTrack;
}

function snapshotTriggerConfig(config: typeof engine.pulseTrigger): StoredTriggerConfig {
  return {
    enabled: config.enabled,
    mode: config.mode,
    freqIndex: config.freqIndex,
    threshold: config.threshold,
    sensitivity: config.sensitivity,
    cooldown: config.cooldown,
    bandStart: config.bandStart,
    bandEnd: config.bandEnd,
    pulseStrength: config.pulseStrength,
    autoTrack: config.autoTrack,
  };
}

function loadStoredTriggerSettings() {
  const settings = readTriggerSettingsStorage();
  applyStoredTriggerConfig(engine.pulseTrigger, settings.Pulse);
  applyStoredTriggerConfig(engine.meteorTrigger, settings.Meteor);
}

loadStoredTriggerSettings();

export function UI({ theme, resolvedTheme, customThemes, activeCustomThemeId, themeRotation, groundEqSettings, onThemeChange, onCustomThemesChange, onThemeRotationChange, onGroundEqSettingsChange, lyricsSettings, onLyricsSettingsChange, globalSceneSettings, onGlobalSceneSettingsChange, onCurrentSongChange, onCurrentLyricsChange, onLyricsVisibilityChange, onCoverVisibilityChange, isPerspectiveEditMode, onPerspectiveEditModeChange, onResetCamera }: UIProps) {
  const currentStyleConfig = lyricsSettings[lyricsSettings.style] || (lyricsSettings as any)['songyancai'] || {
    activeFontSize: 32, inactiveFontSize: 18, fontColor: '#ffffff', glowColor: '#00ffff',
    followThemeGlow: true, karaokeColor: '#00ffff', followThemeKaraoke: true,
    position: 'center', triggerBand: 'subBass', fontFamily: 'serif', maxCharsPerLine: DEFAULT_MAX_CHARS_PER_LINE, spatialOrbitOffset: DEFAULT_SPATIAL_ORBIT_OFFSET
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoAudioUrl = `${baseUrl}demo.mp3`;
  const demoLyricsUrl = `${baseUrl}demo.lrc`;
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
    // 在这里可以执行额外的初始化，如加载音频等
  };
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackName, setTrackName] = useState<string>('No track selected');
  const [lyricsText, setLyricsText] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('sonic-volume');
      if (saved !== null) {
        const v = parseFloat(saved);
        if (!isNaN(v) && v >= 0 && v <= 1) return v;
      }
    }
    return 1;
  });

  useEffect(() => {
    engine.setVolume(volume);
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
  const [showAudioInputPanel, setShowAudioInputPanel] = useState(false);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(readDisplaySettingsStorage);
  const [playbackQualitySettings, setPlaybackQualitySettings] = useState<PlaybackQualitySettings>(readPlaybackQualitySettingsStorage);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showNeteasePanel, setShowNeteasePanel] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('netease');
  const [searchProvider, setSearchProviderState] = useState<SearchProvider>(readSearchProviderStorage);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NeteaseSong[]>([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [neteaseCloudTab, setNeteaseCloudTab] = useState<NeteaseCloudTab>('daily');
  const [neteaseCloudSongs, setNeteaseCloudSongs] = useState<NeteaseSong[]>([]);
  const [neteaseCloudPlaylists, setNeteaseCloudPlaylists] = useState<NeteasePlaylistSummary[]>([]);
  const [activeNeteasePlaylistId, setActiveNeteasePlaylistId] = useState<number | string | null>(null);
  const [neteaseCloudStatus, setNeteaseCloudStatus] = useState('');
  const [isLoadingNeteaseCloud, setIsLoadingNeteaseCloud] = useState(false);
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(readSavedPlaylists);
  const [activePlaylistId, setActivePlaylistId] = useState('favorites');
  const [songToAdd, setSongToAdd] = useState<NeteaseSong | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('sequence');
  const [playQueue, setPlayQueue] = useState<NeteaseSong[]>([]);
  const [currentSongId, setCurrentSongId] = useState<number | string | null>(null);
  const [currentSong, setCurrentSongState] = useState<NeteaseSong | null>(null);
  const [audioInputMode, setAudioInputMode] = useState<AudioInputMode>('player');
  const [audioInputDevices, setAudioInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const [audioInputStatus, setAudioInputStatus] = useState('');

  const setCurrentSong = (song: NeteaseSong | null) => {
    setCurrentSongState(song);
    if (onCurrentSongChange) {
      onCurrentSongChange(song);
    }
  };

  useEffect(() => {
    onCurrentLyricsChange?.(lyricsText);
  }, [lyricsText, onCurrentLyricsChange]);

  useEffect(() => {
    onLyricsVisibilityChange?.(displaySettings.showLyrics);
  }, [displaySettings.showLyrics, onLyricsVisibilityChange]);

  useEffect(() => {
    onCoverVisibilityChange?.(displaySettings.showCover);
  }, [displaySettings.showCover, onCoverVisibilityChange]);

  const [currentCover, setCurrentCover] = useState<string>('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [neteaseCookie, setNeteaseCookie] = useState(readNeteaseCookieStorage);
  const [qqCookie, setQQCookie] = useState(readQQCookieStorage);
  const [cookieStatus, setCookieStatus] = useState('');
  const [qqCookieStatus, setQQCookieStatus] = useState('');
  const [isNeteaseCookieValid, setIsNeteaseCookieValid] = useState(false);
  const [isQQCookieValid, setIsQQCookieValid] = useState(false);
  const [isSyncingNeteaseCookie, setIsSyncingNeteaseCookie] = useState(false);
  const [isSyncingQQCookie, setIsSyncingQQCookie] = useState(false);
  const [desktopLoginStatus, setDesktopLoginStatus] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdateInfo | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [downloadJob, setDownloadJob] = useState<UpdateDownloadJob | null>(null);
  const [skippedUpdateVersion, setSkippedUpdateVersion] = useState(readSkippedUpdateVersionStorage);
  const [isMobileSideNavOpen, setIsMobileSideNavOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [fetchedNeteasePlaylists, setFetchedNeteasePlaylists] = useState<NeteasePlaylistSummary[]>([]);
  const [fetchedQQPlaylists, setFetchedQQPlaylists] = useState<NeteasePlaylistSummary[]>([]);
  const [pinnedNeteasePlaylists, setPinnedNeteasePlaylists] = useState<string[]>(readPinnedNeteasePlaylistsStorage);
  const [pinnedQQPlaylists, setPinnedQQPlaylists] = useState<string[]>(readPinnedQQPlaylistsStorage);
  const [showAllNetease, setShowAllNetease] = useState(false);
  const [showAllQQ, setShowAllQQ] = useState(false);

  useEffect(() => {
    writePinnedNeteasePlaylistsStorage(pinnedNeteasePlaylists);
  }, [pinnedNeteasePlaylists]);

  useEffect(() => {
    writePinnedQQPlaylistsStorage(pinnedQQPlaylists);
  }, [pinnedQQPlaylists]);

  const [activeRightSidebarSelection, setActiveRightSidebarSelection] = useState<{type: 'local'|'netease_daily'|'netease_liked'|'netease_playlist'|'qq_liked'|'qq_playlist', id?: string | number}>({type: 'local', id: 'favorites'});
  const [hasSeenSideNavHint, setHasSeenSideNavHint] = useState(readSideNavHintSeen);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presetTransferStatus, setPresetTransferStatus] = useState('');
  const hasLoadedPlaylistsRef = useRef(false);
  const updatePollTimerRef = useRef<number | null>(null);
  const hasBothCloudLogins = isNeteaseCookieValid && isQQCookieValid;
  const effectiveSearchProvider: SearchProvider = hasBothCloudLogins
    ? searchProvider
    : (isQQCookieValid && !isNeteaseCookieValid ? 'qq' : 'netease');
  const activeCloudLabel = cloudProvider === 'qq' ? 'QQ音乐' : '网易云';
  const effectiveSearchLabel = effectiveSearchProvider === 'qq' ? 'QQ 音乐' : '网易云';

  const setSearchProvider = (provider: SearchProvider) => {
    setSearchProviderState(provider);
    writeSearchProviderStorage(provider);
  };

  const markSideNavHintSeen = () => {
    if (hasSeenSideNavHint) return;
    writeSideNavHintSeen();
    setHasSeenSideNavHint(true);
  };

  const openMobileSideNav = () => {
    markSideNavHintSeen();
    setIsMobileSideNavOpen(true);
  };

  const closeFloatingPanels = () => {
    setShowOptionsPanel(false);
    setShowAudioInputPanel(false);
    setShowSearchPanel(false);
    setShowNeteasePanel(false);
    setShowPlaylistPanel(false);
    setIsMobileSideNavOpen(false);
    setIsRightSidebarOpen(false);
  };

  const openOptionsPanel = () => {
    setShowAudioInputPanel(false);
    setShowSearchPanel(false);
    setShowNeteasePanel(false);
    setShowPlaylistPanel(false);
    setShowOptionsPanel(true);
    setIsMobileSideNavOpen(false);
  };

  const openSearchPanel = () => {
    setShowOptionsPanel(false);
    setShowAudioInputPanel(false);
    setShowNeteasePanel(false);
    setShowPlaylistPanel(false);
    setShowSearchPanel(true);
    setIsMobileSideNavOpen(false);
  };

  const openCloudPanel = (provider: CloudProvider) => {
    setCloudProvider(provider);
    setShowOptionsPanel(false);
    setShowAudioInputPanel(false);
    setShowSearchPanel(false);
    setShowPlaylistPanel(false);
    setShowNeteasePanel(true);
    setIsMobileSideNavOpen(false);
  };

  const openCloudPanelDefault = (provider: CloudProvider) => {
    openCloudPanel(provider);
    if (provider === 'qq') loadLikedSongs(provider);
    else loadDailyRecommendations();
  };

  const openPlaylistPanel = () => {
    setShowOptionsPanel(false);
    setShowAudioInputPanel(false);
    setShowSearchPanel(false);
    setShowNeteasePanel(false);
    setShowPlaylistPanel(true);
    setIsMobileSideNavOpen(false);
  };

  const openAudioInputPanel = () => {
    setShowOptionsPanel(false);
    setShowSearchPanel(false);
    setShowNeteasePanel(false);
    setShowPlaylistPanel(false);
    setShowAudioInputPanel(true);
    setIsMobileSideNavOpen(false);
  };

  useEffect(() => {
    writeDisplaySettingsStorage(displaySettings);
  }, [displaySettings]);

  useEffect(() => {
    writePlaybackQualitySettingsStorage(playbackQualitySettings);
  }, [playbackQualitySettings]);

  const refreshAudioInputDevices = async () => {
    if (!hasMediaDeviceSupport()) {
      setAudioInputDevices([]);
      return;
    }

    try {
      const devices = await listAudioInputDevices();
      setAudioInputDevices(devices);
      if (!selectedAudioInputId && devices[0]) setSelectedAudioInputId(devices[0].id);
      if (selectedAudioInputId && !devices.some((device) => device.id === selectedAudioInputId)) {
        setSelectedAudioInputId(devices[0]?.id || '');
        if (audioInputMode === 'microphone') {
          setAudioInputStatus('Microphone disconnected. Choose another input.');
          engine.stopExternalInput();
          setAudioInputMode('player');
          setTrackName('No track selected');
        }
      }
    } catch (error) {
      console.warn('Unable to list audio input devices:', error);
      setAudioInputStatus('Unable to read audio input devices.');
    }
  };

  useEffect(() => {
    refreshAudioInputDevices();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.addEventListener) return;
    mediaDevices.addEventListener('devicechange', refreshAudioInputDevices);
    return () => mediaDevices.removeEventListener('devicechange', refreshAudioInputDevices);
  }, [selectedAudioInputId, audioInputMode]);

  useEffect(() => {
    return () => engine.stopExternalInput();
  }, []);

  useEffect(() => {
    if (isMobileSideNavOpen) markSideNavHintSeen();
  }, [isMobileSideNavOpen]);

  useEffect(() => {
    if (!hasLoadedPlaylistsRef.current) return;
    window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
    fetch('/api/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists }),
    }).catch((error) => {
      console.warn('Unable to save playlists to local server:', error);
    });
  }, [playlists]);

  const syncNeteaseCookie = async (cookie: string, options: { silent?: boolean } = {}) => {
    const normalizedCookie = cookie.trim();
    if (normalizedCookie && !options.silent) {
      setCookieStatus('正在校验 Cookie...');
    }

    setIsSyncingNeteaseCookie(true);
    try {
      const response = await fetch('/api/netease/cookie', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });
      const data = await response.json();
      const valid = Boolean(data.valid);
      setIsNeteaseCookieValid(valid);
      if (!options.silent) {
        setCookieStatus(normalizedCookie ? (valid ? 'Cookie 可用，已开启网易云' : 'Cookie 已保存，但校验失败') : 'Cookie 已清除');
      }
      if (normalizedCookie && !valid) {
        fetch('/api/netease/cookie', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cookie: '' }),
        }).catch((error) => {
          console.warn('Unable to clear invalid Netease proxy cookie:', error);
        });
      }
      return valid;
    } catch (error) {
      console.warn('Unable to sync Netease cookie:', error);
      if (!options.silent) {
        setIsNeteaseCookieValid(false);
      }
      if (!options.silent) {
        setCookieStatus('已保存到浏览器，但同步到本地代理失败');
      }
      return options.silent && isNeteaseCookieValid;
    } finally {
      setIsSyncingNeteaseCookie(false);
    }
  };

  const syncQQCookie = async (cookie: string, options: { silent?: boolean } = {}) => {
    const normalizedCookie = cookie.trim();
    if (normalizedCookie && !options.silent) setQQCookieStatus('正在校验 QQ 音乐会话...');

    setIsSyncingQQCookie(true);
    try {
      const response = await fetch('/api/qq/login/cookie', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie }),
      });
      const data = await response.json();
      const valid = response.ok && Boolean(data.loggedIn);
      setIsQQCookieValid(valid);
      if (!options.silent) {
        setQQCookieStatus(normalizedCookie ? (valid ? 'QQ 音乐已登录' : 'QQ 音乐会话无效') : 'QQ 音乐会话已清除');
      }
      return valid;
    } catch (error) {
      console.warn('Unable to sync QQ cookie:', error);
      if (!options.silent) {
        setIsQQCookieValid(false);
        setQQCookieStatus('已保存到浏览器，但同步到本地代理失败');
      }
      return options.silent && isQQCookieValid;
    } finally {
      setIsSyncingQQCookie(false);
    }
  };

  useEffect(() => {
    const savedCookie = readNeteaseCookieStorage();
    if (savedCookie) {
      setNeteaseCookie(savedCookie);
      syncNeteaseCookie(savedCookie);
    }

    const savedQQCookie = readQQCookieStorage();
    if (savedQQCookie) {
      setQQCookie(savedQQCookie);
      syncQQCookie(savedQQCookie);
    }
  }, []);


  const saveNeteaseCookie = () => {
    writeNeteaseCookieStorage(neteaseCookie);
    const normalizedCookie = readNeteaseCookieStorage();
    setNeteaseCookie(normalizedCookie);
    syncNeteaseCookie(normalizedCookie);
  };

  const clearNeteaseCookie = async () => {
    writeNeteaseCookieStorage('');
    setNeteaseCookie('');
    setIsNeteaseCookieValid(false);
    syncNeteaseCookie('');
    if (window.sonicDesktop?.isDesktop) {
      await window.sonicDesktop.clearNeteaseLogin().catch((error) => {
        console.warn('Unable to clear Netease desktop session:', error);
      });
    }
  };

  const saveQQCookie = () => {
    writeQQCookieStorage(qqCookie);
    const normalizedCookie = readQQCookieStorage();
    setQQCookie(normalizedCookie);
    syncQQCookie(normalizedCookie);
  };

  const clearQQCookie = async () => {
    writeQQCookieStorage('');
    setQQCookie('');
    setIsQQCookieValid(false);
    setQQCookieStatus('QQ 音乐会话已清除');
    await fetch('/api/qq/logout').catch((error) => {
      console.warn('Unable to clear QQ proxy cookie:', error);
    });
    if (window.sonicDesktop?.isDesktop) {
      await window.sonicDesktop.clearQQLogin().catch((error) => {
        console.warn('Unable to clear QQ desktop session:', error);
      });
    }
  };

  const startDesktopNeteaseLogin = async () => {
    if (!window.sonicDesktop?.isDesktop) return;
    setDesktopLoginStatus('已打开网易云窗口，请在官方页面扫码登录...');
    try {
      const result = await window.sonicDesktop.openNeteaseLogin();
      if (!result?.ok || !result.cookie) {
        setDesktopLoginStatus(result?.message || result?.error || '网易云登录已取消');
        return;
      }
      writeNeteaseCookieStorage(result.cookie);
      const normalizedCookie = readNeteaseCookieStorage();
      setNeteaseCookie(normalizedCookie);
      const valid = await syncNeteaseCookie(normalizedCookie);
      setDesktopLoginStatus(valid ? '网易云账号已同步' : '网易云 Cookie 已获取，但校验失败');
    } catch (error) {
      console.warn('Unable to open Netease desktop login:', error);
      setDesktopLoginStatus('网易云登录窗口打开失败');
    }
  };

  const startDesktopQQLogin = async () => {
    if (!window.sonicDesktop?.isDesktop) return;
    setDesktopLoginStatus('已打开 QQ 音乐窗口，请在官方页面扫码登录...');
    try {
      const result = await window.sonicDesktop.openQQLogin();
      if (!result?.ok || !result.cookie) {
        setDesktopLoginStatus(result?.message || result?.error || 'QQ 音乐登录已取消');
        return;
      }
      writeQQCookieStorage(result.cookie);
      const normalizedCookie = readQQCookieStorage();
      setQQCookie(normalizedCookie);
      const valid = await syncQQCookie(normalizedCookie);
      const state = getQQCookieLoginState(normalizedCookie);
      setDesktopLoginStatus(valid
        ? (state.playbackKeyReady ? 'QQ 音乐账号已同步' : 'QQ 音乐账号已同步，播放授权可能不完整')
        : 'QQ 音乐 Cookie 已获取，但校验失败');
    } catch (error) {
      console.warn('Unable to open QQ desktop login:', error);
      setDesktopLoginStatus('QQ 音乐登录窗口打开失败');
    }
  };

  const clearUpdatePollTimer = () => {
    if (updatePollTimerRef.current !== null) {
      window.clearTimeout(updatePollTimerRef.current);
      updatePollTimerRef.current = null;
    }
  };

  const checkForUpdate = async (options: { silent?: boolean; manual?: boolean } = {}) => {
    setIsCheckingUpdate(true);
    if (!options.silent) setUpdateStatus('正在检查更新...');
    try {
      const response = await fetch('/api/update/latest');
      const data = await response.json();
      if (!data.configured) {
        if (!options.silent) setUpdateStatus('更新源未配置。配置 GitHub owner/repo 后即可检查新版本。');
        return;
      }
      if (!data.updateAvailable) {
        if (!options.silent) setUpdateStatus(`当前已是最新版本 ${data.currentVersion}`);
        return;
      }
      setAvailableUpdate(data);
      setDownloadJob(null);
      setUpdateStatus(`发现新版本 ${data.latestVersion}`);
      if (options.manual || shouldShowUpdatePrompt(data.latestVersion, skippedUpdateVersion)) {
        setShowUpdatePrompt(true);
      }
    } catch (error) {
      console.warn('Unable to check updates:', error);
      if (!options.silent) setUpdateStatus('检查更新失败');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const startUpdateDownload = async () => {
    clearUpdatePollTimer();
    setUpdateStatus('正在启动更新下载...');
    try {
      const downloadResponse = await fetch('/api/update/download', { method: 'POST' });
      const downloadData = await downloadResponse.json();
      if (!downloadData.ok || !downloadData.job?.id) {
        setUpdateStatus(downloadData.error || '更新下载启动失败');
        return;
      }
      setDownloadJob(downloadData.job);
      const poll = async () => {
        try {
          const statusResponse = await fetch(`/api/update/download/status?id=${encodeURIComponent(downloadData.job.id)}`);
          const statusData = await statusResponse.json();
          const job = statusData.job as UpdateDownloadJob | undefined;
          if (!job) {
            setUpdateStatus('更新下载任务丢失');
            return;
          }
          setDownloadJob(job);
          if (job.status === 'ready') {
            setUpdateStatus('安装包已下载，正在打开...');
            if (window.sonicDesktop?.isDesktop && job.filePath) await window.sonicDesktop.openUpdateInstaller(job.filePath);
            return;
          }
          if (job.status === 'failed') {
            setUpdateStatus(job.error || '更新下载失败，可能是 GitHub 或镜像连接受限。');
            return;
          }
          const total = Number(job.total || 0);
          const progress = total > 0
            ? `${formatBytes(job.received)} / ${formatBytes(total)}`
            : `已下载 ${formatBytes(job.received)}`;
          setUpdateStatus(`正在通过 ${job.channelName || '下载通道'} 下载... ${progress}`);
          updatePollTimerRef.current = window.setTimeout(poll, 1000);
        } catch (error) {
          console.warn('Unable to poll update download:', error);
          setUpdateStatus('更新下载状态读取失败');
        }
      };
      poll();
    } catch (error) {
      console.warn('Unable to start update download:', error);
      setUpdateStatus('更新下载启动失败');
    }
  };

  const remindUpdateLater = () => {
    setShowUpdatePrompt(false);
  };

  const skipThisUpdateVersion = () => {
    const version = availableUpdate?.latestVersion || '';
    writeSkippedUpdateVersionStorage(version);
    setSkippedUpdateVersion(version);
    setShowUpdatePrompt(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkForUpdate({ silent: true });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [skippedUpdateVersion]);

  useEffect(() => clearUpdatePollTimer, []);

  const syncImportedPlaylists = (nextPlaylists: SavedPlaylist[]) => {
    fetch('/api/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: nextPlaylists }),
    }).catch((error) => {
      console.warn('Unable to save imported playlists to local server:', error);
    });
  };

  const applyPresetTransferPackage = async (presetPackage: PresetTransferPackage) => {
    const normalized = writePresetTransferPackage(presetPackage);
    const data = normalized.data;

    applyStoredTriggerConfig(engine.pulseTrigger, data.triggerSettings.Pulse);
    applyStoredTriggerConfig(engine.meteorTrigger, data.triggerSettings.Meteor);
    onCustomThemesChange(data.customThemes, data.activeCustomThemeId);
    onThemeRotationChange(data.themeRotation);
    onGroundEqSettingsChange(data.groundEqSettings);
    onThemeChange(data.activeThemeId);

    setPlaylists(data.playlists);
    setActivePlaylistId(data.playlists[0]?.id || 'favorites');
    syncImportedPlaylists(data.playlists);

    const importedCookie = data.neteaseCookie || '';
    setNeteaseCookie(importedCookie);
    if (importedCookie) {
      await syncNeteaseCookie(importedCookie);
    } else {
      setIsNeteaseCookieValid(false);
      await syncNeteaseCookie('', { silent: true });
    }

    setPresetTransferStatus('预设已导入，当前页面已更新');
  };

  const ensureCloudCookieReady = async (provider: CloudProvider = cloudProvider) => {
    const label = provider === 'qq' ? 'QQ 音乐' : '网易云';
    const savedCookie = provider === 'qq' ? readQQCookieStorage() : readNeteaseCookieStorage();
    if (!savedCookie.trim()) {
      if (provider === 'qq') setIsQQCookieValid(false);
      else setIsNeteaseCookieValid(false);
      setNeteaseCloudStatus(`请先在设置里登录可用的${label}账号`);
      openOptionsPanel();
      return '';
    }

    if (provider === 'qq') setQQCookie(savedCookie);
    else setNeteaseCookie(savedCookie);
    const valid = provider === 'qq'
      ? await syncQQCookie(savedCookie, { silent: isQQCookieValid })
      : await syncNeteaseCookie(savedCookie, { silent: isNeteaseCookieValid });
    if (!valid) {
      setNeteaseCloudStatus(`${label}账号需要重新登录`);
      openOptionsPanel();
      return '';
    }

    return savedCookie;
  };

  const fetchNeteaseSongs = async (url: string, emptyMessage: string, provider: CloudProvider = cloudProvider) => {
    const readyCookie = await ensureCloudCookieReady(provider);
    if (!readyCookie) return;
    const label = provider === 'qq' ? 'QQ音乐' : '网易云';

    setIsLoadingNeteaseCloud(true);
    setNeteaseCloudStatus('正在加载...');

    try {
      const response = await fetch(url, {
        headers: provider === 'qq' ? createQQCookieHeaders(readyCookie) : createNeteaseCookieHeaders(readyCookie),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          if (provider === 'qq') setIsQQCookieValid(false);
          else setIsNeteaseCookieValid(false);
          setNeteaseCloudStatus(`${label}账号失效了，请重新登录`);
          openOptionsPanel();
        } else {
          setNeteaseCloudStatus(`${label}接口临时失败，请稍后再试`);
        }
        return;
      }

      const songs = Array.isArray(data.songs) ? data.songs : [];
      if (songs.length === 0) {
        setNeteaseCloudSongs([]);
        setNeteaseCloudStatus(emptyMessage);
        return;
      }

      setNeteaseCloudSongs(songs.map((song: NeteaseSong) => ({ ...song, provider: song.provider || provider })));
      if (typeof data.status === 'string') {
        setNeteaseCloudStatus(data.status);
      } else if (data.fallback) {
        setNeteaseCloudStatus('已使用推荐内容');
      } else if (data.playlist || typeof data.loadedCount === 'number') {
        const totalCount = Number(data.totalCount || data.playlist?.trackCount || data.rawTrackCount || 0);
        setNeteaseCloudStatus(totalCount > 0 ? `已加载 ${songs.length} / ${totalCount} 首` : `已加载 ${songs.length} 首`);
      } else {
        setNeteaseCloudStatus('');
      }
    } catch (error) {
      console.warn('Unable to load cloud songs:', error);
      setNeteaseCloudStatus('加载失败，请稍后再试');
    } finally {
      setIsLoadingNeteaseCloud(false);
    }
  };

  const loadDailyRecommendations = async () => {
    const provider: CloudProvider = 'netease';
    setCloudProvider(provider);
    setNeteaseCloudTab('daily');
    setActiveNeteasePlaylistId(null);
    await fetchNeteaseSongs('/api/netease/daily-recommend?limit=50', '每日推荐里暂时没有可播放歌曲', provider);
  };

  const loadLikedSongs = async (provider: CloudProvider = cloudProvider) => {
    setCloudProvider(provider);
    setNeteaseCloudTab('liked');
    setActiveNeteasePlaylistId(null);
    if (provider === 'netease') {
      await fetchNeteaseSongs('/api/netease/liked?limit=all', '喜欢列表里暂时没有可播放歌曲', provider);
      return;
    }
    const readyCookie = await ensureCloudCookieReady('qq');
    if (!readyCookie) return;
    setIsLoadingNeteaseCloud(true);
    setNeteaseCloudStatus('正在加载完整喜欢列表...');
    try {
      const response = await fetch('/api/qq/user/playlists', { headers: createQQCookieHeaders(readyCookie) });
      const data = await response.json();
      if (!response.ok) {
        setIsQQCookieValid(false);
        setNeteaseCloudStatus('QQ 音乐账号失效了，请重新登录');
        openOptionsPanel();
        return;
      }
      const playlists = Array.isArray(data.playlists) ? data.playlists : [];
      setNeteaseCloudPlaylists(playlists);
      const favorite = playlists.find((playlist: NeteasePlaylistSummary) => playlist.isFavorite) || playlists[0];
      if (!favorite) {
        setNeteaseCloudSongs([]);
        setNeteaseCloudStatus('没有找到 QQ 音乐收藏歌单');
        return;
      }
      setActiveNeteasePlaylistId(favorite.id);
      await fetchNeteaseSongs(`/api/qq/playlist/tracks?id=${encodeURIComponent(String(favorite.id))}&limit=all`, '喜欢列表里暂时没有可播放歌曲', provider);
    } catch (error) {
      console.warn('Unable to load QQ liked songs:', error);
      setNeteaseCloudStatus('喜欢列表加载失败，请稍后再试');
    } finally {
      setIsLoadingNeteaseCloud(false);
    }
  };

  const loadNeteasePlaylists = async (provider: CloudProvider = cloudProvider) => {
    setCloudProvider(provider);
    setNeteaseCloudTab('playlists');
    setNeteaseCloudSongs([]);
    setActiveNeteasePlaylistId(null);
    const readyCookie = await ensureCloudCookieReady(provider);
    if (!readyCookie) return;
    const label = provider === 'qq' ? 'QQ音乐' : '网易云';

    setIsLoadingNeteaseCloud(true);
    setNeteaseCloudStatus('正在加载完整歌单...');

    try {
      const response = await fetch(provider === 'qq' ? '/api/qq/user/playlists' : '/api/netease/playlists', {
        headers: provider === 'qq' ? createQQCookieHeaders(readyCookie) : createNeteaseCookieHeaders(readyCookie),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          if (provider === 'qq') setIsQQCookieValid(false);
          else setIsNeteaseCookieValid(false);
          setNeteaseCloudStatus(`${label}账号失效了，请重新登录`);
          openOptionsPanel();
        } else {
          setNeteaseCloudStatus(`${label}接口临时失败，请稍后再试`);
        }
        return;
      }

      const cloudPlaylists = (Array.isArray(data.playlists) ? data.playlists : [])
        .filter((playlist: NeteasePlaylistSummary) => provider !== 'qq' || !playlist.isFavorite);
      setNeteaseCloudPlaylists(cloudPlaylists);
      setNeteaseCloudStatus(cloudPlaylists.length ? '请选择一个歌单' : `没有找到${label}歌单`);
    } catch (error) {
      console.warn('Unable to load cloud playlists:', error);
      setNeteaseCloudStatus('歌单加载失败，请稍后再试');
    } finally {
      setIsLoadingNeteaseCloud(false);
    }
  };

  const loadNeteasePlaylistSongs = async (playlist: NeteasePlaylistSummary) => {
    const provider = playlist.provider || cloudProvider;
    setCloudProvider(provider);
    setActiveNeteasePlaylistId(playlist.id);
    const url = provider === 'qq'
      ? `/api/qq/playlist/tracks?id=${encodeURIComponent(String(playlist.id))}&limit=all`
      : `/api/netease/playlist?id=${encodeURIComponent(String(playlist.id))}&limit=all`;
    await fetchNeteaseSongs(url, '这个歌单里暂时没有可播放歌曲', provider);
  };

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const response = await fetch('/api/playlists');
        if (!response.ok) throw new Error('Playlist request failed');
        const data = await response.json();
        if (Array.isArray(data.playlists) && data.playlists.length > 0) {
          const serverPlaylists = data.playlists;
          const browserPlaylists = readSavedPlaylists();
          if (!hasSavedSongs(serverPlaylists) && hasSavedSongs(browserPlaylists)) {
            setPlaylists(browserPlaylists);
          } else {
            setPlaylists(serverPlaylists);
          }
        }
      } catch (error) {
        console.warn('Using browser playlist storage:', error);
      } finally {
        hasLoadedPlaylistsRef.current = true;
      }
    };

    loadPlaylists();
  }, []);

  useEffect(() => {
    if (isRightSidebarOpen) {
      if (isNeteaseCookieValid && fetchedNeteasePlaylists.length === 0) {
        ensureCloudCookieReady('netease').then(cookie => {
          if (!cookie) return;
          fetch('/api/netease/playlists', { headers: createNeteaseCookieHeaders(cookie) })
            .then(res => res.json())
            .then(data => {
               if (data.playlists) setFetchedNeteasePlaylists(data.playlists);
            }).catch(() => {});
        });
      }
      if (isQQCookieValid && fetchedQQPlaylists.length === 0) {
        ensureCloudCookieReady('qq').then(cookie => {
          if (!cookie) return;
          fetch('/api/qq/user/playlists', { headers: createQQCookieHeaders(cookie) })
            .then(res => res.json())
            .then(data => {
               if (data.playlists) {
                 setFetchedQQPlaylists(data.playlists.filter((p: NeteasePlaylistSummary) => !p.isFavorite));
               }
            }).catch(() => {});
        });
      }
    }
  }, [isRightSidebarOpen, isNeteaseCookieValid, isQQCookieValid, fetchedNeteasePlaylists.length, fetchedQQPlaylists.length]);
  
  // Audio state poller
  useEffect(() => {
    const initEngine = async () => {
       await engine.init(); 
    };
    initEngine();

    const poll = () => {
      const nextIsPlaying = engine.isPlaying;
      const nextCurrentTime = engine.audioElement.currentTime || 0;
      const nextDuration = engine.audioElement.duration || 0;
      const nextVolume = engine.getVolume();

      setIsPlaying((current) => current === nextIsPlaying ? current : nextIsPlaying);
      setCurrentTime((current) => Math.abs(current - nextCurrentTime) < 0.05 ? current : nextCurrentTime);
      setDuration((current) => Math.abs(current - nextDuration) < 0.05 ? current : nextDuration);
      setVolume((current) => Math.abs(current - nextVolume) < 0.005 ? current : nextVolume);
    };
    poll();
    const intervalId = window.setInterval(poll, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.warn('Unable to toggle fullscreen:', error);
    } finally {
      setIsMobileSideNavOpen(false);
    }
  };

  const prepareExternalInputUi = (label: string, mode: AudioInputMode) => {
    setAudioInputMode(mode);
    setTrackName(label);
    setCurrentSong(null);
    setCurrentSongId(null);
    setCurrentCover('');
    setLyricsText('');
    setSearchStatus('');
    setShowSearchPanel(false);
    setShowNeteasePanel(false);
  };

  const startSystemAudioInput = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setAudioInputStatus('System audio capture is not available in this environment.');
      return;
    }
    if (window.sonicDesktop?.isDesktop && !window.sonicDesktop.supportsSystemAudioLoopback) {
      setAudioInputStatus('System audio capture is currently supported on Windows.');
      return;
    }

    try {
      setAudioInputStatus('Starting system audio...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      stream.getVideoTracks().forEach((track) => track.stop());
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setAudioInputStatus('No system audio track was captured.');
        return;
      }
      engine.loadStream(stream, 'system');
      prepareExternalInputUi('System Audio Input', 'system');
      setAudioInputStatus('Listening to system audio.');
      setShowAudioInputPanel(false);
    } catch (error) {
      console.warn('Unable to start system audio input:', error);
      setAudioInputStatus('Unable to start system audio capture.');
    }
  };

  const startMicrophoneInput = async (deviceId = selectedAudioInputId) => {
    if (!hasMediaDeviceSupport()) {
      setAudioInputStatus('Microphone capture is not available in this environment.');
      return;
    }

    try {
      setAudioInputStatus('Starting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
      await refreshAudioInputDevices();
      const device = audioInputDevices.find((item) => item.id === deviceId);
      engine.loadStream(stream, 'microphone');
      prepareExternalInputUi(device?.label ? `Mic: ${device.label}` : 'Microphone Input', 'microphone');
      setAudioInputStatus(device?.label ? `Listening to ${device.label}.` : 'Listening to microphone.');
      setShowAudioInputPanel(false);
    } catch (error) {
      console.warn('Unable to start microphone input:', error);
      setAudioInputStatus('Unable to start microphone input. Check device permission.');
    }
  };

  const returnToPlayerInput = () => {
    engine.stopExternalInput();
    setAudioInputMode('player');
    setAudioInputStatus('');
    if (!currentSong && (trackName === 'System Audio Input' || trackName === 'Microphone Input' || trackName.startsWith('Mic: '))) {
      setTrackName('No track selected');
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    let audioFile: File | null = null;
    let lrcFile: File | null = null;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.flac')) {
            audioFile = file;
        } else if (file.name.endsWith('.lrc')) {
            lrcFile = file;
        }
    }

    if (audioFile) {
        setAudioInputMode('player');
        setAudioInputStatus('');
        setLyricsText('');
        const metadata = await extractAudioMetadata(audioFile, audioFile.name);
        if (metadata.lyrics) {
             setLyricsText(metadata.lyrics);
        }
        setTrackName(metadata.displayName);
        setCurrentSong(null);
        setCurrentSongId(null);
        setCurrentCover(metadata.cover || '');
    } else {
        setLyricsText('');
        setCurrentCover('');
    }

    if (lrcFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setLyricsText(text);
        };
        reader.readAsText(lrcFile);
    }

    if (audioFile) {
        engine.init();
        engine.loadFile(audioFile);
        engine.play();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const loadDemo = async () => {
    const audioName = demoAudioUrl.split('/').pop() || 'demo.mp3';

    setTrackName('Loading demo...');
    setLyricsText('');
    setCurrentSong(null);
    setCurrentSongId(null);
    setCurrentCover('');

    try {
      const audioResponse = await fetch(demoAudioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Demo audio not found: ${demoAudioUrl}`);
      }

      const audioBlob = await audioResponse.blob();
      const metadata = await extractAudioMetadata(audioBlob, audioName);
      setAudioInputMode('player');
      setAudioInputStatus('');
      setTrackName(metadata.displayName);
      setCurrentCover(metadata.cover || '');

      let demoLyrics = metadata.lyrics || '';
      try {
        const lyricsResponse = await fetch(demoLyricsUrl, { cache: 'no-store' });
        if (lyricsResponse.ok) {
          demoLyrics = await lyricsResponse.text();
        }
      } catch (error) {
        console.warn('Demo lyrics file is not available:', error);
      }

      setLyricsText(demoLyrics);
      engine.init();
      engine.loadUrl(demoAudioUrl);
      engine.play();
    } catch (error) {
      console.warn('Unable to load demo track:', error);
      setTrackName('No track selected');
      setLyricsText('');
      setCurrentCover('');
    }
  };

  const togglePlay = () => {
    if (audioInputMode !== 'player') {
      returnToPlayerInput();
      return;
    }
    engine.init();
    engine.togglePlay();
  };

  const searchNetease = async () => {
    const keywords = searchQuery.trim();
    if (!keywords) return;
    const provider = effectiveSearchProvider;
    const requestCookie = provider === 'netease' && isNeteaseCookieValid ? neteaseCookie : '';
    const requestQQCookie = provider === 'qq' && isQQCookieValid ? qqCookie : '';

    setIsSearching(true);
    setSearchStatus(`正在搜索${provider === 'qq' ? 'QQ 音乐' : '网易云'}可播放歌曲...`);
    setSearchResults([]);

    try {
      const searchUrl = provider === 'qq'
        ? `/api/qq/search?keywords=${encodeURIComponent(keywords)}&limit=30`
        : (requestCookie
          ? `/api/netease/search?keywords=${encodeURIComponent(keywords)}&limit=30`
          : `/api/netease/search?keywords=${encodeURIComponent(keywords)}`);
      const response = await fetch(searchUrl, {
        headers: provider === 'qq' ? createQQCookieHeaders(requestQQCookie) : createNeteaseCookieHeaders(requestCookie),
      });
      if (!response.ok) throw new Error(`${provider} search request failed`);
      const data = await response.json();

      const songs = (Array.isArray(data.songs) ? data.songs : [])
        .map((song: NeteaseSong) => ({ ...song, provider }));
      const rawCount = Number(data.rawCount || songs.length || 0);
      setSearchResults(songs);
      setSearchStatus(songs.length ? '' : (rawCount > 0
        ? (provider === 'netease' && !requestCookie
          ? `搜到 ${rawCount} 首，但未登录只能显示可播放歌曲；保存网易云 Cookie 后可能会显示更多。`
          : `搜到 ${rawCount} 首，但当前账号没有可播放版本，可能受版权、会员或地区限制。`)
        : (provider === 'qq'
          ? 'QQ 音乐没有搜到歌曲，请换个关键词试试。'
          : (requestCookie
            ? `搜到 ${rawCount} 首，但当前账号没有可播放版本，可能受版权、会员或地区限制。`
            : '没有搜到歌曲；登录网易云或 QQ 音乐后可使用对应平台搜索。'))));
    } catch (error) {
      console.warn('Music search failed:', error);
      setSearchStatus('搜索失败，请稍后再试');
    } finally {
      setIsSearching(false);
    }
  };

  const loadNeteaseSong = async (song: NeteaseSong, queue?: NeteaseSong[]) => {
    setAudioInputMode('player');
    setAudioInputStatus('');
    if (queue) setPlayQueue(queue);
    setCurrentSongId(songIdentity(song));
    setCurrentSong(song);
    setCurrentCover(song.cover || '');
    setTrackName(`${song.artist ? `${song.artist} - ` : ''}${song.name}`);
    setLyricsText('');
    setSearchStatus('正在加载歌曲...');
    const provider = song.provider || 'netease';
    const requestCookie = provider === 'netease' && isNeteaseCookieValid ? neteaseCookie : '';
    const requestQQCookie = provider === 'qq' && isQQCookieValid ? qqCookie : '';
    
    // persist last played
    writeLastPlayedStorage({ type: 'cloud', song, trackName: `${song.artist ? `${song.artist} - ` : ''}${song.name}`, cover: song.cover || '', queue: queue || playQueue });

    try {
      if (provider === 'qq') {
        const mid = song.mid || song.songmid || String(song.id);
        const mediaMid = song.mediaMid || '';
        const qqSong = { mid, mediaMid };
        const [urlResponse, lyricResponse] = await Promise.all([
          fetch(buildQQPlaybackUrl('/api/qq/song/url', qqSong, playbackQualitySettings), {
            headers: createQQCookieHeaders(requestQQCookie),
          }),
          fetch(`/api/qq/lyric?mid=${encodeURIComponent(mid)}&id=${encodeURIComponent(String(song.qqId || ''))}`, {
            headers: createQQCookieHeaders(requestQQCookie),
          }),
        ]);
        const urlData = await urlResponse.json();
        const lyricData = await lyricResponse.json();
        setLyricsText(lyricData.lyric || lyricData.tlyric || lyricData.qrc || '');

        if (!urlData.url) {
          setSearchStatus(urlData.message || 'QQ 音乐暂时没有可播放地址，正在尝试下一首...');
          playFromQueue(1, songIdentity(song));
          return;
        }

        engine.init();
        engine.loadUrl(buildQQPlaybackUrl('/api/qq/audio', qqSong, playbackQualitySettings));
        engine.play();
        setSearchStatus('');
        setShowSearchPanel(false);
        return;
      }

      const [urlResponse, lyricResponse] = await Promise.all([
        fetch(buildNeteasePlaybackUrl('/api/netease/url', song.id, playbackQualitySettings), {
          headers: createNeteaseCookieHeaders(requestCookie),
        }),
        fetch(`/api/netease/lyric?id=${song.id}`, {
          headers: createNeteaseCookieHeaders(requestCookie),
        }),
      ]);

      const urlData = await urlResponse.json();
      const lyricData = await lyricResponse.json();
      const lyric = lyricData.lyric || lyricData.translatedLyric || '';
      setLyricsText(lyric);

      if (!urlData.url) {
        setSearchStatus('这首歌可能需要 Cookie、会员或地区权限，正在尝试下一首...');
        playFromQueue(1, songIdentity(song));
        return;
      }

      engine.init();
      engine.loadUrl(buildNeteasePlaybackUrl('/api/netease/audio', song.id, playbackQualitySettings));
      engine.play();
      setSearchStatus('');
      setShowSearchPanel(false);
    } catch (error) {
      console.warn('Unable to load song:', error);
      setSearchStatus('加载失败，正在尝试下一首...');
      playFromQueue(1, songIdentity(song));
    }
  };

  const getCurrentQueue = () => playQueue.length > 0 ? playQueue : activePlaylist?.songs || [];

  const playFromQueue = (direction: 1 | -1, fromSongId = currentSongId) => {
    const queue = getCurrentQueue();
    if (queue.length === 0) return;

    let nextIndex = 0;
    const currentIndex = queue.findIndex((song) => songIdentity(song) === fromSongId);

    if (playMode === 'shuffle' && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      nextIndex = (baseIndex + direction + queue.length) % queue.length;
    }

    loadNeteaseSong(queue[nextIndex], queue);
  };

  const restoreLastPlayedLyrics = async (
    song: NeteaseSong,
    provider: CloudProvider,
    requestCookie: string,
    requestQQCookie: string,
  ) => {
    try {
      const lyricResponse = provider === 'qq'
        ? await fetch(`/api/qq/lyric?mid=${encodeURIComponent(song.mid || song.songmid || String(song.id))}&id=${encodeURIComponent(String(song.qqId || ''))}`, {
            headers: createQQCookieHeaders(requestQQCookie),
          })
        : await fetch(`/api/netease/lyric?id=${song.id}`, {
            headers: createNeteaseCookieHeaders(requestCookie),
          });
      const lyricData = await lyricResponse.json();
      setLyricsText(lyricData.lyric || lyricData.translatedLyric || lyricData.tlyric || lyricData.qrc || '');
    } catch (error) {
      console.warn('Unable to restore last played lyrics:', error);
      setLyricsText('');
    }
  };

  useEffect(() => {
    const handleEnded = () => {
      const queue = getCurrentQueue();
      if (queue.length > 1) playFromQueue(1);
    };

    engine.audioElement.addEventListener('ended', handleEnded);
    return () => engine.audioElement.removeEventListener('ended', handleEnded);
  }, [playQueue, currentSongId, playMode, activePlaylistId, playlists]);

  // ── Restore last played cloud song on startup ──────────────────
  useEffect(() => {
    const last = readLastPlayedStorage();
    if (!last || last.type !== 'cloud' || !last.song) return;
    const song = last.song;
    // Restore UI state only (no autoplay — user clicks play to resume)
    setCurrentSong(song);
    if (last.queue && last.queue.length > 0) {
      setPlayQueue(last.queue);
    }
    setCurrentSongId(songIdentity(song));
    setTrackName(last.trackName);
    setCurrentCover(last.cover || song.cover || '');
    // Pre-load the audio URL silently so the player bar shows the track
    const provider = song.provider || 'netease';
    const requestCookie = provider === 'netease' && isNeteaseCookieValid ? neteaseCookie : '';
    const requestQQCookie = provider === 'qq' && isQQCookieValid ? qqCookie : '';
    restoreLastPlayedLyrics(song, provider, requestCookie, requestQQCookie);
    if (provider === 'qq') {
      const mid = song.mid || song.songmid || String(song.id);
      const mediaMid = song.mediaMid || '';
      engine.init();
      engine.loadUrl(buildQQPlaybackUrl('/api/qq/audio', { mid, mediaMid }, playbackQualitySettings));
    } else {
      engine.init();
      engine.loadUrl(buildNeteasePlaybackUrl('/api/netease/audio', song.id, playbackQualitySettings));
    }
    // Do NOT call engine.play() — leave paused for user to resume
  }, []); // run once on mount

  const addSongToPlaylist = (playlistId: string, song: NeteaseSong) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const exists = playlist.songs.some((savedSong) => songIdentity(savedSong) === songIdentity(song));
      if (exists) return playlist;
      return { ...playlist, songs: [...playlist.songs, song] };
    }));
    const playlistName = playlists.find((playlist) => playlist.id === playlistId)?.name || 'playlist';
    setSearchStatus(`已加入 ${playlistName}`);
    setSongToAdd(null);
  };

  const addSongToFavorites = (song: NeteaseSong) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== 'favorites') return playlist;
      const exists = playlist.songs.some((savedSong) => songIdentity(savedSong) === songIdentity(song));
      if (exists) return playlist;
      return { ...playlist, songs: [...playlist.songs, song] };
    }));
    setSearchStatus('已加入喜欢');
    setNeteaseCloudStatus('已加入喜欢');
  };

  const createPlaylistAndAddSong = () => {
    const name = newPlaylistName.trim();
    if (!name || !songToAdd) return;

    const id = `playlist-${Date.now()}`;
    setPlaylists((current) => [...current, { id, name, songs: [songToAdd] }]);
    setActivePlaylistId(id);
    setSearchStatus(`已加入 ${name}`);
    setSongToAdd(null);
    setNewPlaylistName('');
  };

  const deleteSongFromPlaylist = (playlistId: string, songId: number | string) => {
    setPlaylists((current) => current.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      return { ...playlist, songs: playlist.songs.filter((song) => songIdentity(song) !== String(songId)) };
    }));

    setPlayQueue((queue) => queue.filter((song) => songIdentity(song) !== String(songId)));
    if (currentSongId === songId) {
      setCurrentSongId(null);
    }
  };

  const deletePlaylist = (playlistId: string) => {
    if (playlists.length <= 1) return;

    const nextPlaylists = playlists.filter((playlist) => playlist.id !== playlistId);
    setPlaylists(nextPlaylists);

    if (activePlaylistId === playlistId) {
      setActivePlaylistId(nextPlaylists[0]?.id || 'favorites');
    }

    const deletedPlaylist = playlists.find((playlist) => playlist.id === playlistId);
    if (deletedPlaylist?.songs.some((song) => songIdentity(song) === currentSongId)) {
      setPlayQueue([]);
      setCurrentSongId(null);
    }
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'song') {
      deleteSongFromPlaylist(pendingDelete.playlistId, pendingDelete.songId);
    } else {
      deletePlaylist(pendingDelete.playlistId);
    }

    setPendingDelete(null);
  };

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || playlists[0];

  const latestRefs = useRef({ displaySettings, playFromQueue });
  useEffect(() => {
    latestRefs.current = { displaySettings, playFromQueue };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const matchShortcut = (shortcut: string, event: KeyboardEvent) => {
         if (!shortcut) return false;
         const parts = shortcut.split('+');
         const key = parts.pop() || '';
         const ctrlKey = parts.includes('Ctrl');
         const altKey = parts.includes('Alt');
         const shiftKey = parts.includes('Shift');
         
         if (key === 'Space') {
            return event.code === 'Space' && event.ctrlKey === ctrlKey && event.altKey === altKey && event.shiftKey === shiftKey;
         }
         
         const eventKeyCapitalized = event.key.length === 1 ? event.key.toUpperCase() : event.key;
         const keyCapitalized = key.length === 1 ? key.toUpperCase() : key;
         
         return (event.key === key || event.code === key || eventKeyCapitalized === keyCapitalized) && 
                event.ctrlKey === ctrlKey && event.altKey === altKey && event.shiftKey === shiftKey;
      };

      const settings = latestRefs.current.displaySettings.shortcuts;
      
      if (settings?.playPause && matchShortcut(settings.playPause, e)) {
        e.preventDefault();
        engine.init();
        engine.togglePlay();
        return;
      }
      if (settings?.prevSong && matchShortcut(settings.prevSong, e)) {
        e.preventDefault();
        latestRefs.current.playFromQueue(-1);
        return;
      }
      if (settings?.nextSong && matchShortcut(settings.nextSong, e)) {
        e.preventDefault();
        latestRefs.current.playFromQueue(1);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  const formatTime = (time: number) => {
     if(isNaN(time)) return "0:00";
     const min = Math.floor(time / 60);
     const sec = Math.floor(time % 60);
     return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Drag and drop global listeners
  useEffect(() => {
    const handleDragOverGlobal = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeaveGlobal = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX === 0 || e.clientY === 0) {
        setIsDragging(false);
      }
    };
    const handleDropGlobal = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer?.files || null);
    };

    window.addEventListener('dragover', handleDragOverGlobal);
    window.addEventListener('dragleave', handleDragLeaveGlobal);
    window.addEventListener('drop', handleDropGlobal);

    return () => {
      window.removeEventListener('dragover', handleDragOverGlobal);
      window.removeEventListener('dragleave', handleDragLeaveGlobal);
      window.removeEventListener('drop', handleDropGlobal);
    };
  }, []);

  const accentHex = `#${resolvedTheme.uRippleColor.getHexString()}`;
  const surfaceHex = `#${resolvedTheme.uBaseColor1.getHexString()}`;
  const isLightSurface = relativeLuminanceFromHex(surfaceHex) > 0.58;
  const readableAccent = readableAccentColor(accentHex, isLightSurface);
  const uiTextColor = isLightSurface ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 255, 255, 0.9)';
  const uiMutedColor = isLightSurface ? 'rgba(15, 23, 42, 0.56)' : 'rgba(255, 255, 255, 0.52)';
  const uiFaintColor = isLightSurface ? 'rgba(15, 23, 42, 0.38)' : 'rgba(255, 255, 255, 0.34)';
  const sideNavTextColor = 'rgba(255, 255, 255, 0.72)';
  const sideNavActiveColor = 'rgba(255, 255, 255, 0.94)';
  const brandColor = isMobileSideNavOpen ? sideNavActiveColor : (isLightSurface ? readableAccent : 'rgba(255, 255, 255, 0.96)');
  const brandShadow = isLightSurface
    ? '0 1px 0 rgba(255,255,255,0.72), 0 10px 26px rgba(15,23,42,0.16)'
    : `0 10px 28px ${colorWithAlpha(accentHex, 0.18)}`;

  const lastPointerUpTime = useRef<number>(0);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      lastPointerUpTime.current = Date.now();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp, true);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp, true);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as Element).tagName.toLowerCase() === 'canvas') {
        closeFloatingPanels();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} surfaceColor={surfaceHex} accentColor={accentHex} />}

      {isPerspectiveEditMode && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3">
          <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-white font-medium text-sm tracking-widest shadow-2xl animate-in fade-in slide-in-from-top-4 pointer-events-auto">
            正在编辑视角 (右键拖拽或双指滑动以平移视角)
          </div>
          <div className="flex gap-4 pointer-events-auto">
            <button
              onClick={() => onPerspectiveEditModeChange?.(false)}
              className="px-8 py-2.5 bg-white text-black font-bold text-sm tracking-widest rounded-full hover:bg-white/90 transition-colors cursor-pointer"
            >
              确定
            </button>
            <button
              onClick={() => onResetCamera?.()}
              className="px-8 py-2.5 bg-black/40 text-white font-bold text-sm tracking-widest rounded-full border border-white/20 hover:bg-black/60 transition-colors cursor-pointer"
            >
              重置
            </button>
          </div>
        </div>
      )}

      <div 

        className="absolute inset-0 pointer-events-none z-10 flex w-full h-full" 
      style={{
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: uiMutedColor,
        '--sonic-accent': accentHex,
        '--sonic-readable-accent': readableAccent,
        '--sonic-ui-text': uiTextColor,
        '--sonic-ui-muted': uiMutedColor,
        '--sonic-ui-faint': uiFaintColor,
        '--sonic-side-nav-text': sideNavTextColor,
        '--sonic-side-nav-active': sideNavActiveColor,
      } as React.CSSProperties}
    >
      <DesktopTitleDragRegion />
      <DesktopWindowControls />

      {isDragging && (
        <div 
          className="absolute inset-0 z-[60] backdrop-blur-sm border-2 border-dashed m-4 rounded-xl flex items-center justify-center font-mono text-2xl tracking-widest pointer-events-none"
          style={{ backgroundColor: `${accentHex}1a`, borderColor: accentHex, color: accentHex }}
        >
          DROP AUDIO FILE TO PLAY
        </div>
      )}

      {!hasSeenSideNavHint && !isMobileSideNavOpen && (
        <div className="absolute top-[88px] left-[56px] z-40 pointer-events-none select-none">
          <div className="text-[14px] sm:text-[15px] leading-7 tracking-[0.18em]" style={{ color: uiMutedColor }}>
            点击左上角 设置图标 打开侧边栏
          </div>
          <div className="text-[12px] sm:text-[13px] leading-6 tracking-[0.16em]" style={{ color: uiFaintColor }}>
            或将鼠标滑到左侧打开侧边栏
          </div>
        </div>
      )}
      
      {/* Sidebar Left */}
      <div
        className={`side-nav-trigger absolute left-0 top-0 h-full z-[60] transition-all pointer-events-auto ${isMobileSideNavOpen ? 'is-mobile-open' : ''}`}
        onMouseEnter={(e) => {
          // Do not open side nav if user is dragging (holding mouse button)
          if (e.buttons !== 0) return;
          // Do not open if user just released the mouse (e.g., just finished dragging the scene)
          if (Date.now() - lastPointerUpTime.current < 100) return;
          openMobileSideNav();
        }}
        onMouseLeave={() => setIsMobileSideNavOpen(false)}
      >
        <aside
          className={`side-nav-panel absolute left-0 top-0 h-full border-r flex flex-col pointer-events-auto ${isMobileSideNavOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300`}
          style={{
            ...themedPanelStyle(accentHex, isLightSurface ? 0.82 : 0.7),
            borderRightColor: colorWithAlpha(accentHex, isLightSurface ? 0.26 : 0.18),
            boxShadow: `16px 0 50px rgba(0,0,0,${isLightSurface ? 0.18 : 0.2}), inset -1px 0 0 ${colorWithAlpha(accentHex, isLightSurface ? 0.14 : 0.08)}`,
          }}
        >
          <button onClick={closeFloatingPanels} className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-100 transition-opacity cursor-pointer" style={{ writingMode: 'vertical-rl', color: sideNavActiveColor }}>可视化</button>
          <button onClick={openOptionsPanel} className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2" style={{ writingMode: 'vertical-rl' }}>
            设置
          </button>
          <button onClick={openSearchPanel} className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2" style={{ writingMode: 'vertical-rl' }}>
            搜索
          </button>
          {isNeteaseCookieValid && (
            <button
              onClick={() => openCloudPanelDefault('netease')}
              className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              style={{ writingMode: 'vertical-rl' }}
            >
              网易云
            </button>
          )}
          {isQQCookieValid && (
            <button
              onClick={() => openCloudPanelDefault('qq')}
              className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              style={{ writingMode: 'vertical-rl' }}
            >
              QQ音乐
            </button>
          )}
          <button onClick={openPlaylistPanel} className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2" style={{ writingMode: 'vertical-rl' }}>
            歌单
          </button>
          <button onClick={openAudioInputPanel} className="uppercase tracking-[0.2em] text-[10px] mb-12 opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center gap-2" style={{ writingMode: 'vertical-rl' }}>
            INPUT
          </button>

          <div className="side-nav-bottom mt-auto flex flex-col items-center gap-10">
            <button 
              onClick={() => { loadDemo(); setIsMobileSideNavOpen(false); }}
              className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-bold"
              style={{ writingMode: 'vertical-rl' }}
            >
              示例
            </button>
            <button 
              onClick={() => { fileInputRef.current?.click(); setIsMobileSideNavOpen(false); }}
              className="uppercase tracking-[0.2em] text-[10px] opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
              style={{ writingMode: 'vertical-rl' }}
            >
              上传
            </button>
            <button
              onClick={() => { onPerspectiveEditModeChange?.(true); setIsMobileSideNavOpen(false); }}
              className={`uppercase tracking-[0.2em] text-[10px] transition-opacity cursor-pointer ${isPerspectiveEditMode ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
              style={{ writingMode: 'vertical-rl' }}
            >
              视角
            </button>
            <button
              onClick={toggleFullscreen}
              className={`uppercase tracking-[0.2em] text-[10px] transition-opacity cursor-pointer ${isFullscreen ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
              style={{ writingMode: 'vertical-rl' }}
            >
              {isFullscreen ? '退出' : '全屏'}
            </button>
            <div className="font-black text-[14px] tracking-[-1px] opacity-40 mt-4 pointer-events-none select-none">
              AJIN.
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="audio/*,.lrc" 
            multiple
            className="hidden" 
            onChange={handleFileChange}
          />
        </aside>
      </div>

      {/* Sidebar Right */}
      <div
        className={`side-nav-trigger-right absolute right-0 top-0 h-full z-[60] transition-all pointer-events-auto ${isRightSidebarOpen ? 'is-mobile-open-right' : ''}`}
        onMouseEnter={(e) => {
          if (e.buttons !== 0) return;
          if (Date.now() - lastPointerUpTime.current < 100) return;
          setIsRightSidebarOpen(true);
        }}
        onMouseLeave={() => setIsRightSidebarOpen(false)}
      >
        {displaySettings.showRightIcon && (
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className={`absolute top-[88px] right-[56px] z-50 pointer-events-auto cursor-pointer transition-opacity hover:opacity-100 ${isRightSidebarOpen ? 'opacity-100' : 'opacity-40'}`}
            style={{ color: isRightSidebarOpen ? sideNavActiveColor : (isLightSurface ? readableAccent : 'rgba(255, 255, 255, 0.96)') }}
          >
            <Menu size={24} />
          </button>
        )}

        <aside
          className={`side-nav-panel-right absolute right-0 top-0 h-full flex pointer-events-auto transition-transform duration-300 z-[61] ${isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          ...themedPanelStyle(accentHex, isLightSurface ? 0.82 : 0.7),
          borderLeft: `1px solid ${colorWithAlpha(accentHex, isLightSurface ? 0.26 : 0.18)}`,
          boxShadow: `-16px 0 50px rgba(0,0,0,${isLightSurface ? 0.18 : 0.2})`,
        }}
      >
        <div className="flex h-full w-[540px]">
           {/* Playlists Column */}
           <div className="w-[200px] border-r flex flex-col h-full" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
             <div className="p-5 text-[10px] uppercase tracking-[0.2em] text-white/50 shrink-0">Playlists</div>
             <div className="flex-1 overflow-y-auto themed-scrollbar pb-5">
               {/* Local Playlists */}
               {playlists.length > 0 && (
                 <div className="mb-4">
                   <div className="px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: colorWithAlpha(surfaceHex, 0.8) }}>Local</div>
                   {playlists.map(playlist => (
                     <button 
                       key={playlist.id} 
                       onClick={() => {
                         setActivePlaylistId(playlist.id);
                         setActiveRightSidebarSelection({ type: 'local', id: playlist.id });
                       }}
                       className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left ${activeRightSidebarSelection.type === 'local' && activeRightSidebarSelection.id === playlist.id ? 'bg-white/5' : ''}`}
                     >
                       <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden">
                         {playlist.songs[0]?.cover ? (
                            <img src={playlist.songs[0].cover} className="w-full h-full object-cover" />
                         ) : (
                            <ListMusic size={14} className="text-white/40" />
                         )}
                       </div>
                       <div className="min-w-0 flex-1">
                         <div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'local' && activeRightSidebarSelection.id === playlist.id ? 'text-white' : 'text-white/70'}`}>{playlist.name}</div>
                         <div className="text-[10px] text-white/40 mt-0.5">{playlist.songs.length}</div>
                       </div>
                     </button>
                   ))}
                 </div>
               )}

               {/* NetEase Playlists */}
               {isNeteaseCookieValid && (
                 <div className="mb-4">
                   <div className="px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: colorWithAlpha(surfaceHex, 0.8) }}>NetEase Cloud</div>
                   <button 
                     onClick={() => {
                       setActiveRightSidebarSelection({ type: 'netease_daily' });
                       loadDailyRecommendations();
                     }}
                     className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left ${activeRightSidebarSelection.type === 'netease_daily' ? 'bg-white/5' : ''}`}
                   >
                     <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden text-white/40"><ListMusic size={14} /></div>
                     <div className="min-w-0 flex-1"><div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'netease_daily' ? 'text-white' : 'text-white/70'}`}>每日推荐</div></div>
                   </button>
                   <button 
                     onClick={() => {
                       setActiveRightSidebarSelection({ type: 'netease_liked' });
                       loadLikedSongs('netease');
                     }}
                     className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left ${activeRightSidebarSelection.type === 'netease_liked' ? 'bg-white/5' : ''}`}
                   >
                     <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden text-white/40"><ListMusic size={14} /></div>
                     <div className="min-w-0 flex-1"><div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'netease_liked' ? 'text-white' : 'text-white/70'}`}>我喜欢的音乐</div></div>
                   </button>
                    {(() => {
                      const sorted = [...fetchedNeteasePlaylists].sort((a, b) => {
                        const aPinned = pinnedNeteasePlaylists.includes(String(a.id));
                        const bPinned = pinnedNeteasePlaylists.includes(String(b.id));
                        if (aPinned && !bPinned) return -1;
                        if (!aPinned && bPinned) return 1;
                        return 0;
                      });
                      const displayCount = Math.max(5, pinnedNeteasePlaylists.length);
                      const visiblePlaylists = showAllNetease ? sorted : sorted.slice(0, displayCount);
                      const hasMore = sorted.length > displayCount;

                      return (
                        <>
                          {visiblePlaylists.map(playlist => {
                            const isPinned = pinnedNeteasePlaylists.includes(String(playlist.id));
                            return (
                              <button 
                                key={playlist.id} 
                                onClick={() => {
                                  setActiveRightSidebarSelection({ type: 'netease_playlist', id: playlist.id });
                                  loadNeteasePlaylistSongs(playlist);
                                }}
                                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left group ${activeRightSidebarSelection.type === 'netease_playlist' && activeRightSidebarSelection.id === playlist.id ? 'bg-white/5' : ''}`}
                              >
                                <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden">
                                  {playlist.cover ? <img src={playlist.cover} className="w-full h-full object-cover" /> : <ListMusic size={14} className="text-white/40" />}
                                </div>
                                <div className="min-w-0 flex-1"><div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'netease_playlist' && activeRightSidebarSelection.id === playlist.id ? 'text-white' : 'text-white/70'}`}>{playlist.name}</div></div>
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPinned) {
                                      setPinnedNeteasePlaylists(prev => prev.filter(id => id !== String(playlist.id)));
                                    } else {
                                      setPinnedNeteasePlaylists(prev => [...prev, String(playlist.id)]);
                                    }
                                  }}
                                  className={`shrink-0 p-1 rounded hover:bg-white/10 transition-colors ${isPinned ? 'opacity-100 text-cyan-400' : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-white'}`}
                                  title={isPinned ? "取消置顶" : "置顶"}
                                >
                                  <Pin size={14} className={isPinned ? "fill-cyan-400/20" : ""} />
                                </div>
                              </button>
                            );
                          })}
                          {hasMore && (
                            <button
                              onClick={() => setShowAllNetease(!showAllNetease)}
                              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.1em] text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              {showAllNetease ? (
                                <><ChevronUp size={14} /> 收起</>
                              ) : (
                                <><ChevronDown size={14} /> 展开全部歌单 ({sorted.length})</>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                 </div>
               )}

               {/* QQ Playlists */}
               {isQQCookieValid && (
                 <div className="mb-4">
                   <div className="px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50 sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: colorWithAlpha(surfaceHex, 0.8) }}>QQ Music</div>
                   <button 
                     onClick={() => {
                       setActiveRightSidebarSelection({ type: 'qq_liked' });
                       loadLikedSongs('qq');
                     }}
                     className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left ${activeRightSidebarSelection.type === 'qq_liked' ? 'bg-white/5' : ''}`}
                   >
                     <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden text-white/40"><ListMusic size={14} /></div>
                     <div className="min-w-0 flex-1"><div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'qq_liked' ? 'text-white' : 'text-white/70'}`}>我喜欢的音乐</div></div>
                   </button>
                    {(() => {
                      const sorted = [...fetchedQQPlaylists].sort((a, b) => {
                        const aPinned = pinnedQQPlaylists.includes(String(a.id));
                        const bPinned = pinnedQQPlaylists.includes(String(b.id));
                        if (aPinned && !bPinned) return -1;
                        if (!aPinned && bPinned) return 1;
                        return 0;
                      });
                      const displayCount = Math.max(5, pinnedQQPlaylists.length);
                      const visiblePlaylists = showAllQQ ? sorted : sorted.slice(0, displayCount);
                      const hasMore = sorted.length > displayCount;

                      return (
                        <>
                          {visiblePlaylists.map(playlist => {
                            const isPinned = pinnedQQPlaylists.includes(String(playlist.id));
                            return (
                              <button 
                                key={playlist.id} 
                                onClick={() => {
                                  setActiveRightSidebarSelection({ type: 'qq_playlist', id: playlist.id });
                                  loadNeteasePlaylistSongs(playlist);
                                }}
                                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left group ${activeRightSidebarSelection.type === 'qq_playlist' && activeRightSidebarSelection.id === playlist.id ? 'bg-white/5' : ''}`}
                              >
                                <div className="w-8 h-8 rounded shrink-0 bg-white/10 flex items-center justify-center overflow-hidden">
                                  {playlist.cover ? <img src={playlist.cover} className="w-full h-full object-cover" /> : <ListMusic size={14} className="text-white/40" />}
                                </div>
                                <div className="min-w-0 flex-1"><div className={`text-[12px] truncate ${activeRightSidebarSelection.type === 'qq_playlist' && activeRightSidebarSelection.id === playlist.id ? 'text-white' : 'text-white/70'}`}>{playlist.name}</div></div>
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPinned) {
                                      setPinnedQQPlaylists(prev => prev.filter(id => id !== String(playlist.id)));
                                    } else {
                                      setPinnedQQPlaylists(prev => [...prev, String(playlist.id)]);
                                    }
                                  }}
                                  className={`shrink-0 p-1 rounded hover:bg-white/10 transition-colors ${isPinned ? 'opacity-100 text-cyan-400' : 'opacity-0 group-hover:opacity-100 text-white/40 hover:text-white'}`}
                                  title={isPinned ? "取消置顶" : "置顶"}
                                >
                                  <Pin size={14} className={isPinned ? "fill-cyan-400/20" : ""} />
                                </div>
                              </button>
                            );
                          })}
                          {hasMore && (
                            <button
                              onClick={() => setShowAllQQ(!showAllQQ)}
                              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.1em] text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              {showAllQQ ? (
                                <><ChevronUp size={14} /> 收起</>
                              ) : (
                                <><ChevronDown size={14} /> 展开全部歌单 ({sorted.length})</>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                 </div>
               )}
             </div>
           </div>
           
           {/* Tracks Column */}
           <div className="flex-1 flex flex-col h-full">
             <div className="flex items-center justify-between p-5 shrink-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Tracks</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                  {activeRightSidebarSelection.type === 'local' ? (activePlaylist?.songs.length || 0) : (neteaseCloudSongs.length || 0)} Tracks
                </div>
             </div>
             <div className="flex-1 overflow-y-auto themed-scrollbar pb-5">
               {(() => {
                 const currentTracks = activeRightSidebarSelection.type === 'local' ? (activePlaylist?.songs || []) : neteaseCloudSongs;
                 if (currentTracks.length === 0) return <div className="px-5 py-8 text-[12px] text-white/40">No songs in this playlist</div>;
                 return currentTracks.map((song, index) => (
                   <button
                     key={songIdentity(song)}
                     onClick={() => loadNeteaseSong(song, currentTracks)}
                     className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left group ${currentSongId === songIdentity(song) ? 'bg-white/5' : ''}`}
                   >
                     <div className="w-4 text-center text-[10px] text-white/30 group-hover:hidden shrink-0">
                       {(index + 1).toString().padStart(2, '0')}
                     </div>
                     <div className="w-4 text-center hidden group-hover:flex items-center justify-center text-white shrink-0">
                       <Play size={10} />
                     </div>
                     <div className="w-8 h-8 rounded shrink-0 bg-white/10 overflow-hidden flex items-center justify-center">
                        {song.cover ? (
                           <img src={song.cover} className="w-full h-full object-cover" />
                        ) : (
                           <ListMusic size={14} className="text-white/40" />
                        )}
                     </div>
                     <div className="min-w-0 flex-1">
                       <div className={`text-[12px] truncate ${currentSongId === songIdentity(song) ? 'text-white' : 'text-white/80'}`}>{song.name}</div>
                       <div className="text-[10px] text-white/40 mt-0.5 truncate">{song.artist || 'Unknown'}</div>
                     </div>
                     <div className="text-[10px] text-white/30 shrink-0">
                       {formatTime(song.duration ? song.duration / 1000 : 0)}
                     </div>
                   </button>
                 ));
               })()}
             </div>
           </div>
        </div>
      </aside>
      </div>

      {/* Brand Mark */}
      {displaySettings.showLeftIcon && (
        <button
          type="button"
          className={`brand-mark absolute top-[88px] left-[56px] z-50 pointer-events-auto cursor-pointer transition-opacity hover:opacity-100 ${isMobileSideNavOpen ? 'opacity-100' : 'opacity-40'}`}
          aria-label={isMobileSideNavOpen ? '关闭侧边栏' : '打开侧边栏'}
          aria-expanded={isMobileSideNavOpen}
          onClick={() => {
            if (isMobileSideNavOpen) {
              setIsMobileSideNavOpen(false);
            } else {
              openMobileSideNav();
            }
          }}
          style={{ color: isMobileSideNavOpen ? sideNavActiveColor : (isLightSurface ? readableAccent : 'rgba(255, 255, 255, 0.96)') }}
        >
          <Settings size={24} />
        </button>
      )}

      {/* Player Panel */}
      {showSearchPanel && (
        <div className="absolute top-[40px] left-[100px] w-[360px] max-h-[70vh] z-50 pointer-events-auto backdrop-blur-[20px] border rounded-sm overflow-hidden" style={themedPanelStyle(accentHex, 0.82)}>
          <div className="p-5 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">Music Search</div>
              <button onClick={() => setShowSearchPanel(false)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">Close</button>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-white/38">
                当前搜索：{effectiveSearchLabel}
              </div>
              {hasBothCloudLogins && (
                <div className="grid grid-cols-2 rounded-sm border bg-white/[0.025] p-0.5" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
                  {[
                    { id: 'netease' as const, label: '网易云' },
                    { id: 'qq' as const, label: 'QQ音乐' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSearchProvider(item.id)}
                      className={`px-3 py-1.5 text-[10px] tracking-[0.12em] transition-colors ${effectiveSearchProvider === item.id ? 'border border-transparent' : 'text-white/45 hover:text-white'}`}
                      style={effectiveSearchProvider === item.id ? activeControlStyle(accentHex) : undefined}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                searchNetease();
              }}
            >
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Song or artist"
                className="min-w-0 flex-1 bg-white/[0.035] border rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
                style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
              />
              <button
                type="submit"
                disabled={isSearching}
                className="px-3 py-2 text-[10px] uppercase tracking-[0.15em] rounded-sm border disabled:opacity-50"
                style={primaryGhostStyle(accentHex)}
              >
                <Search size={14} />
              </button>
            </form>
            {searchStatus && <div className="mt-3 text-[11px] text-white/45">{searchStatus}</div>}
          </div>
          <div className="themed-scrollbar max-h-[48vh] overflow-y-auto">
            {searchResults.map((song) => (
              <button
                key={songIdentity(song)}
                onClick={() => loadNeteaseSong(song, searchResults)}
                className="relative flex w-full items-center gap-3 px-5 py-4 pr-16 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <CoverArt src={song.cover} title={song.name} className="h-10 w-10" iconSize={15} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] truncate ${currentSongId === songIdentity(song) ? 'text-white' : 'text-white/80'}`}>{song.name}</div>
                  <div className="mt-1 text-[11px] text-white/45 truncate">
                    {(song.provider === 'qq' ? 'QQ 音乐' : '网易云')} · {song.artist || 'Unknown artist'} - {song.album || 'Unknown album'}
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSongToAdd(song);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSongToAdd(song);
                    }
                  }}
                  className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-sm border text-white/55 hover:text-white transition-colors flex items-center justify-center"
                  style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
                  title="Add to playlist"
                >
                  <Plus size={15} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {songToAdd && (
        <div className="absolute top-[120px] left-[480px] w-[280px] z-[70] pointer-events-auto backdrop-blur-[20px] border rounded-sm overflow-hidden" style={themedPanelStyle(accentHex, 0.88)}>
          <div className="p-5 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">Add To Playlist</div>
                <div className="text-[13px] text-white truncate" title={songToAdd.name}>{songToAdd.name}</div>
              </div>
              <button onClick={() => setSongToAdd(null)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">Close</button>
            </div>
          </div>
          <div className="p-3 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => addSongToPlaylist(playlist.id, songToAdd)}
                className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 rounded-sm transition-colors"
              >
                <span className="min-w-0 text-[12px] text-white truncate">{playlist.name}</span>
                <span className="text-[10px] text-white/35">{playlist.songs.length}</span>
              </button>
            ))}
          </div>
          <form
            className="p-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createPlaylistAndAddSong();
            }}
          >
            <input
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="New playlist"
              className="min-w-0 flex-1 bg-white/[0.035] border rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
              style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
            />
            <button
              type="submit"
              className="h-9 w-9 flex-shrink-0 rounded-sm border flex items-center justify-center disabled:opacity-50"
              style={primaryGhostStyle(accentHex)}
              disabled={!newPlaylistName.trim()}
              title="Create playlist"
            >
              <Plus size={15} />
            </button>
          </form>
        </div>
      )}

      {showPlaylistPanel && (
        <div className="absolute top-[40px] left-[100px] w-[420px] max-h-[74vh] z-[65] pointer-events-auto backdrop-blur-[20px] border rounded-sm overflow-hidden" style={themedPanelStyle(accentHex, 0.84)}>
          <div className="p-5 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-white/70">
                <ListMusic size={15} />
                Playlists
              </div>
              <button onClick={() => setShowPlaylistPanel(false)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">Close</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="themed-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => setActivePlaylistId(playlist.id)}
                  className={`flex-shrink-0 px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${activePlaylist?.id === playlist.id ? '' : 'text-white/45 border-white/10 hover:text-white'}`}
                  style={activePlaylist?.id === playlist.id ? activeControlStyle(accentHex) : undefined}
                >
                  {playlist.name}
                </button>
              ))}
              </div>
              <button
                onClick={() => activePlaylist && setPendingDelete({ type: 'playlist', playlistId: activePlaylist.id, label: activePlaylist.name })}
                disabled={!activePlaylist || playlists.length <= 1}
                className="h-8 w-8 flex-shrink-0 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] disabled:opacity-20 disabled:hover:text-white/45 flex items-center justify-center"
                title="Delete playlist"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="themed-scrollbar max-h-[52vh] overflow-y-auto">
            {activePlaylist && activePlaylist.songs.length > 0 ? activePlaylist.songs.map((song) => (
              <button
                key={songIdentity(song)}
                onClick={() => loadNeteaseSong(song, activePlaylist.songs)}
                className="relative flex w-full items-center gap-3 px-5 py-4 pr-16 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <CoverArt src={song.cover} title={song.name} className="h-10 w-10" iconSize={15} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white truncate">{song.name}</div>
                  <div className="mt-1 text-[11px] text-white/45 truncate">{song.artist || 'Unknown artist'} - {song.album || 'Unknown album'}</div>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: songIdentity(song), label: song.name });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: songIdentity(song), label: song.name });
                    }
                  }}
                  className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] transition-colors flex items-center justify-center"
                  title="Remove from playlist"
                >
                  <Trash2 size={14} />
                </span>
              </button>
            )) : (
              <div className="px-5 py-8 text-[12px] text-white/40">No songs in this playlist yet</div>
            )}
          </div>
        </div>
      )}

      {showAudioInputPanel && (
        <div className="absolute top-[40px] left-[100px] w-[420px] z-[67] pointer-events-auto backdrop-blur-[20px] border rounded-sm overflow-hidden" style={themedPanelStyle(accentHex, 0.86)}>
          <div className="p-5 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-white/70">
                <Volume2 size={15} />
                Audio Input
              </div>
              <button onClick={() => setShowAudioInputPanel(false)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">Close</button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startSystemAudioInput}
                className={`min-h-[74px] rounded-sm border px-3 py-3 text-left transition-colors ${audioInputMode === 'system' ? '' : 'border-white/10 text-white/55 hover:text-white hover:bg-white/5'}`}
                style={audioInputMode === 'system' ? activeControlStyle(accentHex) : undefined}
              >
                <Volume2 size={16} className="mb-2" />
                <div className="text-[11px] uppercase tracking-[0.14em]">System Audio</div>
                <div className="mt-1 text-[10px] opacity-55">Windows loopback</div>
              </button>
              <button
                onClick={() => startMicrophoneInput()}
                className={`min-h-[74px] rounded-sm border px-3 py-3 text-left transition-colors ${audioInputMode === 'microphone' ? '' : 'border-white/10 text-white/55 hover:text-white hover:bg-white/5'}`}
                style={audioInputMode === 'microphone' ? activeControlStyle(accentHex) : undefined}
              >
                <Mic size={16} className="mb-2" />
                <div className="text-[11px] uppercase tracking-[0.14em]">Microphone</div>
                <div className="mt-1 text-[10px] opacity-55">Input devices</div>
              </button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/45">Microphone Device</label>
                <button onClick={refreshAudioInputDevices} className="text-[10px] uppercase tracking-[0.14em] text-white/40 hover:text-white">Refresh</button>
              </div>
              <select
                value={selectedAudioInputId}
                onChange={(event) => setSelectedAudioInputId(event.target.value)}
                className="w-full rounded-sm border bg-black/30 px-3 py-2 text-[12px] text-white outline-none"
                style={{ borderColor: colorWithAlpha(accentHex, 0.2) }}
              >
                {audioInputDevices.length > 0 ? audioInputDevices.map((device) => (
                  <option key={device.id} value={device.id}>{device.label}</option>
                )) : (
                  <option value="">Allow microphone permission to show devices</option>
                )}
              </select>
            </div>

            {audioInputMode !== 'player' && (
              <button
                onClick={returnToPlayerInput}
                className="w-full rounded-sm border px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/55 hover:text-white hover:bg-white/5"
                style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
              >
                Stop Input
              </button>
            )}

            {audioInputStatus && (
              <div className="rounded-sm border px-3 py-2 text-[11px] leading-relaxed text-white/55" style={{ borderColor: colorWithAlpha(accentHex, 0.14) }}>
                {audioInputStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {showNeteasePanel && (
        <div className="absolute top-[40px] left-[100px] w-[460px] max-h-[76vh] z-[66] pointer-events-auto backdrop-blur-[20px] border rounded-sm overflow-hidden" style={themedPanelStyle(accentHex, 0.86)}>
          <div className="p-5 border-b" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">{activeCloudLabel}</div>
              <button onClick={() => setShowNeteasePanel(false)} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadLikedSongs()}
                className={`px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${neteaseCloudTab === 'liked' ? '' : 'text-white/45 border-white/10 hover:text-white'}`}
                style={neteaseCloudTab === 'liked' ? activeControlStyle(accentHex) : undefined}
              >
                喜欢
              </button>
              <button
                onClick={() => loadNeteasePlaylists()}
                className={`px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${neteaseCloudTab === 'playlists' ? '' : 'text-white/45 border-white/10 hover:text-white'}`}
                style={neteaseCloudTab === 'playlists' ? activeControlStyle(accentHex) : undefined}
              >
                歌单
              </button>
              {cloudProvider === 'netease' && (
                <button
                  onClick={() => loadDailyRecommendations()}
                  className={`px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${neteaseCloudTab === 'daily' ? '' : 'text-white/45 border-white/10 hover:text-white'}`}
                  style={neteaseCloudTab === 'daily' ? activeControlStyle(accentHex) : undefined}
                >
                  每日推荐
                </button>
              )}
            </div>
          </div>

          {neteaseCloudTab === 'playlists' && (
            <div className="themed-scrollbar p-3 border-b max-h-[140px] overflow-y-auto" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
              {neteaseCloudPlaylists.length > 0 ? neteaseCloudPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => loadNeteasePlaylistSongs(playlist)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 rounded-sm transition-colors ${activeNeteasePlaylistId === playlist.id ? 'bg-white/5' : ''}`}
                >
                  <span className="min-w-0 text-[12px] text-white truncate">{playlist.name}</span>
                  <span className="text-[10px] text-white/35">{playlist.trackCount}</span>
                </button>
              )) : (
                <div className="px-3 py-4 text-[12px] text-white/40">{isLoadingNeteaseCloud ? '正在加载歌单...' : `点击“歌单”加载你的${activeCloudLabel}歌单`}</div>
              )}
            </div>
          )}

          {neteaseCloudStatus && <div className="px-5 py-3 border-b border-white/5 text-[11px] text-white/45">{neteaseCloudStatus}</div>}
          <NeteaseSongList
            songs={neteaseCloudSongs}
            currentSongId={currentSongId}
            queue={neteaseCloudSongs}
            onPlay={loadNeteaseSong}
            onFavorite={addSongToFavorites}
            emptyText={isLoadingNeteaseCloud ? '正在加载...' : '这里会显示可播放歌曲'}
            accentHex={accentHex}
          />
        </div>
      )}

      {pendingDelete && (
        <div className="absolute inset-0 z-[120] pointer-events-auto flex items-center justify-center backdrop-blur-sm" style={{ background: colorWithAlpha(accentHex, 0.12) }}>
          <div className="w-[320px] border rounded-sm p-5" style={themedPanelStyle(accentHex, 0.9)}>
            <div className="text-[12px] uppercase tracking-[0.2em] text-white/70 mb-3">
              Confirm Delete
            </div>
            <div className="text-[13px] text-white/80 leading-relaxed mb-5">
              Delete {pendingDelete.type === 'playlist' ? 'playlist' : 'song'} <span className="text-white">{pendingDelete.label}</span>?
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/45 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingDelete}
                className="px-3 py-2 rounded-sm border border-[#ef4444]/40 text-[10px] uppercase tracking-[0.15em] text-[#ef4444] hover:bg-[#ef4444]/15"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Panel Area with Hover Trigger */}
      <div 
        className="absolute bottom-0 left-0 w-full h-[120px] z-40 pointer-events-auto"
          onMouseEnter={(e) => {
            if (e.buttons !== 0) return;
            if (Date.now() - lastPointerUpTime.current < 100) return;
            setIsBottomPanelOpen(true);
          }}
          onMouseLeave={() => setIsBottomPanelOpen(false)}
        >
          {/* Minimal Progress Bar (visible only when player is hidden) */}
          <div 
            className={`fixed bottom-[4px] left-1/2 -translate-x-1/2 w-[900px] max-w-[90vw] h-[2px] bg-white/10 rounded-full overflow-hidden transition-all duration-500 pointer-events-none z-[9999] ${
              !(displaySettings.showBottomPlayer || isBottomPanelOpen) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
            }`}
          >
            <div 
              className="h-full transition-all duration-300"
              style={{ 
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                backgroundColor: accentHex,
                boxShadow: `0 0 10px ${accentHex}`
              }}
            />
          </div>

          <div
            className={`player-panel absolute left-1/2 -translate-x-1/2 flex w-[900px] max-w-[90vw] items-center gap-6 rounded-2xl border border-white/10 px-6 py-3 pointer-events-auto backdrop-blur-[22px] transition-all duration-300 ${
              displaySettings.showBottomPlayer || isBottomPanelOpen
                ? 'bottom-[20px] opacity-100 translate-y-0'
                : '-bottom-[20px] opacity-0 translate-y-full'
            }`}
          style={{
            background: 'rgba(10, 14, 18, 0.4)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 18px 50px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex shrink-0 items-center justify-center">
            <CoverArt src={currentCover} title={trackName} className="h-[48px] w-[48px] shadow-[0_4px_10px_rgba(0,0,0,0.28)]" iconSize={20} />
          </div>
          
          <div className="flex min-w-0 shrink-0 w-[200px] flex-col justify-center">
            <MarqueeTitle title={trackName} />
            <div className="mt-1 text-[10px] leading-4 text-white/45 uppercase tracking-[0.14em]">
              {songSourceLabel(currentSong)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-3">
             <span className="text-[10px] text-white/55 tabular-nums uppercase tracking-[0.1em] shrink-0 w-[34px] text-right">{formatTime(currentTime)}</span>
             <div className="relative flex-1 flex h-[12px] items-center group">
               <div className="w-full relative h-[2px] bg-white/10 group-hover:h-[4px] transition-all rounded-full overflow-hidden">
                  <div 
                     className="absolute top-0 left-0 h-full"
                     style={{ backgroundColor: accentHex, width: `${duration ? (currentTime / duration) * 100 : 0}%`, boxShadow: `0 0 10px ${accentHex}88` }}
                   />
               </div>
               <input 
                 type="range"
                 min={0}
                 max={duration || 100}
                 step="0.01"
                 value={currentTime}
                 onChange={(e) => {
                   if (engine.audioElement) {
                     const newTime = parseFloat(e.target.value);
                     engine.audioElement.currentTime = newTime;
                     setCurrentTime(newTime);
                   }
                 }}
                 className="absolute bottom-0 left-0 w-full opacity-0 cursor-pointer h-full"
               />
            </div>
            <span className="text-[10px] text-white/55 tabular-nums uppercase tracking-[0.1em] shrink-0 w-[34px] text-left">{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center justify-center gap-4 text-white/60">
             <button
                onClick={() => playFromQueue(-1)}
                className="hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-inherit"
                disabled={getCurrentQueue().length === 0}
                title="Previous track"
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={togglePlay}
                className="hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-inherit"
                disabled={trackName === 'No track selected'}
              >
                {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
              </button>
              <button
                onClick={() => playFromQueue(1)}
                className="hover:text-white transition-colors disabled:opacity-25 disabled:hover:text-inherit"
                disabled={getCurrentQueue().length === 0}
                title="Next track"
              >
                <SkipForward size={16} />
              </button>
              <button
                onClick={() => setPlayMode((mode) => mode === 'sequence' ? 'shuffle' : 'sequence')}
                className="hover:text-white transition-colors"
                title={playMode === 'sequence' ? 'Sequence play' : 'Shuffle play'}
                style={{ color: playMode === 'shuffle' ? accentHex : undefined }}
              >
                {playMode === 'sequence' ? <Repeat size={14} /> : <Shuffle size={14} />}
              </button>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-4 text-white/40 ml-2">
            <button
              onClick={() => setDisplaySettings(s => ({ ...s, showLyrics: !s.showLyrics }))}
              className="text-[13px] font-bold hover:text-white transition-colors w-4 flex items-center justify-center"
              title={displaySettings.showLyrics ? '隐藏歌词' : '显示歌词'}
              style={{ color: displaySettings.showLyrics ? accentHex : undefined }}
            >
              词
            </button>
            <button 
              onClick={() => {
                const keys = Object.keys(themes);
                const themeKeys = [...keys, CUSTOM_THEME_ID];
                const currentIndex = themeKeys.indexOf(theme);
                const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % themeKeys.length : 0;
                onThemeChange(themeKeys[nextIndex]);
              }}
              className="hover:text-white transition-colors"
              title="切换主题"
            >
              <Palette size={16} />
            </button>
            <div className="flex min-w-0 items-center justify-end gap-1.5 group">
              <Volume2 
                size={16} 
                className="opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0" 
                onClick={() => {
                  const val = volume > 0 ? 0 : 1;
                  engine.setVolume(val);
                  setVolume(val);
                  window.localStorage.setItem('sonic-volume', val.toString());
                }} 
              />
              <input 
                type="range"
                min={0} max={1} step={0.01}
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  engine.setVolume(val);
                  setVolume(val);
                  window.localStorage.setItem('sonic-volume', val.toString());
                }}
                className="w-12 h-1 accent-current opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer aspect-auto bg-white/20 appearance-none rounded-full"
                style={{ accentColor: accentHex }}
              />
            </div>
          </div>
          </div>
        </div>
      {/* Clock Display */}
      <div style={{ pointerEvents: 'auto' }}>
        <ClockDisplay settings={displaySettings.clock} accentHex={accentHex} />
      </div>

      {trackName !== 'No track selected' && lyricsText && (
        <LyricsDisplay
          lrcText={lyricsText}
          currentTime={currentTime}
          isPlaying={isPlaying && displaySettings.showLyrics}
          accentHex={accentHex}
          lyricsSettings={{ ...currentStyleConfig, style: lyricsSettings.style }}
        />
      )}



      {showUpdatePrompt && availableUpdate && (
        <UpdatePromptModal
          accentHex={accentHex}
          update={availableUpdate}
          updateStatus={updateStatus}
          downloadJob={downloadJob}
          onDownload={startUpdateDownload}
          onRemindLater={remindUpdateLater}
          onSkipVersion={skipThisUpdateVersion}
        />
      )}

      {/* Options Panel */}
      {showOptionsPanel && (
        <OptionsPanel
          onClose={() => setShowOptionsPanel(false)}
          accentHex={accentHex}
          neteaseCookie={neteaseCookie}
          setNeteaseCookie={setNeteaseCookie}
          onSaveCookie={saveNeteaseCookie}
          onClearCookie={clearNeteaseCookie}
          cookieStatus={cookieStatus}
          isNeteaseCookieValid={isNeteaseCookieValid}
          isSyncingNeteaseCookie={isSyncingNeteaseCookie}
          qqCookie={qqCookie}
          setQQCookie={setQQCookie}
          onSaveQQCookie={saveQQCookie}
          onClearQQCookie={clearQQCookie}
          qqCookieStatus={qqCookieStatus}
          isQQCookieValid={isQQCookieValid}
          isSyncingQQCookie={isSyncingQQCookie}
          desktopLoginStatus={desktopLoginStatus}
          onDesktopNeteaseLogin={startDesktopNeteaseLogin}
          onDesktopQQLogin={startDesktopQQLogin}
          updateStatus={updateStatus}
          isCheckingUpdate={isCheckingUpdate}
          onCheckUpdate={() => checkForUpdate({ manual: true })}
          theme={theme}
          customThemes={customThemes}
          activeCustomThemeId={activeCustomThemeId}
          themeRotation={themeRotation}
          groundEqSettings={groundEqSettings}
          presetTransferStatus={presetTransferStatus}
          setPresetTransferStatus={setPresetTransferStatus}
          onImportPresetPackage={applyPresetTransferPackage}
          onThemeChange={onThemeChange}
          onCustomThemesChange={onCustomThemesChange}
          onThemeRotationChange={onThemeRotationChange}
          onGroundEqSettingsChange={onGroundEqSettingsChange}
          playbackQualitySettings={playbackQualitySettings}
          onPlaybackQualitySettingsChange={setPlaybackQualitySettings}
          lyricsSettings={lyricsSettings}
          onLyricsSettingsChange={onLyricsSettingsChange}
          displaySettings={displaySettings}
          onDisplaySettingsChange={setDisplaySettings}
          globalSceneSettings={globalSceneSettings}
          onGlobalSceneSettingsChange={onGlobalSceneSettingsChange}
        />
      )}
    </div>
    </>
  );
}

import { TriggerPreset } from '../../lib/AudioEngine';

function DesktopTitleDragRegion() {
  const isDraggingWindow = useRef(false);
  const dragFrame = useRef<number | null>(null);

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement> | PointerEvent) => ({
    screenX: event.screenX,
    screenY: event.screenY,
  });

  const endDrag = () => {
    if (!isDraggingWindow.current) return;
    isDraggingWindow.current = false;
    if (dragFrame.current != null) {
      window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
    window.sonicDesktop?.endWindowDrag();
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('blur', endDrag);
  };

  const handleWindowPointerMove = (event: PointerEvent) => {
    if (!isDraggingWindow.current) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (dragFrame.current != null) window.cancelAnimationFrame(dragFrame.current);
    dragFrame.current = window.requestAnimationFrame(() => {
      window.sonicDesktop?.moveWindowDrag(point);
      dragFrame.current = null;
    });
  };

  const handleWindowPointerUp = () => {
    endDrag();
  };

  const startDrag = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    isDraggingWindow.current = true;
    window.sonicDesktop?.startWindowDrag(pointFromEvent(event));
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('blur', endDrag);
  };

  if (!window.sonicDesktop?.isDesktop) return null;

  return (
    <div
      className="desktop-no-drag pointer-events-auto absolute inset-x-0 top-0 z-[20] h-12 cursor-default"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.001)' }}
      onPointerDown={startDrag}
      aria-hidden="true"
    />
  );
}

function DesktopWindowControls() {
  if (!window.sonicDesktop?.isDesktop) return null;

  return (
    <div className="desktop-no-drag group/window-controls pointer-events-auto absolute right-0 top-0 z-[300] flex h-16 w-44 items-start justify-end pr-5 pt-4">
      <div className="flex translate-y-[-2px] items-center gap-2 opacity-0 transition-all duration-200 ease-out group-hover/window-controls:translate-y-0 group-hover/window-controls:opacity-100">
        <button
          type="button"
          onClick={() => window.sonicDesktop?.minimize()}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/35 text-white/55 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md hover:text-white"
          title="最小化"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => window.sonicDesktop?.toggleMaximize()}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/35 text-white/55 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md hover:text-white"
          title="最大化"
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          onClick={() => window.sonicDesktop?.close()}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/35 text-white/55 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md hover:border-[#ef4444]/50 hover:text-[#ef4444]"
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function NeteaseSongList({
  songs,
  currentSongId,
  queue,
  onPlay,
  onFavorite,
  emptyText,
  accentHex,
}: {
  songs: NeteaseSong[];
  currentSongId: number | string | null;
  queue: NeteaseSong[];
  onPlay: (song: NeteaseSong, queue?: NeteaseSong[]) => void;
  onFavorite: (song: NeteaseSong) => void;
  emptyText: string;
  accentHex: string;
}) {
  return (
    <div className="themed-scrollbar max-h-[44vh] overflow-y-auto">
      {songs.length > 0 ? songs.map((song) => (
        <button
          key={songIdentity(song)}
          onClick={() => onPlay(song, queue)}
          className="relative flex w-full items-center gap-3 px-5 py-4 pr-16 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
        >
          <CoverArt src={song.cover} title={song.name} className="h-10 w-10" iconSize={15} />
          <div className="min-w-0 flex-1">
            <div className={`text-[13px] truncate ${currentSongId === songIdentity(song) ? 'text-white' : 'text-white/80'}`}>{song.name}</div>
            <div className="mt-1 text-[11px] text-white/45 truncate">{song.artist || '未知歌手'} - {song.album || '未知专辑'}</div>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(song);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onFavorite(song);
              }
            }}
            className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-sm border text-white/55 hover:text-white transition-colors flex items-center justify-center"
            style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
            title="加入喜欢"
          >
            <Plus size={15} />
          </span>
        </button>
      )) : (
        <div className="px-5 py-8 text-[12px] text-white/40">{emptyText}</div>
      )}
    </div>
  );
}

function OptionsPanel({
  onClose,
  accentHex,
  neteaseCookie,
  setNeteaseCookie,
  onSaveCookie,
  onClearCookie,
  cookieStatus,
  isNeteaseCookieValid,
  isSyncingNeteaseCookie,
  qqCookie,
  setQQCookie,
  onSaveQQCookie,
  onClearQQCookie,
  qqCookieStatus,
  isQQCookieValid,
  isSyncingQQCookie,
  desktopLoginStatus,
  onDesktopNeteaseLogin,
  onDesktopQQLogin,
  updateStatus,
  isCheckingUpdate,
  onCheckUpdate,
  theme,
  customThemes,
  activeCustomThemeId,
  themeRotation,
  groundEqSettings,
  presetTransferStatus,
  setPresetTransferStatus,
  onImportPresetPackage,
  onThemeChange,
  onCustomThemesChange,
  onThemeRotationChange,
  onGroundEqSettingsChange,
  playbackQualitySettings,
  onPlaybackQualitySettingsChange,
  lyricsSettings,
  onLyricsSettingsChange,
  displaySettings,
  onDisplaySettingsChange,
  globalSceneSettings,
  onGlobalSceneSettingsChange,
}: {
  onClose: () => void;
  accentHex: string;
  neteaseCookie: string;
  setNeteaseCookie: (cookie: string) => void;
  onSaveCookie: () => void | Promise<void>;
  onClearCookie: () => void | Promise<void>;
  cookieStatus: string;
  isNeteaseCookieValid: boolean;
  isSyncingNeteaseCookie: boolean;
  qqCookie: string;
  setQQCookie: (cookie: string) => void;
  onSaveQQCookie: () => void | Promise<void>;
  onClearQQCookie: () => void | Promise<void>;
  qqCookieStatus: string;
  isQQCookieValid: boolean;
  isSyncingQQCookie: boolean;
  desktopLoginStatus: string;
  onDesktopNeteaseLogin: () => void | Promise<void>;
  onDesktopQQLogin: () => void | Promise<void>;
  updateStatus: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void | Promise<void>;
  theme: string;
  customThemes: CustomThemeSettings[];
  activeCustomThemeId: string;
  themeRotation: ThemeRotationSettings;
  groundEqSettings: StoredGroundEqSettings;
  presetTransferStatus: string;
  setPresetTransferStatus: (status: string) => void;
  onImportPresetPackage: (presetPackage: PresetTransferPackage) => Promise<void>;
  onThemeChange: (theme: string) => void;
  onCustomThemesChange: (settings: CustomThemeSettings[], activeId?: string) => void;
  onThemeRotationChange: (settings: ThemeRotationSettings) => void;
  onGroundEqSettingsChange: (settings: StoredGroundEqSettings) => void;
  playbackQualitySettings: PlaybackQualitySettings;
  onPlaybackQualitySettingsChange: (settings: PlaybackQualitySettings | ((prev: PlaybackQualitySettings) => PlaybackQualitySettings)) => void;
  lyricsSettings: LyricsSettings;
  onLyricsSettingsChange: (settings: LyricsSettings) => void;
  displaySettings: DisplaySettings;
  onDisplaySettingsChange: (settings: DisplaySettings | ((prev: DisplaySettings) => DisplaySettings)) => void;
  globalSceneSettings: { rotationSpeed: number };
  onGlobalSceneSettingsChange: (patch: { rotationSpeed?: number }) => void;
}) {
  const [activeTab, setActiveTab] = useState<OptionsTab>('Meteor');
  const [includeCookieInExport, setIncludeCookieInExport] = useState(false);
  const importPresetInputRef = useRef<HTMLInputElement>(null);
  const tabs: OptionsTab[] = ['Pulse', 'Meteor', 'FloatingBlocks', 'GroundEq', 'Color', 'Audio', 'Account', 'Lyrics', 'Display'];
  const tabLabels: Partial<Record<OptionsTab, string>> = {
    Pulse: '脉冲特效',
    Meteor: '流星特效',
    GroundEq: '地面 EQ',
    Color: '自定义主题',
    Account: '账号登录',
    Lyrics: '歌词',
    Display: '显示/快捷键',
  };

  const currentStyleConfig = lyricsSettings[lyricsSettings.style] || (lyricsSettings as any)['songyancai'] || {
    activeFontSize: 32, inactiveFontSize: 18, fontColor: '#ffffff', glowColor: '#00ffff',
    followThemeGlow: true, karaokeColor: '#00ffff', followThemeKaraoke: true,
    position: 'center', triggerBand: 'subBass', fontFamily: 'serif', maxCharsPerLine: DEFAULT_MAX_CHARS_PER_LINE, spatialOrbitOffset: DEFAULT_SPATIAL_ORBIT_OFFSET
  };
  const updateConfig = (updates: any) => onLyricsSettingsChange({ ...lyricsSettings, [lyricsSettings.style]: { ...currentStyleConfig, ...updates } });

  const exportPreset = () => {
    try {
      const presetPackage = createPresetTransferPackage({ includeCookies: includeCookieInExport });
      const blob = new Blob([JSON.stringify(presetPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `sonic-topography-presets-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPresetTransferStatus(includeCookieInExport ? '预设已导出，包含 Cookie' : '预设已导出，未包含 Cookie');
    } catch (error) {
      console.warn('Unable to export presets:', error);
      setPresetTransferStatus('导出失败，请稍后重试');
    }
  };

  const importPresetFile = async (file: File | undefined) => {
    if (!file) return;

    try {
      setPresetTransferStatus('正在导入预设...');
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onImportPresetPackage(normalizePresetTransferPackage(parsed));
    } catch (error) {
      console.warn('Unable to import presets:', error);
      setPresetTransferStatus(error instanceof Error ? error.message : '导入失败，请选择正确的预设文件');
    } finally {
      if (importPresetInputRef.current) importPresetInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute top-[40px] left-[100px] z-[100] pointer-events-auto">
       <div
         className="themed-scrollbar w-[min(840px,calc(100vw-140px))] max-h-[86vh] overflow-y-auto border rounded-sm p-8 transform transition-all shadow-2xl"
         style={themedPanelStyle(accentHex, 0.88)}
       >
          <div className="flex justify-between items-center mb-6">
             <div>
               <div className="text-xl font-light tracking-widest text-white">设置</div>
               <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/35">视觉触发器、颜色、账号与更新</div>
             </div>
             <button onClick={onClose} className="text-white/50 hover:text-white uppercase tracking-widest text-[10px]">关闭</button>
          </div>

          <div className="mb-6 rounded-sm border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[12px] uppercase tracking-[0.18em] text-white/70">预设迁移</div>
                <div className="mt-2 text-[11px] leading-relaxed text-white/45">一键导出或导入歌单、特效、地面 EQ、自定义主题和浏览器设置。</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/50">
                  <input
                    type="checkbox"
                    checked={includeCookieInExport}
                    onChange={(event) => setIncludeCookieInExport(event.target.checked)}
                    className="h-3.5 w-3.5"
                    style={{ accentColor: accentHex }}
                  />
                  包含 Cookie
                </label>
                <button
                  type="button"
                  onClick={exportPreset}
                  className="px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.15em]"
                  style={primaryGhostStyle(accentHex)}
                >
                  导出预设
                </button>
                <button
                  type="button"
                  onClick={() => importPresetInputRef.current?.click()}
                  className="px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/55 hover:text-white transition-colors"
                >
                  导入预设
                </button>
                <input
                  ref={importPresetInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => importPresetFile(event.target.files?.[0])}
                />
              </div>
            </div>
            {presetTransferStatus && <div className="mt-3 text-[11px] text-white/45">{presetTransferStatus}</div>}
          </div>

          <div className="flex gap-2 mb-6">
            {tabs.map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors ${
                     activeTab === tab ? '' : 'border-white/10 text-white/45 hover:text-white hover:bg-white/5'
                  }`}
                  style={activeTab === tab ? activeControlStyle(accentHex) : undefined}
               >
                  {tab === 'Audio' ? '播放音质' : (tabLabels[tab] || '浮空方块')}
               </button>
            ))}
          </div>

          {activeTab === 'FloatingBlocks' ? (
            <FloatingBlocksPanel
              accentHex={accentHex}
              groundEqSettings={groundEqSettings}
              onGroundEqSettingsChange={onGroundEqSettingsChange}
            />
          ) : activeTab === 'GroundEq' ? (
            <GroundEqPanel
              accentHex={accentHex}
              groundEqSettings={groundEqSettings}
              onGroundEqSettingsChange={onGroundEqSettingsChange}
            />
          ) : activeTab === 'Color' ? (
            <CustomColorPanel
              accentHex={accentHex}
              theme={theme}
              customThemes={customThemes}
              activeCustomThemeId={activeCustomThemeId}
              themeRotation={themeRotation}
              onThemeChange={onThemeChange}
              onCustomThemesChange={onCustomThemesChange}
              onThemeRotationChange={onThemeRotationChange}
            />
          ) : activeTab === 'Audio' ? (
            <PlaybackQualityPanel
              accentHex={accentHex}
              settings={playbackQualitySettings}
              onSettingsChange={onPlaybackQualitySettingsChange}
            />
          ) : activeTab === 'Account' ? (
            <AccountLoginPanel
              accentHex={accentHex}
              neteaseCookie={neteaseCookie}
              setNeteaseCookie={setNeteaseCookie}
              onSaveCookie={onSaveCookie}
              onClearCookie={onClearCookie}
              cookieStatus={cookieStatus}
              isNeteaseCookieValid={isNeteaseCookieValid}
              isSyncingNeteaseCookie={isSyncingNeteaseCookie}
              qqCookie={qqCookie}
              setQQCookie={setQQCookie}
              onSaveQQCookie={onSaveQQCookie}
              onClearQQCookie={onClearQQCookie}
              qqCookieStatus={qqCookieStatus}
              isQQCookieValid={isQQCookieValid}
              isSyncingQQCookie={isSyncingQQCookie}
              desktopLoginStatus={desktopLoginStatus}
              onDesktopNeteaseLogin={onDesktopNeteaseLogin}
              onDesktopQQLogin={onDesktopQQLogin}
              updateStatus={updateStatus}
              isCheckingUpdate={isCheckingUpdate}
              onCheckUpdate={onCheckUpdate}
            />
          ) : activeTab === 'Lyrics' ? (
            <div className="flex flex-col gap-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-sm p-4 flex flex-col gap-5">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">歌词形态</div>
                  <div className="flex gap-2">
                     <button
                        className="px-4 py-2 text-[11px] uppercase tracking-widest rounded-sm border transition-colors"
                        style={lyricsSettings.style === 'songyancai' ? activeControlStyle(accentHex) : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                        onClick={() => onLyricsSettingsChange({ ...lyricsSettings, style: 'songyancai' })}
                     >
                        宋延彩 (默认)
                     </button>
                     <button
                        className="px-4 py-2 text-[11px] uppercase tracking-widest rounded-sm border transition-colors"
                        style={lyricsSettings.style === 'dynamic-bounce' ? activeControlStyle(accentHex) : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                        onClick={() => onLyricsSettingsChange({ ...lyricsSettings, style: 'dynamic-bounce' })}
                     >
                        动感跳跃
                     </button>
                     <button
                        className="px-4 py-2 text-[11px] uppercase tracking-widest rounded-sm border transition-colors"
                        style={lyricsSettings.style === 'spatial-wall' ? activeControlStyle(accentHex) : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                        onClick={() => onLyricsSettingsChange({ ...lyricsSettings, style: 'spatial-wall' })}
                     >
                        3D 环绕
                     </button>
                  </div>
                </div>

                {(lyricsSettings.style === 'dynamic-bounce' || lyricsSettings.style === 'spatial-wall') && (
                   <>
                      <div className="h-[1px] bg-white/5 w-full"></div>
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                           <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">屏幕固定位置</div>
                           <select
                             className="w-full bg-black/40 border border-white/10 rounded-sm text-[12px] px-3 py-2 outline-none focus:border-white/30 text-white/80"
                             value={currentStyleConfig.position}
                             onChange={(e) => updateConfig({ position: e.target.value as any })}
                           >
                             <option value="top-left">左上 (Top Left)</option>
                             <option value="top-center">中上 (Top Center)</option>
                             <option value="top-right">右上 (Top Right)</option>
                             <option value="center-left">左中 (Center Left)</option>
                             <option value="center">正中间 (Center)</option>
                             <option value="center-right">右中 (Center Right)</option>
                             <option value="bottom-left">左下 (Bottom Left)</option>
                             <option value="bottom-center">中下 (Bottom Center)</option>
                             <option value="bottom-right">右下 (Bottom Right)</option>
                           </select>
                        </div>
                        <div>
                           <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">跳动跟随频段 (EQ)</div>
                           <select
                             className="w-full bg-black/40 border border-white/10 rounded-sm text-[12px] px-3 py-2 outline-none focus:border-white/30 text-white/80"
                             value={currentStyleConfig.triggerBand}
                             onChange={(e) => updateConfig({ triggerBand: e.target.value as any })}
                           >
                             <option value="subBass">中心抬升 (SUB BASS)</option>
                             <option value="bass">低频重量 (BASS)</option>
                             <option value="lowMid">慢波流动 (LOW MID)</option>
                             <option value="mid">方向流 (MID)</option>
                             <option value="highMid">尖峰 (HIGH MID)</option>
                             <option value="presence">闪光触发 (PRESENCE)</option>
                             <option value="brilliance">边缘微闪 (BRILLIANCE)</option>
                             <option value="air">空气颗粒 (AIR)</option>
                           </select>
                        </div>
                      </div>
                      {lyricsSettings.style === 'spatial-wall' && (
                        <div>
                          <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3 flex justify-between">
                             <span>左右环绕位置</span>
                             <span className="text-white/40">{currentStyleConfig.spatialOrbitOffset}°</span>
                          </div>
                          <input
                            type="range"
                            min={SPATIAL_ORBIT_OFFSET_MIN}
                            max={SPATIAL_ORBIT_OFFSET_MAX}
                            value={currentStyleConfig.spatialOrbitOffset}
                            onChange={(e) => updateConfig({ spatialOrbitOffset: Number(e.target.value) })}
                            className="w-full accent-current h-1 bg-white/20 appearance-none rounded-full"
                            style={{ accentColor: accentHex }}
                          />
                        </div>
                      )}
                   </>
                )}

                <div className="h-[1px] bg-white/5 w-full"></div>

                <div>
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3 flex justify-between">
                     <span>活跃歌词大小</span>
                     <span className="text-white/40">{currentStyleConfig.activeFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={64}
                    value={currentStyleConfig.activeFontSize}
                    onChange={(e) => updateConfig({ activeFontSize: Number(e.target.value) })}
                    className="w-full accent-current h-1 bg-white/20 appearance-none rounded-full"
                    style={{ accentColor: accentHex }}
                  />
                </div>

                <div>
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3 flex justify-between">
                     <span>每行歌词容量</span>
                     <span className="text-white/40">{currentStyleConfig.maxCharsPerLine} 字</span>
                  </div>
                  <input
                    type="range"
                    min={MAX_CHARS_PER_LINE_MIN}
                    max={MAX_CHARS_PER_LINE_MAX}
                    value={currentStyleConfig.maxCharsPerLine}
                    onChange={(e) => updateConfig({ maxCharsPerLine: Number(e.target.value) })}
                    className="w-full accent-current h-1 bg-white/20 appearance-none rounded-full"
                    style={{ accentColor: accentHex }}
                  />
                </div>

                <div className="h-[1px] bg-white/5 w-full"></div>

                <div className="grid grid-cols-3 gap-8">
                   <div>
                      <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">字体颜色</div>
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-full border-[2px] overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                          <input 
                             type="color" 
                             value={currentStyleConfig.fontColor} 
                             onChange={(e) => updateConfig({ fontColor: e.target.value })}
                             className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-white/50 uppercase font-mono">{currentStyleConfig.fontColor}</span>
                      </div>
                   </div>
                   
                   <div>
                      <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">变色 (K歌)</div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full border-[2px] overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.2)', opacity: currentStyleConfig.followThemeKaraoke ? 0.3 : 1 }}>
                            <input 
                               type="color" 
                               value={currentStyleConfig.karaokeColor} 
                               onChange={(e) => updateConfig({ karaokeColor: e.target.value })}
                               disabled={currentStyleConfig.followThemeKaraoke}
                               className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                           <input 
                              type="checkbox"
                              checked={currentStyleConfig.followThemeKaraoke}
                              onChange={(e) => updateConfig({ followThemeKaraoke: e.target.checked })}
                              className="w-3 h-3"
                              style={{ accentColor: accentHex }}
                           />
                           跟随主题
                        </label>
                      </div>
                   </div>

                   <div>
                      <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">炫光颜色</div>
                      <div className="flex items-center gap-4">
                        <div className="relative w-8 h-8 rounded-full border-[2px] overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.2)', opacity: currentStyleConfig.followThemeGlow ? 0.3 : 1 }}>
                          <input 
                             type="color" 
                             value={currentStyleConfig.glowColor} 
                             onChange={(e) => updateConfig({ glowColor: e.target.value })}
                             disabled={currentStyleConfig.followThemeGlow}
                             className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                           <input 
                              type="checkbox"
                              checked={currentStyleConfig.followThemeGlow}
                              onChange={(e) => updateConfig({ followThemeGlow: e.target.checked })}
                              className="w-3 h-3"
                              style={{ accentColor: accentHex }}
                           />
                           跟随主题
                        </label>
                      </div>
                   </div>
                   
                   <div className="col-span-3">
                       <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3 flex items-center justify-between">
                         <span>字体类型</span>
                         <span className="text-[10px] text-white/40">{currentStyleConfig.fontFamily === 'serif' ? '宋体类 (Serif)' : '黑体类 (Sans)'}</span>
                       </div>
                       <div className="flex gap-2">
                          <button
                            className={`flex-1 py-2 text-[12px] rounded-sm border transition-colors font-serif tracking-widest ${currentStyleConfig.fontFamily === 'serif' ? '' : 'border-white/10 text-white/50 hover:text-white'}`}
                            style={currentStyleConfig.fontFamily === 'serif' ? { borderColor: accentHex, color: accentHex, boxShadow: `0 0 10px ${accentHex}33` } : {}}
                            onClick={() => updateConfig({ fontFamily: 'serif' })}
                          >
                            尖锐锐利
                          </button>
                          <button
                            className={`flex-1 py-2 text-[12px] rounded-sm border transition-colors font-sans tracking-widest ${currentStyleConfig.fontFamily === 'sans-serif' ? '' : 'border-white/10 text-white/50 hover:text-white'}`}
                            style={currentStyleConfig.fontFamily === 'sans-serif' ? { borderColor: accentHex, color: accentHex, boxShadow: `0 0 10px ${accentHex}33` } : {}}
                            onClick={() => updateConfig({ fontFamily: 'sans-serif' })}
                          >
                            平滑现代
                          </button>
                       </div>
                    </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'Display' ? (
            <div className="flex flex-col gap-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-sm p-4 flex flex-col gap-5">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">界面可见性 (Visibility)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.showLeftIcon} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, showLeftIcon: e.target.checked }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      显示左侧设置图标
                    </label>
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.showRightIcon} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, showRightIcon: e.target.checked }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      显示右侧菜单图标
                    </label>
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.showBottomPlayer} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, showBottomPlayer: e.target.checked }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      显示底部播放器
                    </label>
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.showLyrics} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, showLyrics: e.target.checked }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      显示歌词
                    </label>
                    <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.showCover} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, showCover: e.target.checked }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      显示封面
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-sm p-4 flex flex-col gap-5">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-3">场景与控制 (Scene & Controls)</div>
                  
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] text-white/75">场景旋转速度</div>
                          <div className="mt-1 text-[9px] text-white/35">全局控制地面自动旋转速度，调到 0 就停止</div>
                        </div>
                        <div className="text-[11px]" style={{ color: accentHex }}>{globalSceneSettings.rotationSpeed.toFixed(2)}</div>
                      </div>
                      <ThrottledRangeInput
                        min="0"
                        max="2"
                        step="0.05"
                        value={globalSceneSettings.rotationSpeed}
                        onChange={(val: number) => onGlobalSceneSettingsChange({ rotationSpeed: val })}
                        className="mt-3 w-full accent-current h-1"
                        style={{ accentColor: accentHex }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-sm p-4 flex flex-col gap-4">
                <div className="text-[12px] uppercase tracking-[0.15em] text-white/70 mb-1">快捷键 (Shortcuts)</div>
                <div className="text-[10px] text-white/40 mb-2">点击输入框后按下组合键以修改</div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-white/50">播放 / 暂停</div>
                    <input 
                      type="text" 
                      value={displaySettings.shortcuts?.playPause || 'Space'} 
                      readOnly 
                      placeholder="按下快捷键"
                      className="bg-black/20 border border-white/10 rounded-sm px-3 py-1 text-[11px] text-white/80 w-40 text-center outline-none focus:border-white/30 transition-colors cursor-pointer"
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        let keys = [];
                        if (e.ctrlKey) keys.push('Ctrl');
                        if (e.altKey) keys.push('Alt');
                        if (e.shiftKey) keys.push('Shift');
                        if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
                          const keyName = e.code === 'Space' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
                          keys.push(keyName);
                          onDisplaySettingsChange(s => ({ ...s, shortcuts: { ...s.shortcuts, playPause: keys.join('+') } }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-white/50">上一首</div>
                    <input 
                      type="text" 
                      value={displaySettings.shortcuts?.prevSong || 'Ctrl+ArrowLeft'} 
                      readOnly 
                      placeholder="按下快捷键"
                      className="bg-black/20 border border-white/10 rounded-sm px-3 py-1 text-[11px] text-white/80 w-40 text-center outline-none focus:border-white/30 transition-colors cursor-pointer"
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        let keys = [];
                        if (e.ctrlKey) keys.push('Ctrl');
                        if (e.altKey) keys.push('Alt');
                        if (e.shiftKey) keys.push('Shift');
                        if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
                          const keyName = e.code === 'Space' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
                          keys.push(keyName);
                          onDisplaySettingsChange(s => ({ ...s, shortcuts: { ...s.shortcuts, prevSong: keys.join('+') } }));
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-white/50">下一首</div>
                    <input 
                      type="text" 
                      value={displaySettings.shortcuts?.nextSong || 'Ctrl+ArrowRight'} 
                      readOnly 
                      placeholder="按下快捷键"
                      className="bg-black/20 border border-white/10 rounded-sm px-3 py-1 text-[11px] text-white/80 w-40 text-center outline-none focus:border-white/30 transition-colors cursor-pointer"
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        let keys = [];
                        if (e.ctrlKey) keys.push('Ctrl');
                        if (e.altKey) keys.push('Alt');
                        if (e.shiftKey) keys.push('Shift');
                        if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
                          const keyName = e.code === 'Space' ? 'Space' : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
                          keys.push(keyName);
                          onDisplaySettingsChange(s => ({ ...s, shortcuts: { ...s.shortcuts, nextSong: keys.join('+') } }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-sm p-4 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] uppercase tracking-[0.15em] text-white/70">主屏时钟 (Clock)</div>
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={displaySettings.clock.visible} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, visible: e.target.checked } }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                    开启时钟
                  </label>
                </div>
                
                <div className="opacity-100 transition-opacity" style={{ opacity: displaySettings.clock.visible ? 1 : 0.4, pointerEvents: displaySettings.clock.visible ? 'auto' : 'none' }}>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2">位置 (Position)</div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].map(pos => (
                      <button
                        key={pos}
                        className={`py-1 text-[9px] uppercase tracking-widest rounded-sm border transition-colors ${displaySettings.clock.position === pos ? '' : 'border-white/10 text-white/40 hover:text-white'}`}
                        style={displaySettings.clock.position === pos ? { borderColor: accentHex, color: accentHex, boxShadow: `0 0 10px ${accentHex}33` } : {}}
                        onClick={() => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, position: pos as any } }))}
                      >
                        {pos.replace('-', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2 mt-4 flex justify-between">
                    <span>字体大小 (Size)</span>
                    <span>{displaySettings.clock.size}px</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" min="20" max="200" value={displaySettings.clock.size} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, size: Number(e.target.value) } }))} className="flex-1 accent-white" style={{ accentColor: accentHex }} />
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2 mt-4">颜色 (Color)</div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-8 h-8 rounded-full border-[2px] overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.2)', opacity: displaySettings.clock.followThemeColor ? 0.3 : 1 }}>
                      <input type="color" value={displaySettings.clock.color} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, color: e.target.value } }))} disabled={displaySettings.clock.followThemeColor} className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer" />
                    </div>
                    <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={displaySettings.clock.followThemeColor} onChange={(e) => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, followThemeColor: e.target.checked } }))} className="w-3 h-3" style={{ accentColor: accentHex }} />
                      跟随主题
                    </label>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/50 mb-2 mt-4">透明度 (Opacity)</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={10} max={100} step={1}
                      value={Math.round((displaySettings.clock.opacity ?? 1) * 100)}
                      onChange={(e) => onDisplaySettingsChange(s => ({ ...s, clock: { ...s.clock, opacity: Number(e.target.value) / 100 } }))}
                      className="flex-1 accent-white"
                      style={{ accentColor: accentHex }}
                    />
                    <span className="text-[10px] text-white/50 w-8 text-right tabular-nums">{Math.round((displaySettings.clock.opacity ?? 1) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (activeTab === 'Pulse' || activeTab === 'Meteor') ? (
            <FreqTriggerPanel key={activeTab} action={activeTab} accentHex={accentHex} />
          ) : null}
       </div>
    </div>
  );
}

function FloatingBlocksPanel({
  accentHex,
  groundEqSettings,
  onGroundEqSettingsChange,
}: {
  accentHex: string;
  groundEqSettings: StoredGroundEqSettings;
  onGroundEqSettingsChange: (settings: StoredGroundEqSettings) => void;
}) {
  const enabled = groundEqSettings.floatingBlocksEnabled ?? DEFAULT_FLOATING_BLOCKS_ENABLED;
  const intensity = groundEqSettings.floatingBlockIntensity ?? DEFAULT_FLOATING_BLOCK_INTENSITY;
  const minSize = groundEqSettings.floatingBlockMinSize ?? DEFAULT_FLOATING_BLOCK_MIN_SIZE;
  const maxSize = groundEqSettings.floatingBlockMaxSize ?? DEFAULT_FLOATING_BLOCK_MAX_SIZE;
  const speed = groundEqSettings.floatingBlockSpeed ?? DEFAULT_FLOATING_BLOCK_SPEED;
  const count = groundEqSettings.floatingBlockCount ?? DEFAULT_FLOATING_BLOCK_COUNT;

  const commit = (updates: Partial<StoredGroundEqSettings>) => {
    onGroundEqSettingsChange({ ...groundEqSettings, ...updates });
  };

  const clampSetting = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const commitMinSize = (value: number) => commit({ floatingBlockMinSize: Math.min(clampSetting(value), maxSize) });
  const commitMaxSize = (value: number) => commit({ floatingBlockMaxSize: Math.max(clampSetting(value), minSize) });

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4 border border-white/10 bg-white/[0.03] rounded-sm p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-white/70 mb-2">浮空方块特效</div>
          <div className="text-[11px] leading-relaxed text-white/45">空气中的小方块会跟随底鼓和低频能量放大缩小，适合做更明显的空间跳动层。</div>
        </div>
        <label className="flex shrink-0 items-center gap-2 cursor-pointer rounded-sm border border-white/10 px-3 py-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => commit({ floatingBlocksEnabled: event.target.checked })}
            className="h-4 w-4 rounded-sm border-white/20 bg-black/50"
            style={{ accentColor: accentHex }}
          />
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/55">启用</span>
        </label>
      </div>

      <div className="rounded-sm border bg-white/[0.025] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
        {[
          {
            label: '变化幅度',
            hint: '整体放大缩小的冲击感',
            value: intensity,
            minLabel: '克制',
            maxLabel: '强烈',
            onChange: (value: number) => commit({ floatingBlockIntensity: clampSetting(value) }),
          },
          {
            label: '最小大小',
            hint: '没有底鼓时的基础尺寸',
            value: minSize,
            minLabel: '细小',
            maxLabel: '明显',
            onChange: commitMinSize,
          },
          {
            label: '最大大小',
            hint: '底鼓触发时允许到达的最大尺寸',
            value: maxSize,
            minLabel: '收敛',
            maxLabel: '巨大',
            onChange: commitMaxSize,
          },
          {
            label: '变化速度',
            hint: '从小到大、再回落的响应速度',
            value: speed,
            minLabel: '缓慢',
            maxLabel: '迅速',
            onChange: (value: number) => commit({ floatingBlockSpeed: clampSetting(value) }),
          },
          {
            label: '方块数量',
            hint: '场景中漂浮方块的总数',
            value: count,
            minLabel: '稀少',
            maxLabel: '密集',
            onChange: (value: number) => commit({ floatingBlockCount: clampSetting(value) }),
          },
        ].map((control) => (
          <div key={control.label} className="mt-6 first:mt-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] uppercase tracking-[0.16em] text-white/70">{control.label}</div>
                <div className="mt-1 text-[10px] leading-relaxed text-white/38">{control.hint}</div>
              </div>
              <div className="text-[13px] font-medium tabular-nums" style={{ color: accentHex }}>{control.value}</div>
            </div>
            <div className="mt-4 grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">{control.minLabel}</span>
              <input
                aria-label={control.label}
                type="range"
                min={0}
                max={100}
                step={1}
                value={control.value}
                onChange={(event) => control.onChange(Number(event.target.value))}
                className="h-1 w-full cursor-pointer accent-current disabled:opacity-40"
                style={{ accentColor: accentHex }}
                disabled={!enabled}
              />
              <span className="text-right text-[10px] uppercase tracking-[0.12em] text-white/35">{control.maxLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroundEqPanel({
  accentHex,
  groundEqSettings,
  onGroundEqSettingsChange,
}: {
  accentHex: string;
  groundEqSettings: StoredGroundEqSettings;
  onGroundEqSettingsChange: (settings: StoredGroundEqSettings) => void;
}) {
  const [bands, setBands] = useState(groundEqSettings.bands);
  const [motionSpeed, setMotionSpeed] = useState(groundEqSettings.motionSpeed ?? DEFAULT_GROUND_MOTION_SPEED);
  const [amplitude, setAmplitude] = useState(groundEqSettings.amplitude ?? 50);
  const [terrainDensity, setTerrainDensity] = useState(groundEqSettings.terrainDensity ?? DEFAULT_TERRAIN_DENSITY);
  const [floatingBlocksEnabled, setFloatingBlocksEnabled] = useState(groundEqSettings.floatingBlocksEnabled ?? DEFAULT_FLOATING_BLOCKS_ENABLED);
  const [floatingBlockIntensity, setFloatingBlockIntensity] = useState(groundEqSettings.floatingBlockIntensity ?? DEFAULT_FLOATING_BLOCK_INTENSITY);
  const [floatingBlockMinSize, setFloatingBlockMinSize] = useState(groundEqSettings.floatingBlockMinSize ?? DEFAULT_FLOATING_BLOCK_MIN_SIZE);
  const [floatingBlockMaxSize, setFloatingBlockMaxSize] = useState(groundEqSettings.floatingBlockMaxSize ?? DEFAULT_FLOATING_BLOCK_MAX_SIZE);
  const [floatingBlockSpeed, setFloatingBlockSpeed] = useState(groundEqSettings.floatingBlockSpeed ?? DEFAULT_FLOATING_BLOCK_SPEED);
  const [floatingBlockCount, setFloatingBlockCount] = useState(groundEqSettings.floatingBlockCount ?? DEFAULT_FLOATING_BLOCK_COUNT);
  const [enabledBands, setEnabledBands] = useState(groundEqSettings.enabledBands ?? new Array(8).fill(true));

  useEffect(() => {
    setBands(groundEqSettings.bands);
    setMotionSpeed(groundEqSettings.motionSpeed ?? DEFAULT_GROUND_MOTION_SPEED);
    setAmplitude(groundEqSettings.amplitude ?? 50);
    setTerrainDensity(groundEqSettings.terrainDensity ?? DEFAULT_TERRAIN_DENSITY);
    setFloatingBlocksEnabled(groundEqSettings.floatingBlocksEnabled ?? DEFAULT_FLOATING_BLOCKS_ENABLED);
    setFloatingBlockIntensity(groundEqSettings.floatingBlockIntensity ?? DEFAULT_FLOATING_BLOCK_INTENSITY);
    setFloatingBlockMinSize(groundEqSettings.floatingBlockMinSize ?? DEFAULT_FLOATING_BLOCK_MIN_SIZE);
    setFloatingBlockMaxSize(groundEqSettings.floatingBlockMaxSize ?? DEFAULT_FLOATING_BLOCK_MAX_SIZE);
    setFloatingBlockSpeed(groundEqSettings.floatingBlockSpeed ?? DEFAULT_FLOATING_BLOCK_SPEED);
    setFloatingBlockCount(groundEqSettings.floatingBlockCount ?? DEFAULT_FLOATING_BLOCK_COUNT);
    setEnabledBands(groundEqSettings.enabledBands ?? new Array(8).fill(true));
  }, [
    groundEqSettings.bands,
    groundEqSettings.motionSpeed,
    groundEqSettings.amplitude,
    groundEqSettings.terrainDensity,
    groundEqSettings.floatingBlocksEnabled,
    groundEqSettings.floatingBlockIntensity,
    groundEqSettings.floatingBlockMinSize,
    groundEqSettings.floatingBlockMaxSize,
    groundEqSettings.floatingBlockSpeed,
    groundEqSettings.enabledBands,
  ]);

  const bandNotes: Array<{
    id: GroundEqBandId;
    marker: string;
    color: string;
    label: string;
    english: string;
    effect: string;
    description: string;
  }> = [
    { id: 'subBass', marker: '1', color: '#6ee7ff', label: '中心抬升', english: 'Sub Bass', effect: '大块抬升', description: '低沉冲击会把地面中心顶起来。' },
    { id: 'bass', marker: '2', color: '#5eead4', label: '低频重量', english: 'Bass', effect: '块状起伏', description: '底鼓和低音线推动中心附近的厚重起伏。' },
    { id: 'lowMid', marker: '3', color: '#a7f3d0', label: '慢波流动', english: 'Low Mid', effect: '整片波浪', description: '控制整片地形的慢速波浪和呼吸感。' },
    { id: 'mid', marker: '4', color: '#fde68a', label: '方向流', english: 'Mid', effect: '斜向流动', description: '人声和旋律会带出更明显的地面方向感。' },
    { id: 'highMid', marker: '5', color: '#fbbf24', label: '尖峰', english: 'High Mid', effect: '外围散点', description: '让外围随机柱体更容易冒出尖峰。' },
    { id: 'presence', marker: '6', color: '#fb7185', label: '闪光触发', english: 'Presence', effect: '局部闪光', description: '清脆敲击、齿音和镲片会触发更多亮点。' },
    { id: 'brilliance', marker: '7', color: '#c084fc', label: '边缘微闪', english: 'Brilliance', effect: '细碎高亮', description: '强化柱体边缘的细碎火花和微闪。' },
    { id: 'air', marker: '8', color: '#93c5fd', label: '空气颗粒', english: 'Air', effect: '高频颗粒', description: '控制最轻的高频颗粒和轻微闪烁。' },
  ];

  const commitBand = (bandIndex: number, nextValue: number) => {
    const nextBands = bands.map((value, index) => (
      index === bandIndex ? Math.max(0, Math.min(100, Math.round(nextValue))) : value
    ));
    setBands(nextBands);
    onGroundEqSettingsChange({ bands: nextBands, motionSpeed, amplitude, terrainDensity, floatingBlocksEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const commitEnabledBand = (bandIndex: number, nextEnabled: boolean) => {
    const nextEnabledBands = enabledBands.map((value, index) => (
      index === bandIndex ? nextEnabled : value
    ));
    setEnabledBands(nextEnabledBands);
    onGroundEqSettingsChange({ bands, motionSpeed, amplitude, terrainDensity, floatingBlocksEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands: nextEnabledBands });
  };

  const commitMotionSpeed = (nextValue: number) => {
    const nextMotionSpeed = Math.max(0, Math.min(100, Math.round(nextValue)));
    setMotionSpeed(nextMotionSpeed);
    onGroundEqSettingsChange({ bands, motionSpeed: nextMotionSpeed, amplitude, terrainDensity, floatingBlocksEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const commitAmplitude = (nextValue: number) => {
    const nextAmplitude = Math.max(0, Math.min(100, Math.round(nextValue)));
    setAmplitude(nextAmplitude);
    onGroundEqSettingsChange({ bands, motionSpeed, amplitude: nextAmplitude, terrainDensity, floatingBlocksEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const commitTerrainDensity = (nextValue: number) => {
    const nextTerrainDensity = Math.max(0, Math.min(100, Math.round(nextValue)));
    setTerrainDensity(nextTerrainDensity);
    onGroundEqSettingsChange({ bands, motionSpeed, amplitude, terrainDensity: nextTerrainDensity, floatingBlocksEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const commitFloatingBlocksEnabled = (nextEnabled: boolean) => {
    setFloatingBlocksEnabled(nextEnabled);
    onGroundEqSettingsChange({ bands, motionSpeed, amplitude, terrainDensity, floatingBlocksEnabled: nextEnabled, floatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const commitFloatingBlockIntensity = (nextValue: number) => {
    const nextFloatingBlockIntensity = Math.max(0, Math.min(100, Math.round(nextValue)));
    setFloatingBlockIntensity(nextFloatingBlockIntensity);
    onGroundEqSettingsChange({ bands, motionSpeed, amplitude, terrainDensity, floatingBlocksEnabled, floatingBlockIntensity: nextFloatingBlockIntensity, floatingBlockMinSize, floatingBlockMaxSize, floatingBlockSpeed, floatingBlockCount, enabledBands });
  };

  const resetBands = () => {
    const nextBands = [...defaultGroundEqBands];
    const nextEnabledBands = new Array(8).fill(true);
    setBands(nextBands);
    setEnabledBands(nextEnabledBands);
    setMotionSpeed(DEFAULT_GROUND_MOTION_SPEED);
    setAmplitude(50);
    setTerrainDensity(DEFAULT_TERRAIN_DENSITY);
    setFloatingBlocksEnabled(DEFAULT_FLOATING_BLOCKS_ENABLED);
    setFloatingBlockIntensity(DEFAULT_FLOATING_BLOCK_INTENSITY);
    setFloatingBlockMinSize(DEFAULT_FLOATING_BLOCK_MIN_SIZE);
    setFloatingBlockMaxSize(DEFAULT_FLOATING_BLOCK_MAX_SIZE);
    setFloatingBlockSpeed(DEFAULT_FLOATING_BLOCK_SPEED);
    onGroundEqSettingsChange({
      bands: nextBands,
      motionSpeed: DEFAULT_GROUND_MOTION_SPEED,
      amplitude: 50,
      terrainDensity: DEFAULT_TERRAIN_DENSITY,
      floatingBlocksEnabled: DEFAULT_FLOATING_BLOCKS_ENABLED,
      floatingBlockIntensity: DEFAULT_FLOATING_BLOCK_INTENSITY,
      floatingBlockMinSize: DEFAULT_FLOATING_BLOCK_MIN_SIZE,
      floatingBlockMaxSize: DEFAULT_FLOATING_BLOCK_MAX_SIZE,
      floatingBlockSpeed: DEFAULT_FLOATING_BLOCK_SPEED,
      floatingBlockCount: DEFAULT_FLOATING_BLOCK_COUNT,
      enabledBands: nextEnabledBands,
    });
  };

  const terrainGridSettings = deriveTerrainGridSettings(terrainDensity);
  const terrainBlockCount = terrainGridSettings.instanceCount.toLocaleString();

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4 border border-white/10 bg-white/[0.03] rounded-sm p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-white/70 mb-2">地面特效混音台</div>
          <div className="text-[11px] leading-relaxed text-white/45">每条竖滑块只控制一个地面特效。横向速度控制柱子起伏快慢，不改变音乐声音。</div>
        </div>
        <button
          onClick={resetBands}
          className="shrink-0 px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/55 hover:text-white transition-colors"
        >
          恢复默认
        </button>
      </div>

      <div className="rounded-sm border bg-white/[0.025] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-white/70">起伏速度</div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/38">控制地面柱子跟随音乐升高和回落的速度</div>
          </div>
          <div className="text-[13px] font-medium tabular-nums" style={{ color: accentHex }}>{motionSpeed}</div>
        </div>
        <div className="mt-4 grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">柔和</span>
          <input
            aria-label="地面起伏速度"
            type="range"
            min={0}
            max={100}
            step={1}
            value={motionSpeed}
            onChange={(event) => commitMotionSpeed(Number(event.target.value))}
            className="h-1 w-full cursor-pointer accent-current"
            style={{ accentColor: accentHex }}
          />
          <span className="text-right text-[10px] uppercase tracking-[0.12em] text-white/35">敏捷</span>
        </div>
        
        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-white/70">起伏高度</div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/38">控制音乐触发的地形高低缩放</div>
          </div>
          <div className="text-[13px] font-medium tabular-nums" style={{ color: accentHex }}>{amplitude}</div>
        </div>
        <div className="mt-4 grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">平缓</span>
          <input
            aria-label="地面起伏高度"
            type="range"
            min={0}
            max={100}
            step={1}
            value={amplitude}
            onChange={(event) => commitAmplitude(Number(event.target.value))}
            className="h-1 w-full cursor-pointer accent-current"
            style={{ accentColor: accentHex }}
          />
          <span className="text-right text-[10px] uppercase tracking-[0.12em] text-white/35">高耸</span>
        </div>
        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-white/70">方块密度</div>
            <div className="mt-1 text-[10px] leading-relaxed text-white/38">低性能时方块更大更少，高性能时方块更小更多</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium tabular-nums" style={{ color: accentHex }}>{terrainDensity}</div>
            <div className="mt-1 text-[10px] tabular-nums text-white/35">{terrainBlockCount} blocks</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">性能</span>
          <input
            aria-label="方块密度"
            type="range"
            min={0}
            max={100}
            step={1}
            value={terrainDensity}
            onChange={(event) => commitTerrainDensity(Number(event.target.value))}
            className="h-1 w-full cursor-pointer accent-current"
            style={{ accentColor: accentHex }}
          />
          <span className="text-right text-[10px] uppercase tracking-[0.12em] text-white/35">细节</span>
        </div>
      </div>

      <div className="themed-scrollbar overflow-x-auto rounded-sm border bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
        <div className="min-w-[760px] grid grid-cols-8 divide-x divide-white/10">
          {bandNotes.map((note, index) => {
            const value = bands[index] ?? DEFAULT_GROUND_EQ_VALUE;
            const fill = `${value}%`;
            return (
              <div key={note.id} className="relative flex min-h-[360px] flex-col items-center px-3 py-4">
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border text-[10px] font-medium" style={{ color: note.color, borderColor: `${note.color}66`, backgroundColor: `${note.color}22` }}>
                  {note.marker}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: accentHex }}>{value}</span>
                </div>

                <div className="mt-4 h-[190px] w-full rounded-sm border border-white/10 bg-white/[0.025] px-2 py-3">
                  <div className="relative mx-auto flex h-full w-10 items-center justify-center">
                    <div className="absolute h-full w-[3px] rounded-full bg-white/10" />
                    <div
                      className="absolute bottom-0 w-[3px] rounded-full transition-[height] duration-150"
                      style={{ height: fill, backgroundColor: note.color }}
                    />
                    <input
                      aria-label={`${note.label} ${note.english}`}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={value}
                      onChange={(event) => commitBand(index, Number(event.target.value))}
                      className="relative h-[170px] w-8 cursor-pointer accent-white"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', accentColor: note.color }}
                    />
                  </div>
                </div>

                <div className="mt-4 w-full">
                  <div className="text-[12px] leading-4 text-white/75">{note.label}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: note.color }}>{note.english}</div>
                  <div className="mt-2 text-[10px] leading-relaxed text-white/35">{note.effect}</div>
                  <div className="mt-1 min-h-[42px] text-[10px] leading-relaxed text-white/35">{note.description}</div>
                  <label className="mt-3 flex items-center gap-2 cursor-pointer group">
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${enabledBands[index] ? 'border-transparent text-black' : 'border-white/20 bg-transparent text-transparent'}`} style={{ backgroundColor: enabledBands[index] ? note.color : undefined }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.08em] text-white/50 group-hover:text-white/80 transition-colors select-none">
                      启用特效
                    </span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={enabledBands[index]}
                      onChange={(e) => commitEnabledBand(index, e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ThrottledColorInput({ value, onChange, disabled, className, title }: { value: string, onChange: (val: string) => void, disabled?: boolean, className?: string, title?: string }) {
  const [localValue, setLocalValue] = React.useState(value);
  const lastUpdateRef = React.useRef(0);
  const timeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);

    const now = Date.now();
    if (now - lastUpdateRef.current >= 50) {
      onChange(val);
      lastUpdateRef.current = now;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(val);
        lastUpdateRef.current = Date.now();
      }, 50);
    }
  };

  React.useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <input
      type="color"
      value={localValue}
      onChange={handleChange}
      disabled={disabled}
      className={className}
      title={title}
    />
  );
}

function ThrottledRangeInput({ min, max, step, value, onChange, className, style }: any) {
  const [localValue, setLocalValue] = React.useState(value);
  const lastUpdateRef = React.useRef(0);
  const timeoutRef = React.useRef<any>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalValue(val);

    const now = Date.now();
    if (now - lastUpdateRef.current >= 50) {
      onChange(val);
      lastUpdateRef.current = now;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(val);
        lastUpdateRef.current = Date.now();
      }, 50);
    }
  };

  React.useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={handleChange}
      className={className}
      style={style}
    />
  );
}

function CustomColorPanel({
  accentHex,
  theme,
  customThemes,
  activeCustomThemeId,
  themeRotation,
  onThemeChange,
  onCustomThemesChange,
  onThemeRotationChange,
}: {
  accentHex: string;
  theme: string;
  customThemes: CustomThemeSettings[];
  activeCustomThemeId: string;
  themeRotation: ThemeRotationSettings;
  onThemeChange: (theme: string) => void;
  onCustomThemesChange: (settings: CustomThemeSettings[], activeId?: string) => void;
  onThemeRotationChange: (settings: ThemeRotationSettings) => void;
}) {
  const activePreset = customThemes.find((preset) => preset.id === activeCustomThemeId) || customThemes[0] || createCustomThemePreset();
  const rotationItems = [
    ...BUILT_IN_THEME_IDS.map((id) => ({
      id,
      name: themes[id]?.name || id,
      colors: [
        `#${themes[id].uBaseColor1.getHexString()}`,
        `#${themes[id].uCoolCore.getHexString()}`,
        `#${themes[id].uWarmCore.getHexString()}`,
        `#${themes[id].uRippleColor.getHexString()}`,
      ],
    })),
    ...customThemes.map((preset) => ({
      id: preset.id,
      name: preset.name,
      colors: [preset.background, preset.fog, preset.cool, preset.warm, preset.accent],
    })),
  ];

  const savePresets = (nextPresets: CustomThemeSettings[], nextActiveId = activePreset.id) => {
    onCustomThemesChange(nextPresets, nextActiveId);
  };

  const updateRotation = (patch: Partial<ThemeRotationSettings>) => {
    onThemeRotationChange({ ...themeRotation, ...patch });
  };

  const toggleRotationTheme = (themeId: string) => {
    const isSelected = themeRotation.themeIds.includes(themeId);
    const nextIds = isSelected
      ? themeRotation.themeIds.filter((id) => id !== themeId)
      : [...themeRotation.themeIds, themeId];
    updateRotation({ themeIds: nextIds });
  };

  const updateCustomTheme = (patch: Partial<CustomThemeSettings>) => {
    const nextPresets = customThemes.map((preset) => (
      preset.id === activePreset.id
        ? (() => {
          const next = { ...preset, ...patch };
          if (patch.fogLinkedToBackground === true) next.fog = next.background;
          else if (patch.background && next.fogLinkedToBackground) next.fog = patch.background;
          return next;
        })()
        : preset
    ));
    savePresets(nextPresets, activePreset.id);
    onThemeChange(CUSTOM_THEME_ID);
  };

  const useCustomTheme = (presetId: string) => {
    savePresets(customThemes, presetId);
    onThemeChange(CUSTOM_THEME_ID);
  };

  const addCustomTheme = () => {
    const nextPreset = createCustomThemePreset({
      ...activePreset,
      id: undefined,
      name: `自定义主题 ${customThemes.length + 1}`,
    });
    savePresets([...customThemes, nextPreset], nextPreset.id);
  };

  const deleteCustomTheme = (presetId: string) => {
    if (customThemes.length <= 1) return;
    const nextPresets = customThemes.filter((preset) => preset.id !== presetId);
    const nextActiveId = activePreset.id === presetId ? nextPresets[0].id : activePreset.id;
    savePresets(nextPresets, nextActiveId);
  };

  const colorControls: Array<{ key: keyof Pick<CustomThemeSettings, 'cool' | 'warm' | 'accent'>; label: string; hint: string }> = [
    { key: 'cool', label: '冷色', hint: '控制亮部、冷调和高频地形发光' },
    { key: 'warm', label: '暖色', hint: '控制暖调地形发光，也会影响流星颜色' },
    { key: 'accent', label: '强调色', hint: '控制按钮、歌词、进度条、脉冲波纹和设置滑块' },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-4 border border-white/10 bg-white/[0.03] rounded-sm p-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.18em] text-white/70 mb-2">自定义主题</div>
          <div className="text-[11px] leading-relaxed text-white/45">
            四个内置主题保持原样。这里可以提前保存多个自定义主题，点击“使用”后才会切换。
          </div>
        </div>
        <button
          onClick={addCustomTheme}
          className="shrink-0 px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/55 hover:text-white transition-colors"
        >
          新建主题
        </button>
      </div>

      <div className="grid gap-4 rounded-sm border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-white/70 mb-2">自动轮换主题</div>
            <div className="text-[11px] leading-relaxed text-white/45">选择参与轮换的默认主题和自定义主题，并设置切换间隔。</div>
          </div>
          <button
            onClick={() => updateRotation({ enabled: !themeRotation.enabled })}
            className={`px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.15em] transition-colors ${
              themeRotation.enabled ? '' : 'border-white/10 text-white/45 hover:text-white'
            }`}
            style={themeRotation.enabled ? activeControlStyle(accentHex) : undefined}
          >
            {themeRotation.enabled ? '已开启' : '开启轮换'}
          </button>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] text-white/75">轮换时间</div>
            <div className="text-[12px]" style={{ color: accentHex }}>{themeRotation.intervalSeconds} 秒</div>
          </div>
          <ThrottledRangeInput
            min="3"
            max="120"
            step="1"
            value={themeRotation.intervalSeconds}
            onChange={(val: number) => updateRotation({ intervalSeconds: val })}
            className="w-full accent-current h-1"
            style={{ accentColor: accentHex }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => updateRotation({ themeIds: rotationItems.map((item) => item.id) })}
            className="px-3 py-1.5 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/45 hover:text-white transition-colors"
          >
            全选
          </button>
          <button
            onClick={() => updateRotation({ themeIds: [] })}
            className="px-3 py-1.5 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/45 hover:text-white transition-colors"
          >
            清空
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rotationItems.map((item) => {
            const isSelected = themeRotation.themeIds.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggleRotationTheme(item.id)}
                className={`flex items-center justify-between gap-3 rounded-sm border px-3 py-2 text-left transition-colors ${
                  isSelected ? 'bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                }`}
                style={isSelected ? { borderColor: colorWithAlpha(accentHex, 0.38) } : undefined}
              >
                <span className="min-w-0">
                  <span className="block text-[11px] text-white/75 truncate">{item.name}</span>
                  <span className="mt-2 flex gap-1">
                    {item.colors.map((color) => (
                      <span key={`${item.id}-${color}`} className="h-2.5 w-5 rounded-[1px]" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </span>
                <span
                  className="h-4 w-4 shrink-0 rounded-sm border"
                  style={{ borderColor: isSelected ? accentHex : 'rgba(255,255,255,0.18)', backgroundColor: isSelected ? accentHex : 'transparent' }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="themed-scrollbar flex gap-2 overflow-x-auto pb-1">
        {customThemes.map((preset) => {
          const isActivePreset = preset.id === activePreset.id;
          const isUsingPreset = theme === CUSTOM_THEME_ID && preset.id === activeCustomThemeId;
          return (
            <div
              key={preset.id}
              className={`relative shrink-0 min-w-[140px] rounded-sm border transition-colors ${
                isActivePreset ? 'bg-white/[0.06]' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
              }`}
              style={isActivePreset ? { borderColor: colorWithAlpha(accentHex, 0.38) } : undefined}
            >
              <button
                onClick={() => savePresets(customThemes, preset.id)}
                className="block w-full px-3 py-2 pr-10 text-left"
              >
                <span className="block text-[11px] text-white/75 truncate">{preset.name}</span>
                <span className="mt-2 flex gap-1">
                  {[preset.background, preset.fog, preset.cool, preset.warm, preset.accent].map((color) => (
                    <span key={color} className="h-2.5 w-5 rounded-[1px]" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="mt-2 block text-[9px] uppercase tracking-[0.14em]" style={{ color: isUsingPreset ? accentHex : 'rgba(255,255,255,0.35)' }}>
                  {isUsingPreset ? '正在使用' : '已保存'}
                </span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteCustomTheme(preset.id);
                }}
                disabled={customThemes.length <= 1}
                className="absolute right-2 top-2 rounded-sm border border-white/10 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/35 hover:text-[#ef4444] disabled:opacity-25 disabled:hover:text-white/35"
                title="删除主题"
              >
                删除
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2">
        <label className="text-[10px] uppercase tracking-[0.18em] text-white/45">主题名称</label>
        <input
          value={activePreset.name}
          onChange={(event) => updateCustomTheme({ name: event.target.value })}
          className="bg-white/[0.035] border rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
          style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
        />
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-stretch gap-2 rounded-sm border bg-white/[0.025] px-3 py-3" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
          <label className="flex min-w-0 items-center gap-3">
            <ThrottledColorInput
              value={activePreset.background}
              onChange={(val: string) => updateCustomTheme({ background: val })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0"
              title="地面暗部"
            />
            <span className="min-w-0">
              <span className="block text-[12px] text-white/75">地面暗部</span>
              <span className="block mt-1 text-[10px] leading-relaxed text-white/35">控制地面底色和柱体暗部</span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => updateCustomTheme({ fogLinkedToBackground: !activePreset.fogLinkedToBackground })}
            className="grid h-full min-h-[52px] place-items-center rounded-sm border border-white/10 text-white/45 transition-colors hover:text-white"
            style={activePreset.fogLinkedToBackground ? activeControlStyle(accentHex) : undefined}
            title={activePreset.fogLinkedToBackground ? '后景背景跟随地面暗部' : '后景背景独立调整'}
          >
            {activePreset.fogLinkedToBackground ? <Lock size={15} /> : <Unlock size={15} />}
          </button>

          <label className={`flex min-w-0 items-center gap-3 ${activePreset.fogLinkedToBackground ? 'opacity-55' : ''}`}>
            <ThrottledColorInput
              value={activePreset.fog}
              disabled={activePreset.fogLinkedToBackground}
              onChange={(val: string) => updateCustomTheme({ fog: val })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0 disabled:cursor-not-allowed"
              title="后景背景色"
            />
            <span className="min-w-0">
              <span className="block text-[12px] text-white/75">后景背景</span>
              <span className="block mt-1 text-[10px] leading-relaxed text-white/35">
                {activePreset.fogLinkedToBackground ? '已锁定，跟随地面暗部' : '控制画面后方背景，不影响地面暗部'}
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {colorControls.map((control) => (
          <label key={control.key} className="flex items-center gap-3 rounded-sm border bg-white/[0.025] px-3 py-3" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
            <ThrottledColorInput
              value={activePreset[control.key]}
              onChange={(val: string) => updateCustomTheme({ [control.key]: val } as Partial<CustomThemeSettings>)}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-sm border border-white/10 bg-transparent p-0"
              title={control.label}
            />
            <span className="min-w-0">
              <span className="block text-[12px] text-white/75">{control.label}</span>
              <span className="block mt-1 text-[10px] leading-relaxed text-white/35">{control.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="rounded-sm border bg-white/[0.025] px-4 py-3" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] text-white/75">发光强度</div>
            <div className="mt-1 text-[10px] text-white/35">控制地形整体发光亮度</div>
          </div>
          <div className="text-[12px]" style={{ color: accentHex }}>{activePreset.glowIntensity.toFixed(2)}</div>
        </div>
        <ThrottledRangeInput
          min="0.4"
          max="2.2"
          step="0.05"
          value={activePreset.glowIntensity}
          onChange={(val: number) => updateCustomTheme({ glowIntensity: val })}
          className="mt-3 w-full accent-current h-1"
          style={{ accentColor: accentHex }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => deleteCustomTheme(activePreset.id)}
          disabled={customThemes.length <= 1}
          className="px-3 py-2 rounded-sm border border-white/10 text-[10px] uppercase tracking-[0.15em] text-white/35 hover:text-white disabled:opacity-25 disabled:hover:text-white/35 transition-colors"
        >
          删除当前
        </button>
        <button
          onClick={() => useCustomTheme(activePreset.id)}
          className="px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.15em]"
          style={primaryGhostStyle(accentHex)}
        >
          使用这个主题
        </button>
      </div>
    </div>
  );
}

function formatBytes(value: number | undefined) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${amount.toFixed(precision)} ${units[unitIndex]}`;
}

function formatUpdatePublishedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

function PlaybackQualityPanel({
  accentHex,
  settings,
  onSettingsChange,
}: {
  accentHex: string;
  settings: PlaybackQualitySettings;
  onSettingsChange: (settings: PlaybackQualitySettings | ((prev: PlaybackQualitySettings) => PlaybackQualitySettings)) => void;
}) {
  const optionButtonClass = 'rounded-sm border px-3 py-2 text-[11px] tracking-[0.08em] transition-colors';

  return (
    <div className="grid gap-5">
      <div className="rounded-sm border border-white/10 bg-white/[0.035] p-5">
        <div className="text-[12px] uppercase tracking-[0.18em] text-white/65">QQ Music</div>
        <div className="mt-2 text-[11px] leading-relaxed text-white/45">
          QQ 会从所选音质开始尝试，并在不可用时沿用现有降级逻辑。
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QQ_PLAYBACK_QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={optionButtonClass}
              style={settings.qqQuality === option.value ? activeControlStyle(accentHex) : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
              onClick={() => onSettingsChange((prev) => ({ ...prev, qqQuality: option.value as QQPlaybackQuality }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-white/10 bg-white/[0.035] p-5">
        <div className="text-[12px] uppercase tracking-[0.18em] text-white/65">Netease Cloud Music</div>
        <div className="mt-2 text-[11px] leading-relaxed text-white/45">
          网易云会把所选码率传给播放地址接口；可播放性仍取决于账号、版权和地区权限。
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {NETEASE_PLAYBACK_BITRATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={optionButtonClass}
              style={settings.neteaseBitrate === option.value ? activeControlStyle(accentHex) : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
              onClick={() => onSettingsChange((prev) => ({ ...prev, neteaseBitrate: option.value as NeteasePlaybackBitrate }))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UpdatePromptModal({
  accentHex,
  update,
  updateStatus,
  downloadJob,
  onDownload,
  onRemindLater,
  onSkipVersion,
}: {
  accentHex: string;
  update: AvailableUpdateInfo;
  updateStatus: string;
  downloadJob: UpdateDownloadJob | null;
  onDownload: () => void | Promise<void>;
  onRemindLater: () => void;
  onSkipVersion: () => void;
}) {
  const isDownloading = downloadJob?.status === 'queued' || downloadJob?.status === 'downloading';
  const total = Number(downloadJob?.total || 0);
  const progress = downloadJob
    ? (total > 0
      ? `${formatBytes(downloadJob.received)} / ${formatBytes(total)}`
      : `已下载 ${formatBytes(downloadJob.received)}`)
    : '';
  const notes = update.release?.notes?.trim() || '本次更新暂无详细说明。';
  const publishedAt = formatUpdatePublishedAt(update.release?.publishedAt);

  return (
    <div
      className="absolute inset-0 z-[140] pointer-events-auto flex items-center justify-center px-4 backdrop-blur-md"
      style={{ background: 'rgba(0,0,0,0.42)' }}
    >
      <div
        className="w-[560px] max-w-[94vw] max-h-[84vh] overflow-hidden rounded-[18px] border shadow-[0_32px_90px_rgba(0,0,0,0.45)]"
        style={themedPanelStyle(accentHex, 0.92)}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/45">Application Update</div>
            <div className="mt-2 text-[22px] font-semibold tracking-[0.02em] text-white">发现新版本</div>
            <div className="mt-1 text-[12px] text-white/48">
              当前版本 {update.currentVersion || '-'} {'->'} 最新版本 {update.latestVersion || '-'}
            </div>
          </div>
          <button
            onClick={onRemindLater}
            disabled={isDownloading}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 hover:text-white disabled:opacity-40"
            title="下次提醒"
          >
            <X size={15} />
          </button>
        </div>

        <div className="themed-scrollbar grid max-h-[54vh] gap-4 overflow-y-auto px-5 py-4">
          <div className="rounded-[14px] border bg-white/[0.025] px-4 py-3" style={{ borderColor: colorWithAlpha(accentHex, 0.14) }}>
            <div className="text-[13px] font-semibold text-white/85">{update.release?.name || `Sonic Topography ${update.latestVersion || ''}`}</div>
            {publishedAt && <div className="mt-1 text-[11px] text-white/38">发布于 {publishedAt}</div>}
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/50">更新内容</div>
            <div className="max-h-[240px] overflow-y-auto whitespace-pre-wrap rounded-[14px] border bg-black/20 px-4 py-3 text-[12px] leading-relaxed text-white/68" style={{ borderColor: colorWithAlpha(accentHex, 0.14) }}>
              {notes}
            </div>
          </div>

          {(updateStatus || downloadJob) && (
            <div className="rounded-[14px] border bg-white/[0.025] px-4 py-3 text-[12px] leading-relaxed text-white/58" style={{ borderColor: colorWithAlpha(accentHex, 0.14) }}>
              <div>{updateStatus || '等待下载'}</div>
              {downloadJob?.channelName && <div className="mt-1 text-white/42">下载通道：{downloadJob.channelName}</div>}
              {downloadJob && <div className="mt-1 text-white/42">进度：{progress}</div>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4" style={{ borderColor: colorWithAlpha(accentHex, 0.18) }}>
          <button
            onClick={onSkipVersion}
            disabled={isDownloading}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-[11px] tracking-[0.08em] text-white/50 hover:text-white disabled:opacity-40"
          >
            不再提示这个版本
          </button>
          <button
            onClick={onRemindLater}
            disabled={isDownloading}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-[11px] tracking-[0.08em] text-white/60 hover:text-white disabled:opacity-40"
          >
            下次提醒
          </button>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="rounded-[10px] border px-4 py-2 text-[11px] font-semibold tracking-[0.08em] disabled:opacity-40"
            style={primaryGhostStyle(accentHex)}
          >
            {isDownloading ? '下载中' : '立即更新'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountLoginPanel({
  accentHex,
  neteaseCookie,
  setNeteaseCookie,
  onSaveCookie,
  onClearCookie,
  cookieStatus,
  isNeteaseCookieValid,
  isSyncingNeteaseCookie,
  qqCookie,
  setQQCookie,
  onSaveQQCookie,
  onClearQQCookie,
  qqCookieStatus,
  isQQCookieValid,
  isSyncingQQCookie,
  desktopLoginStatus,
  onDesktopNeteaseLogin,
  onDesktopQQLogin,
  updateStatus,
  isCheckingUpdate,
  onCheckUpdate,
}: {
  accentHex: string;
  neteaseCookie: string;
  setNeteaseCookie: (cookie: string) => void;
  onSaveCookie: () => void | Promise<void>;
  onClearCookie: () => void | Promise<void>;
  cookieStatus: string;
  isNeteaseCookieValid: boolean;
  isSyncingNeteaseCookie: boolean;
  qqCookie: string;
  setQQCookie: (cookie: string) => void;
  onSaveQQCookie: () => void | Promise<void>;
  onClearQQCookie: () => void | Promise<void>;
  qqCookieStatus: string;
  isQQCookieValid: boolean;
  isSyncingQQCookie: boolean;
  desktopLoginStatus: string;
  onDesktopNeteaseLogin: () => void | Promise<void>;
  onDesktopQQLogin: () => void | Promise<void>;
  updateStatus: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void | Promise<void>;
}) {
  const [provider, setProvider] = useState<'netease' | 'qq'>('netease');
  const isDesktop = Boolean(window.sonicDesktop?.isDesktop);
  const activeValid = provider === 'netease' ? isNeteaseCookieValid : isQQCookieValid;
  const activeStatus = provider === 'netease' ? cookieStatus : qqCookieStatus;
  const isSyncing = provider === 'netease' ? isSyncingNeteaseCookie : isSyncingQQCookie;

  return (
    <div className="grid gap-5">
      <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="grid grid-cols-2 gap-1">
          {[
            { id: 'netease' as const, label: '网易云' },
            { id: 'qq' as const, label: 'QQ 音乐' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setProvider(item.id)}
              className={`rounded-[14px] px-4 py-2 text-[12px] font-semibold tracking-[0.08em] transition-colors ${
                provider === item.id ? 'text-white' : 'text-white/42 hover:text-white/70'
              }`}
              style={{ background: provider === item.id ? `${accentHex}42` : 'transparent' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: colorWithAlpha(accentHex, 0.16), background: `linear-gradient(135deg, ${colorWithAlpha(accentHex, 0.10)}, rgba(255,255,255,0.02))` }}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Sonic Topography</div>
          <div className="mt-2 text-[20px] font-semibold tracking-[0.02em] text-white">音乐播放器，也是一座视觉舞台</div>
          <div className="mt-2 max-w-[58ch] text-[12px] leading-relaxed text-white/52">
            打开官方网页扫码登录，成功后会自动同步账号会话。Cookie 只保存在本机，用于搜索、歌单、歌词和播放地址。
          </div>
        </div>

        <div className="grid place-items-center py-4">
          <div className="grid h-[184px] w-[184px] place-items-center rounded-[20px] border text-center" style={{ borderColor: colorWithAlpha(accentHex, 0.22), backgroundColor: colorWithAlpha(accentHex, 0.06) }}>
            <div>
              <div className="text-[26px] font-semibold tracking-[0.12em]" style={{ color: accentHex }}>
                {provider === 'netease' ? 'NE' : 'QQ'}
              </div>
              <div className="mt-2 text-[11px] text-white/38">
                {activeValid ? '账号已同步' : '等待扫码确认'}
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-[12px] leading-relaxed text-white/55">
          {isSyncing ? '正在校验会话...' : (desktopLoginStatus || activeStatus || (activeValid ? '账号可用，音乐入口已开启' : `扫码登录${provider === 'netease' ? '网易云音乐' : 'QQ 音乐'}`))}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            onClick={provider === 'netease' ? onClearCookie : onClearQQCookie}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-[11px] tracking-[0.08em] text-white/55 hover:text-white"
          >
            取消/清除
          </button>
          <button
            onClick={provider === 'netease' ? onDesktopNeteaseLogin : onDesktopQQLogin}
            disabled={!isDesktop}
            className="rounded-[10px] border px-4 py-2 text-[11px] font-semibold tracking-[0.08em] disabled:opacity-40"
            style={primaryGhostStyle(accentHex)}
          >
            {isDesktop ? '打开官方窗口扫码' : '桌面版可扫码登录'}
          </button>
        </div>
      </div>

      {!isDesktop && (
        <div className="grid gap-3 rounded-[16px] border bg-white/[0.025] p-4" style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}>
          <div className="text-[12px] uppercase tracking-[0.18em] text-white/60">手动 Cookie 降级入口</div>
          {provider === 'netease' ? (
            <>
              <textarea
                value={neteaseCookie}
                onChange={(e) => setNeteaseCookie(e.target.value)}
                spellCheck={false}
                placeholder="MUSIC_U=...; __csrf=...; NMTID=..."
                className="min-h-[120px] resize-y rounded-[12px] border bg-white/[0.035] px-3 py-3 font-mono text-[12px] leading-relaxed text-white outline-none focus:border-white/30"
                style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
              />
              <button onClick={onSaveCookie} className="w-fit rounded-[10px] border px-4 py-2 text-[11px]" style={primaryGhostStyle(accentHex)}>保存网易云 Cookie</button>
            </>
          ) : (
            <>
              <textarea
                value={qqCookie}
                onChange={(e) => setQQCookie(e.target.value)}
                spellCheck={false}
                placeholder="uin=...; qm_keyst=...; qqmusic_key=..."
                className="min-h-[120px] resize-y rounded-[12px] border bg-white/[0.035] px-3 py-3 font-mono text-[12px] leading-relaxed text-white outline-none focus:border-white/30"
                style={{ borderColor: colorWithAlpha(accentHex, 0.16) }}
              />
              <button onClick={onSaveQQCookie} className="w-fit rounded-[10px] border px-4 py-2 text-[11px]" style={primaryGhostStyle(accentHex)}>保存 QQ Cookie</button>
            </>
          )}
        </div>
      )}

      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-white/65">应用更新</div>
            <div className="mt-1 text-[11px] text-white/40">{updateStatus || '检查 GitHub Release，下载后打开安装包更新。'}</div>
          </div>
          <button
            onClick={onCheckUpdate}
            disabled={isCheckingUpdate}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-[11px] tracking-[0.08em] text-white/60 hover:text-white disabled:opacity-40"
          >
            {isCheckingUpdate ? '检查中' : '检查更新'}
          </button>
        </div>
      </div>
    </div>
  );
}
function FreqTriggerPanel({ action, accentHex }: { action: 'Pulse' | 'Meteor', accentHex: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const getConfig = () => action === 'Pulse' ? engine.pulseTrigger : engine.meteorTrigger;
  
  const [triggerPoint, setTriggerPoint] = useState({ 
    x: getConfig().freqIndex >= 0 ? getConfig().freqIndex / 512 : 0.5, 
    y: getConfig().threshold 
  });
  const [isEnabled, setIsEnabled] = useState(getConfig().enabled);
  const [mode, setMode] = useState<TriggerPreset>(getConfig().mode);
  const [sensitivity, setSensitivity] = useState(getConfig().sensitivity);
  const [cooldown, setCooldown] = useState(getConfig().cooldown);
  const [pulseStrength, setPulseStrength] = useState(getConfig().pulseStrength);
  const [bandStart, setBandStart] = useState(getConfig().bandStart);
  const [bandEnd, setBandEnd] = useState(getConfig().bandEnd);
  const isDragging = useRef(false);

  // Sync state TO engine when parameters change
  useEffect(() => {
     const c = getConfig();
     c.enabled = isEnabled;
     c.mode = mode;
     c.sensitivity = sensitivity;
     c.cooldown = cooldown;
     c.pulseStrength = pulseStrength;
     c.bandStart = bandStart;
     c.bandEnd = bandEnd;
     
     if (mode === 'Advanced') {
         c.freqIndex = Math.floor(triggerPoint.x * 512);
         c.threshold = triggerPoint.y;
     } else {
         c.freqIndex = -1;
     }

     writeTriggerSettingsStorage({
       Pulse: snapshotTriggerConfig(engine.pulseTrigger),
       Meteor: snapshotTriggerConfig(engine.meteorTrigger),
     });
  }, [isEnabled, mode, sensitivity, cooldown, pulseStrength, bandStart, bandEnd, triggerPoint]);

  const handleModeChange = (newMode: TriggerPreset) => {
    setMode(newMode);
  };

  const presets: TriggerPreset[] = ['Auto Beat', 'Advanced'];
  const modeLabels: Record<TriggerPreset, string> = {
    'Auto Beat': '自动节拍',
    Advanced: '高级模式',
  };
  const actionLabel = action === 'Pulse' ? '脉冲特效' : '流星特效';

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for(let i=1; i<10; i++) {
         ctx.moveTo(0, height * i / 10);
         ctx.lineTo(width, height * i / 10);
         ctx.moveTo(width * i / 10, 0);
         ctx.lineTo(width * i / 10, height);
      }
      ctx.stroke();

      const data = engine.getRawFrequencyData();
      const binCount = data.length || 512;

      // Draw highlighted band
      const [startBin, endBin] = getConfig().getTriggerRange();
      const startX = (startBin / binCount) * width;
      const endX = (endBin / binCount) * width;
      
      ctx.fillStyle = mode === 'Advanced' ? 'rgba(255,255,255,0.02)' : `${accentHex}20`;
      ctx.fillRect(startX, 0, Math.max(1, endX - startX), height);
      
      if (mode !== 'Advanced') {
         ctx.strokeStyle = accentHex + '80';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.moveTo(endX, 0);
         ctx.lineTo(endX, height);
         ctx.stroke();
      }

      // Draw spectrum
      ctx.fillStyle = accentHex + '40'; // opacity
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      for(let i = 0; i < binCount; i++) {
         const x = (i / binCount) * width;
         const val = data[i] / 255.0;
         const y = height - (val * height);
         ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      if (mode === 'Advanced') {
          // Draw drag point
          const tx = triggerPoint.x * width;
          const ty = height - (triggerPoint.y * height);
          
          ctx.beginPath();
          ctx.moveTo(tx, 0);
          ctx.lineTo(tx, height);
          ctx.moveTo(0, ty);
          ctx.lineTo(width, ty);
          ctx.strokeStyle = accentHex;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(tx, ty, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
      } else {
          // Draw dynamic threshold line
          const evE = getConfig().lastEvalEnergy;
          const evThresh = getConfig().lastEvalThresh;
          
          const eY = height - (evE * height);
          const tY = height - (evThresh * height);
          
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.moveTo(0, tY);
          ctx.lineTo(width, tY);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Current energy dot
          const cx = (startX + endX) / 2;
          ctx.beginPath();
          ctx.arc(cx, eY, 6, 0, Math.PI * 2);
          ctx.fillStyle = evE > evThresh ? accentHex : 'rgba(255,255,255,0.5)';
          ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [accentHex, triggerPoint, mode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'Advanced') return;
    isDragging.current = true;
    updateTriggerFromEvent(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || mode !== 'Advanced') return;
    updateTriggerFromEvent(e);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const updateTriggerFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    
    setTriggerPoint({ x, y });
    const config = action === 'Meteor' ? engine.meteorTrigger : engine.pulseTrigger;
    config.freqIndex = Math.floor(x * 512); // assuming binCount max 512
    config.threshold = y;
  };

  return (
    <div>
          <div className="flex items-center justify-between mb-6">
             <div className="text-[12px] uppercase tracking-[0.2em] text-white/70">{actionLabel}</div>
             <label className="flex items-center gap-2 cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={isEnabled} 
                 onChange={(e) => setIsEnabled(e.target.checked)}
                 className="w-4 h-4 rounded-sm border-white/20 bg-black/50"
                 style={{ accentColor: accentHex }}
               />
               <span className="text-[10px] uppercase tracking-widest text-white/50">启用</span>
             </label>
          </div>
          
          <div className="flex gap-2 mb-4">
            {presets.map(p => (
               <button
                  key={p}
                  onClick={() => handleModeChange(p)}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm border transition-colors ${
                     mode === p ? 'bg-white/10 text-white border-white/20' : 'border-transparent text-white/40 hover:text-white hover:bg-white/5'
                  }`}
               >
                  {modeLabels[p]}
               </button>
            ))}
          </div>

          <p className="text-[11px] text-white/40 mb-6 font-mono h-10 leading-relaxed">
            {mode === 'Advanced' 
              ? '拖动十字线设置目标频率和触发阈值。频谱超过阈值时，会触发当前视觉特效。'
              : '自动节拍会比较当前频段能量和滚动平均值，能量明显抬升时触发视觉特效。'}
          </p>
          <div className={`relative w-full aspect-[2/1] bg-black/50 border border-white/5 rounded overflow-hidden ${mode === 'Advanced' ? 'cursor-crosshair' : ''}`}>
            <canvas 
              ref={canvasRef}
              width={800} 
              height={400} 
              className="w-full h-full block"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          {mode === 'Auto Beat' && (
            <div className="mt-8 grid grid-cols-2 gap-6">
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>灵敏度</span>
                    <span style={{ color: accentHex }}>{sensitivity.toFixed(2)}</span>
                 </div>
                 <input type="range" min="0" max="1" step="0.05" value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>冷却帧数</span>
                    <span style={{ color: accentHex }}>{cooldown}</span>
                 </div>
                 <input type="range" min="0" max="300" step="1" value={cooldown} onChange={e => setCooldown(parseInt(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>触发频段 ({bandStart} - {bandEnd})</span>
                 </div>
                 <div className="flex gap-2">
                   <input type="range" min="0" max="250" step="1" value={bandStart} onChange={e => setBandStart(Math.min(parseInt(e.target.value), bandEnd - 1))} className="w-1/2 accent-current h-1" style={{ accentColor: accentHex }}/>
                   <input type="range" min="2" max="256" step="1" value={bandEnd} onChange={e => setBandEnd(Math.max(parseInt(e.target.value), bandStart + 1))} className="w-1/2 accent-current h-1" style={{ accentColor: accentHex }}/>
                 </div>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="flex justify-between uppercase tracking-widest text-[10px] text-white/50">
                    <span>特效强度</span>
                    <span style={{ color: accentHex }}>{pulseStrength.toFixed(2)}</span>
                 </div>
                 <input type="range" min="0" max="5" step="0.1" value={pulseStrength} onChange={e => setPulseStrength(parseFloat(e.target.value))} className="w-full accent-current h-1" style={{ accentColor: accentHex }}/>
               </div>
            </div>
          )}
    </div>
  );
}





