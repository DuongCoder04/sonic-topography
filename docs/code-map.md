# Sonic Topography Code Map

This file is the project index for future code changes, debugging, testing, and review.

Last fully verified commit: `unknown`

## Start Here

| Goal | Main files | Tests | Verification |
| --- | --- | --- | --- |
| Electron shell, window chrome, login bridge, installer config | `desktop/main.js`, `desktop/preload.cjs`, `scripts/dev-electron.mjs`, `package.json` | `src/lib/neteaseCookie.test.ts`, `src/lib/qqCookie.test.ts` | `npm run dev:electron`, `npm run build:electron:dir`, `npm run build:electron` |
| Anonymous desktop usage analytics | `desktop/analytics.js`, `desktop/main.js`, `README.md`, `README.en.md` | `desktop/analytics.test.mjs` | `node desktop/analytics.test.mjs`, `npm run lint`, `npm run build:electron:dir`, verify open/heartbeat/close events in SLS |
| Player UI, sidebar, search, cloud music panel | `src/components/UI/UI.tsx`, `src/index.css`, `src/App.tsx` | `src/lib/triggerSettings.test.ts`, `src/lib/presetTransfer.test.ts` | `npm run lint`, `npm run build`, `npm run dev:electron` |
| Language switching and UI copy | `src/lib/i18n.ts`, `src/lib/locales.ts`, `src/components/UI/UI.tsx` | none dedicated yet | `npm run lint`, `npm run build`, manual zh/en toggle check in Electron |
| Playback quality selection | `src/components/UI/UI.tsx`, `src/lib/playbackQuality.ts`, `server/netease-playback.mjs`, `server/netease-audio-proxy.mjs`, `vite.config.ts`, `local-server.mjs`, `server/qq-music.mjs` | `src/lib/playbackQuality.test.ts`, `src/lib/neteasePlayback.test.ts`, `src/lib/neteaseAudioProxy.test.ts`, `src/lib/qqMusicLibrary.test.ts` | `npx tsx src/lib/playbackQuality.test.ts`, `npx tsx src/lib/neteasePlayback.test.ts`, `npx tsx src/lib/neteaseAudioProxy.test.ts`, `npx tsx src/lib/qqMusicLibrary.test.ts`, `npm run lint`, `npm run build` |
| Netease API, cookies, liked songs, playlists, daily recommendations | `vite.config.ts`, `local-server.mjs`, `server/netease-library.mjs`, `src/lib/neteaseCookie.ts` | `src/lib/neteaseCookie.test.ts`, `src/lib/neteasePlaylist.test.ts` | `npx tsx src/lib/neteaseCookie.test.ts`, `npx tsx src/lib/neteasePlaylist.test.ts`, `npm run build` |
| QQ Music API, cookies, search, personal playlists, lyrics, audio proxy | `server/qq-music.mjs`, `vite.config.ts`, `local-server.mjs`, `src/lib/qqCookie.ts` | `src/lib/qqCookie.test.ts`, `src/lib/qqMusicLibrary.test.ts` | `npx tsx src/lib/qqCookie.test.ts`, `npx tsx src/lib/qqMusicLibrary.test.ts`, `npm run build` |
| Update checks, prompt, release notes, mirrored installer download | `server/update-service.mjs`, `src/lib/updateSource.ts`, `src/lib/updatePrompt.ts`, `src/components/UI/UI.tsx`, `desktop/main.js`, `package.json` | `src/lib/updateSource.test.ts`, `src/lib/updatePrompt.test.ts`, `server/update-service.test.mjs` | `npx tsx src/lib/updateSource.test.ts`, `npx tsx src/lib/updatePrompt.test.ts`, `npx tsx server/update-service.test.mjs`, `npm run build:electron:dir` |
| Preset import/export | `src/lib/presetTransfer.ts`, `src/components/UI/UI.tsx` | `src/lib/presetTransfer.test.ts` | `npx tsx src/lib/presetTransfer.test.ts`, `npm run lint` |
| Theme colors, backdrop lock, and shader palette | `src/lib/themes.ts`, `src/lib/displaySettings.ts`, `src/App.tsx`, `src/components/UI/UI.tsx`, `src/components/AudioVisualizer/MapScene.tsx`, `src/components/AudioVisualizer/CustomShaderMaterial.ts` | `src/lib/themes.test.ts`, `src/lib/displaySettings.test.ts`, `src/lib/themeShader.test.ts`, `src/lib/presetTransfer.test.ts` | `npx tsx src/lib/themes.test.ts`, `npx tsx src/lib/displaySettings.test.ts`, `npx tsx src/lib/themeShader.test.ts`, `npm run build`, manual custom theme color check |
| Local audio input sources | `src/lib/AudioEngine.ts`, `src/lib/audioInput.ts`, `src/components/UI/UI.tsx`, `desktop/main.js`, `desktop/preload.cjs`, `src/desktop.d.ts` | `src/lib/audioInput.test.ts`, `src/lib/audioFrameCache.test.ts` | `npx tsx src/lib/audioInput.test.ts`, `npx tsx src/lib/audioFrameCache.test.ts`, `npm run lint`, `npm run build:electron:dir`, manual Windows system-audio and microphone check |
| Audio analysis, realtime kick detector, audio debugger, ground effects mixer, terrain density, platter rotation, floating blocks, 3D terrain, factory camera, and 3D lyrics | `src/lib/AudioEngine.ts`, `src/lib/beatDetector.ts`, `src/lib/kickEnvelope.ts`, `src/components/AudioDebugger/AudioDebugger.tsx`, `src/lib/groundEqSettings.ts`, `src/lib/sceneDefaults.ts`, `src/lib/lyricsSettings.ts`, `src/lib/lyricLineWrapping.ts`, `src/lib/terrainResponse.ts`, `src/components/AudioVisualizer/MapScene.tsx`, `src/components/AudioVisualizer/SpatialLyrics3D.tsx`, `src/components/AudioVisualizer/CustomShaderMaterial.ts` | `src/lib/audioFrameCache.test.ts`, `src/lib/beatDetector.test.ts`, `src/lib/kickEnvelope.test.ts`, `src/lib/groundEqSettings.test.ts`, `src/lib/sceneDefaults.test.ts`, `src/lib/lyricsSettings.test.ts`, `src/lib/lyricLineWrapping.test.ts`, `src/lib/terrainResponse.test.ts`, `src/lib/presetTransfer.test.ts`, `src/lib/scenePlatterRotation.test.ts`, `src/lib/spatialLyricsScene.test.ts` | `npx tsx src/lib/audioFrameCache.test.ts`, `npx tsx src/lib/beatDetector.test.ts`, `npx tsx src/lib/kickEnvelope.test.ts`, `npx tsx src/lib/groundEqSettings.test.ts`, `npx tsx src/lib/sceneDefaults.test.ts`, `npx tsx src/lib/lyricsSettings.test.ts`, `npx tsx src/lib/lyricLineWrapping.test.ts`, `npx tsx src/lib/terrainResponse.test.ts`, `npx tsx src/lib/presetTransfer.test.ts`, `npx tsx src/lib/scenePlatterRotation.test.ts`, `npx tsx src/lib/spatialLyricsScene.test.ts`, `npm run lint`, `npm run build`, manual Debugger playback in Electron/browser |

## End-To-End Flow

```text
Electron window loads successfully
-> desktop/main.js calls analytics.init()
-> desktop/analytics.js persists a random installation ID under app userData
-> app_open is sent once, app_heartbeat every 60 seconds
-> before-quit sends a best-effort app_close with duration_seconds
-> Alibaba Cloud SLS sonic-analysis/sonic-event stores the fixed field whitelist for 90 days
```

```text
npm run dev:electron
-> scripts/dev-electron.mjs starts Vite
-> Electron loads http://127.0.0.1:3000
-> React/CSS hot reload; main/preload/server changes need Electron restart
```

```text
Netease playlist loading
UI cloud panel
-> /api/netease/playlists
-> /api/netease/playlist?id=<id>&limit=all
-> vite.config.ts in dev or local-server.mjs in packaged mode
-> getPlaylistPlayableSongs()
-> playlist detail may expose only a partial playlist.tracks array
-> server/netease-library.mjs reads playlist.trackIds as the source of truth
-> fetchNeteaseSongDetails() batches /api/song/detail for the full track list
-> UI shows "loaded X / total Y songs"
```

```text
QQ login and library
Settings -> Account -> QQ Music -> official y.qq.com QR login window
-> desktop/main.js reads QQ cookies
-> UI stores cookie and syncs PUT /api/qq/login/cookie
-> /api/qq/user/playlists
-> /api/qq/playlist/tracks?id=<id>&limit=all
-> server/qq-music.mjs maps songs to the shared NeteaseSong shape with provider: 'qq'
```

```text
Search and playback
Search panel chooses effectiveSearchProvider
-> Netease: /api/netease/search
-> QQ: /api/qq/search
-> UI.loadNeteaseSong(song, queue)
-> read playback quality from src/lib/playbackQuality.ts localStorage settings
-> Netease: /api/netease/url?br=<bitrate> + /api/netease/lyric + /api/netease/audio?br=<bitrate>
-> QQ: /api/qq/song/url?quality=<quality> + /api/qq/lyric + /api/qq/audio?quality=<quality>
-> AudioEngine.loadUrl()
-> UI stores current lyrics text and passes it to App
-> UI displaySettings.showLyrics passes lyric visibility to App
-> MapScene reads AudioEngine.getAudioData()
-> visualPlatter group auto-rotates terrain/effects while OrbitControls keeps manual camera orbit available
-> SpatialLyrics3D renders spatial-wall lyrics outside visualPlatter so it behaves like a fixed far screen
```

```text
Last-played cloud restore on startup
-> UI reads sonic_topography_last_played through readLastPlayedStorage()
-> restores current song, queue, cover, and player title without autoplay
-> preloads /api/netease/audio or /api/qq/audio through AudioEngine.loadUrl()
-> fetches /api/netease/lyric or /api/qq/lyric for the same restored song
-> setLyricsText() drives App.currentLyricsText and MapScene/SpatialLyrics3D
```

```text
App update flow
-> UI startup waits briefly and calls /api/update/latest
-> server/update-service.mjs reads package.json version and GitHub update config
-> GitHub latest Release provides tag/version, release notes, and setup .exe asset
-> UI shows update prompt unless the same latestVersion was skipped
-> user clicks update
-> /api/update/download creates a job with GitHub direct URL plus configured mirrors
-> server streams the selected channel to disk and updates job.received per chunk
-> /api/update/download/status drives UI progress
-> desktop/main.js opens the downloaded installer through window.sonicDesktop.openUpdateInstaller()
```

## Code Map

### Anonymous Usage Analytics

`desktop/analytics.js`

Owns the fixed SLS endpoint, anonymous installation/session IDs, event whitelist, heartbeat timer, and best-effort normal-close event. It must remain isolated from renderer IPC, music/account state, Cookies, filenames, paths, error text, and all other free-form data. Public-IP recording must remain disabled in the SLS Logstore. `app_close` can be absent after crashes or forced termination; use the last heartbeat as the session fallback in analysis.

`desktop/analytics.test.mjs`

Verifies the exact transmitted field whitelist, one-minute heartbeat, duration calculation, single close event, and local anonymous-ID persistence.

### App Updates

`server/update-service.mjs`

Owns GitHub latest Release checks, installer asset selection, download job state, mirrored download URL generation, streaming download progress, and fallback across channels. Keep downloads streaming; using `response.arrayBuffer()` makes the UI stay at 0 until the full installer finishes. Public mirrors are third-party and unstable, so direct GitHub must remain first and mirror failures must fall through to the next candidate.

`src/components/UI/UI.tsx`

Owns automatic startup update checks, manual check behavior, update prompt display, Release notes rendering, skip-this-version behavior, and download polling. Manual checks should show the prompt even for a skipped version; automatic checks should respect `sonic-topography-skipped-update-version-v1`.

`src/lib/updatePrompt.ts`

Stores the skipped update version and decides whether the current latest version should prompt. It must store only the skipped version string, not personal data or Release content.

### React Player UI

`src/components/UI/UI.tsx`

Main interaction surface. Owns sidebar, search, cloud music panel, account login settings, update checks, playback queue, album-cover rendering, and cloud playback dispatch. The player card polls audio time at a low fixed interval rather than every animation frame to avoid repainting the whole UI at 60fps. The custom theme `showPlayerPanel` flag controls whether the right player card is visible; the card can render an empty state before a track is loaded. The cloud panel expects provider-aware song identities such as `netease:<id>` and `qq:<id>`. Netease keeps daily recommendations; QQ only has liked songs and playlists.

`src/lib/playbackQuality.ts`

Stores global cloud playback quality settings. Defaults preserve the old behavior: QQ `exhigh` / 320k MP3 and Netease `320000`. `UI.loadNeteaseSong()` and last-played preload must use `buildQQPlaybackUrl()` / `buildNeteasePlaybackUrl()` so `/api/qq/*` receives `quality` and `/api/netease/*` receives `br`.

`src/lib/i18n.ts`

Small client-side language store for zh/en UI switching. It reads/writes `app_language` in localStorage, notifies React subscribers through `useLanguage()`, and resolves translation keys through `t()`.

`src/lib/locales.ts`

Bulk UI copy dictionary used by `i18n.ts`. When adding new UI text in `UI.tsx`, add both zh and en strings here and verify the language toggle in a real Electron/browser session.

`src/types.ts`

Shared client types. `NeteaseSong` is the common cloud-song shape used by the player UI, saved playlists, and last-played storage; keep this type here instead of redefining it inside UI components.

### Netease Cloud Music

`server/netease-library.mjs`

Shared Netease playlist helpers used by both dev and packaged servers. Important helpers:

- `normalizeNeteasePlaylistLimit()`
- `collectNeteasePlaylistTrackIds()`
- `mergeNeteasePlaylistTrackDetails()`
- `mapNeteaseSong()`

When a playlist says it has 70 songs but only 20 display, check this module first. Netease often returns only part of the playlist in `playlist.tracks`; `playlist.trackIds` is the complete ordered ID list. `mapNeteaseSong()` also maps album artwork into the shared `cover` field used by song rows and the player panel.

`vite.config.ts`

Vite dev server API. Registers `/api/playlists`, `/api/netease/*`, `/api/qq/*`, and update APIs. Netease playlist behavior must stay in sync with `local-server.mjs`.

`local-server.mjs`

Packaged Electron local Express server. Mirrors the dev server API behavior. If a Netease API fix is made in `vite.config.ts`, apply the same production fix here.

`server/netease-playback.mjs`

Shared Netease playback URL helper for dev and packaged servers. Normalizes `br` to `320000`, `192000`, or `128000`; builds the upstream `/api/song/enhance/player/url` request; and includes bitrate in the playable URL cache key. If changing available Netease qualities, update `src/lib/playbackQuality.ts`, `src/lib/neteasePlayback.test.ts`, `vite.config.ts`, and `local-server.mjs` together.

`server/netease-audio-proxy.mjs`

Shared Netease audio stream proxy used by both Vite dev middleware and packaged `local-server.mjs`. It forwards range/status/content headers, defaults content type to `audio/mpeg`, and cancels the upstream Web Stream reader when the browser closes the local request, the user switches tracks, or the upstream reader throws. Keep this shared helper in place; duplicating stream pump logic between dev and packaged mode can reintroduce Electron main-process crashes from unhandled `undici` stream errors.

`src/lib/neteaseCookie.ts`

Netease cookie parsing, storage, and request header helpers.

### QQ Music

`server/qq-music.mjs`

Shared QQ Music service module for Vite middleware and Express production routes. Handles cookies, login status, search, personal playlists, playlist tracks, playback URLs, lyrics, and audio proxying.

Key endpoints:

- `GET /api/qq/user/playlists`
- `GET /api/qq/playlist/tracks?id=<id>&limit=all`
- `GET /api/qq/search?keywords=<keywords>&limit=30`
- `GET /api/qq/song/url?mid=<mid>&mediaMid=<mediaMid>&quality=<quality>`
- `GET /api/qq/audio?mid=<mid>&mediaMid=<mediaMid>&quality=<quality>`

QQ playback defaults to `exhigh` / 320k MP3. Do not default to Hi-Res FLAC; QQ can return a seemingly playable FLAC purl that later 404s during real audio streaming.

### Audio And Scene

`src/lib/AudioEngine.ts`

Web Audio playback and frequency analysis. Splits audio into sub-bass, bass, low-mid, mid, high-mid, presence, brilliance, and air bands. `getAudioData()` caches one analysis snapshot per animation frame so multiple readers do not repeat analyser scans or advance trigger state twice in the same frame. It also calls `beatDetector.ts` once per FFT frame and exposes `kickLevel`, `kickFlux`, `kickThreshold`, `kickOnset`, `kickEnvelope`, `kickConfidence`, and active kick-window fields for beat-led terrain motion and the Debugger. `getBeatDetectorSettings()` / `setBeatDetectorSettings()` expose the realtime detector sensitivity setting and persist it through `beatDetector.ts` storage helpers.

`src/lib/beatDetector.ts`

Low-cost realtime kick detector. Reuses the existing FFT bins, scores fixed candidate kick windows (`Deep`, `Classic`, `Punch`, `Wide`), detects spectral-flux local peaks against an adaptive threshold, applies cooldown, and returns Debugger-friendly values plus a visual `kickEnvelope`. It owns `BeatDetectorSettings` normalization, threshold parameter mapping, and localStorage persistence under `sonic-topography-beat-detector-v1`; first-launch sensitivity defaults to `100` / Sensitive, `50` preserves the earlier midpoint tuning, lower values make detection stricter, and higher values make weak kicks easier to trigger. Update `src/lib/beatDetector.test.ts` for settings clamps/storage fallback, silence, sustained bass, transient kicks, cooldown, candidate-window selection, beat lamp, and timeline behavior.

`src/lib/kickEnvelope.ts`

Realtime kick-channel helper. Converts the currently tracked kick-bin loudness plus Auto Beat onset events into a low-cost visual envelope: onset produces a fast lift, sustained bass contributes only a small breathing floor, and the envelope releases over a short musical decay. Update `src/lib/kickEnvelope.test.ts` when changing noise-floor, onset, or release behavior.

`src/components/AudioDebugger/AudioDebugger.tsx`

Audio debugging overlay. Shows the FFT spectrum and band levels, then a Kick Monitor with active detector window, confidence, Level / Flux / Threshold / Envelope meters, a Strict/Sensitive detector sensitivity slider, a high-contrast BEAT lamp, and a recent beat timeline. Use this panel to verify the detector directly before judging terrain response: drag toward Sensitive for weak kicks, toward Strict when sustained bass causes false positives, and confirm the value survives closing/reopening through localStorage.

`src/lib/metadata.ts`

Local audio metadata reader for uploaded files and demo audio. It dynamically imports `music-metadata-browser` only when local metadata is requested; cloud music cover art comes from Netease/QQ API song data instead.

`src/lib/audioInput.ts`

Local input-source helper for microphone device enumeration. `normalizeAudioInputDevices()` filters `audioinput` devices and provides stable fallback labels before permission reveals real names. `UI.tsx` listens to `navigator.mediaDevices.devicechange` so newly plugged microphones, USB interfaces, Bluetooth headsets, and virtual inputs appear after the OS exposes them.

`desktop/main.js`

Electron system-audio capture setup. `configureSystemAudioCapture()` uses `session.defaultSession.setDisplayMediaRequestHandler()` and Windows `audio: 'loopback'` so the renderer can request a system-audio `MediaStream` through `getDisplayMedia()`. Keep the UI meaning as "System Audio"; the hidden video/display capture detail is only an Electron implementation requirement.

`src/components/AudioVisualizer/MapScene.tsx`

Three.js scene. Reads `AudioEngine.getAudioData()`, applies ground EQ settings, and passes uniforms to the terrain shader. It owns a `visualPlatter` group that auto-rotates the terrain, floating kick blocks, meteors, and particles together; do not re-enable `OrbitControls` auto-rotation unless intentionally returning to camera rotation. Keep `OrbitControls` manual rotation enabled so user drag controls camera orbit/pitch, keep platter rotation outside shader-material guards, use the theme/custom-theme rotation speed directly as platter radians-per-second, and convert terrain click points from world space to platter-local coordinates before adding ripples. Fixed far-screen layers such as album-cover backdrop and spatial lyrics must stay outside `visualPlatter`.

`src/components/AudioVisualizer/SpatialLyrics3D.tsx`

3D curved lyric screen used by the `spatial-wall` lyric style. It parses LRC text with `parseLRC()`, tracks time via `engine.audioElement.currentTime`, pulses from `engine.getAudioData()`, draws lyric lines into paired inactive/active canvas textures, and positions the curved mesh as a fixed far-screen layer. If lyrics do not appear, verify the UI lyric text reaches `App.currentLyricsText`, `MapScene.lyricsText` is non-empty, `UI displaySettings.showLyrics` reaches `App.lyricsVisible -> MapScene.lyricsVisible -> SpatialLyrics3D.visible`, and the mesh position projects into the current camera viewport. Keep first-line timing consistent with `LyricsDisplay`: `activeIndex` should stay `-1` until playback reaches the first parsed LRC timestamp minus the shared anticipation window. Keep color semantics consistent with DOM lyrics: canvas text should use `fontColor`, `karaokeColor`, and `glowColor` / theme accent directly, with no extra shader tint over the text, and the lyric shader should stay `toneMapped={false}` so glow colors are not muted by renderer tone mapping. Per-theme `maxCharsPerLine` comes from `lyricsSettings.ts` and is applied through `lyricLineWrapping.ts`; changing it should affect songyancai, dynamic-bounce, and spatial-wall. For `spatial-wall`, do not reintroduce a high fixed canvas font floor or a fixed `ACTIVE_TEXT_MAX_WIDTH`: `activeFontSize` must clamp through the 3D min/max range so the settings slider visibly changes size, and `maxCharsPerLine` must derive the target canvas text width and curved-screen radius. Keep the 2048 canvas texture with a safe text width cap; extreme long lines should wrap at the safe width instead of being clipped or forcing a 4096 texture. Canvas safe-width wrapping must call the measured helper in `lyricLineWrapping.ts` so English words move as whole words; only a single overwide token should fall back to character splitting. Multi-line karaoke uses shader `uLineBounds`; keep each line's Y bounds inside half the line step so one line's active color cannot cover the next wrapped line. Hide/show should fade `uOpacity`; after fade-out, set `mesh.visible=false` rather than unmounting the component so textures and lyric timing are preserved without ongoing draw cost. The 3D-only `spatialOrbitOffset` setting moves the lyric wall around the board center by preserving the default radius and applying a horizontal angle offset; `0` must keep the legacy position.

`src/lib/lyricsSettings.ts`

Stores per-style lyric settings. Each style owns its own font sizes, colors, position/trigger settings, font family, and `maxCharsPerLine`. First-launch defaults are captured from the tuned Electron profile: `spatial-wall` style, custom per-style font sizes/colors, and a spatial wall orbit offset of `-38`. Normalize old flat settings and nested settings through `normalizeLyricsSettings()` so imported presets and existing localStorage receive defaults and clamps.

`src/lib/sceneDefaults.ts`

Factory defaults for global scene rotation and camera state. `App` reads `DEFAULT_CAMERA_POSITION` for the initial React Three Fiber camera and `readGlobalSceneSettingsStorage()` for platter speed. `MapScene` reads `DEFAULT_CAMERA_STATE` when no saved `sonic_camera_state` exists and reset-camera removes the saved key so the next launch also returns to the factory view.

`src/lib/lyricLineWrapping.ts`

Shared text wrapping helper for DOM lyrics and 3D canvas lyrics. It wraps CJK text by character, keeps English words together when possible, chunks overlong words, and clamps line-capacity settings through the constants in `lyricsSettings.ts`. It also exposes measured-width wrapping for the 3D canvas safe-width pass; keep that word-aware so English words are not split into isolated fragments such as `t` / `he`.

`src/components/AudioVisualizer/CustomShaderMaterial.ts`

Terrain shader. Low frequencies change elevation; high frequencies mostly affect glow, sparks, and shimmer. The instanced terrain vertex transform must include `modelMatrix * instanceMatrix` so parent groups such as `visualPlatter` can rotate the ground; using only `instanceMatrix` makes the terrain ignore group transforms and causes click ripple coordinates to drift from the visible ground.

`src/lib/groundEqSettings.ts`

Ground effects mixer storage, normalization, legacy curve migration, per-band sensitivity scaling, terrain density, floating kick blocks, and the global ground motion speed value. First-launch defaults are captured from the tuned Electron profile: bands `[90, 92, 50, 50, 50, 50, 50, 48]`, terrain density `46`, floating intensity `55`, min size `9`, max size `26`, and speed `77`. The first two defaults are intentionally high because they scale beat-led center lift and low-frequency weight on top of a smaller raw low-frequency base layer. The model is 8 independent band values plus `motionSpeed`, `amplitude`, `terrainDensity`, `floatingBlocksEnabled`, `floatingBlockIntensity`, `floatingBlockMinSize`, `floatingBlockMaxSize`, and `floatingBlockSpeed`, not a 16-point curve. `deriveTerrainGridSettings()` maps density `0..100` to the instanced terrain grid: about `96 x 96`, `160 x 160`, or `224 x 224` blocks while keeping the world footprint stable. The UI exposes the bands as mixer faders for sub-bass, bass, low-mid, mid, high-mid, presence, brilliance, and air, with separate option tabs for ground EQ and floating block controls.

`src/lib/terrainResponse.ts`

Terrain response safety helpers used by `MapScene`. Clamps frame-delta animation blends, kick deformation impulses, and the final low-frequency shader uniforms so transient kick events or delayed frames cannot make the terrain jump violently for a few frames. The first two ground EQ controls, `subBass` / center lift and `bass` / low-frequency weight, intentionally mix a small base layer from `AudioEngine.getAudioData().subBass` / `bass` with a stronger `kickEnvelope` beat layer; use `deriveKickFollowLowBands()` when changing that path so slider scaling, enable switches, beat-response gain, raw-bass base gain, and shader clamps stay together.

### Theme Colors

`src/lib/themes.ts`

Normalizes built-in and custom theme colors. First launch defaults to `Minimal Monochrome` through `DEFAULT_THEME_ID`, while the default custom preset mirrors the tuned Electron profile (`#ffffff`, `#98d2bf`, `#ff0000`, `#95abb1`) and remains available as `custom-default`. Custom `background` maps to terrain dark colors (`uBaseColor1` / `uBaseColor2`), `fog` is a compatibility field whose product meaning is the rear canvas backdrop color (`uFogColor`), `cool` maps to `uCoolCore`, `warm` maps to `uWarmCore`, and `accent` maps to `uRippleColor`. Legacy custom themes without `fog` default to `fog = background` and `fogLinkedToBackground = true`.

`src/App.tsx`

Uses `uFogColor` as the app/canvas backdrop color so transparent far-distance terrain reveals the selected rear background.

`src/components/UI/UI.tsx`

Custom theme editor. The ground/backdrop color row has a lock control: when `fogLinkedToBackground` is true, changing terrain dark color immediately syncs the rear backdrop and disables the backdrop picker; when false, the rear backdrop is edited independently. Editing a custom theme immediately activates `CUSTOM_THEME_ID`, so controls such as rotation speed affect the current scene instead of only saving a preset for later.

`src/components/AudioVisualizer/MapScene.tsx`

Feeds theme colors into Three.js fog and terrain shader uniforms each frame. Three.js fog should stay close to `uBaseColor1` for natural terrain-edge fade; do not use the rear backdrop color for the real fog layer.

`src/components/AudioVisualizer/CustomShaderMaterial.ts`

Shader palette source. Do not hard-code cyan/blue brightness washes; bright high-frequency glow should derive from `uCoolCore` so the custom cool color is visible. Far-distance transparent fade can blend toward `uFogColor` before alpha fade, but edge fog/aerial perspective should stay based on terrain base colors.

### Electron Desktop Shell

`desktop/main.js`

Electron main process. Handles frameless transparent rounded window, window IPC, dev/production loading, production local server, official Netease/QQ QR login windows, cookie extraction, and update installer opening. Startup app switches request Chromium GPU acceleration and prefer the high-performance GPU (`force_high_performance_gpu`), but Windows graphics settings and the driver can still override the final adapter choice.

`desktop/preload.cjs`

Exposes `window.sonicDesktop` through `contextBridge` and adds desktop CSS classes.

`scripts/dev-electron.mjs`

Starts Vite and Electron for development.

`package.json`

Electron Builder and NSIS installer configuration. The Windows installer is not one-click, allows users to choose the installation directory, and creates desktop/start-menu shortcuts. Packaged mode uses the app version and GitHub update source from this file, so release builds must bump `version` and configure `sonicTopography.update.owner/repo`.

On this Windows workspace, Electron Builder can fail with `EPERM` while renaming `win-unpacked.tmp` after extracting Electron. The build config uses `electronDist: node_modules/electron/dist` to reuse the installed Electron runtime and skip that fragile extraction/rename step. Windows icon assets live in `build/icon.ico` and are wired into the executable and NSIS installer/uninstaller.

## Test Index

| Test file | Covers |
| --- | --- |
| `src/lib/neteasePlaylist.test.ts` | Netease playlist `trackIds` completeness, track detail merging, playlist limit parsing |
| `src/lib/playbackQuality.test.ts` | Playback quality defaults, normalization, localStorage persistence, QQ/Netease playback URL parameters |
| `src/lib/neteasePlayback.test.ts` | Netease playback bitrate normalization, upstream player URL construction, playable URL cache key bitrate separation |
| `src/lib/neteaseAudioProxy.test.ts` | Netease audio proxy streaming headers, normal chunk completion, client-close reader cancellation, and reader-error response ending |
| `src/lib/audioInput.test.ts` | Local audio input device normalization and AudioEngine media-stream source switching/track cleanup |
| `src/lib/audioFrameCache.test.ts` | AudioEngine single-frame analysis cache, analyser read deduplication, and default detector fields |
| `src/lib/beatDetector.test.ts` | Realtime kick detector behavior: silence, sustained bass, transient kicks, cooldown, active window selection, beat lamp, and beat timeline |
| `src/lib/kickEnvelope.test.ts` | Realtime kick envelope behavior: silence, sustained-bass breathing, onset lift, and release |
| `src/lib/terrainResponse.test.ts` | Terrain response clamps for delayed-frame interpolation, kick impulse bounds, and low-frequency shader uniform limits |
| `src/lib/themes.test.ts` | Custom theme normalization, legacy rear-backdrop defaults, and independent backdrop color mapping |
| `src/lib/displaySettings.test.ts` | First-launch display setting defaults such as icon/player visibility and clock color |
| `src/lib/themeShader.test.ts` | Shader brightness color derives from custom cool color and far-distance backdrop blend derives from `uFogColor` |
| `src/lib/scenePlatterRotation.test.ts` | Platter rotation wiring: OrbitControls does not auto-rotate but manual camera rotation stays enabled, visual group auto-rotates from direct theme speed without waiting for shader material, terrain shader uses `modelMatrix`, custom theme edits activate custom scene speed, click ripples use platter-local coordinates |
| `src/lib/sceneDefaults.test.ts` | Factory global scene rotation and camera defaults, plus App/MapScene wiring |
| `src/lib/spatialLyricsScene.test.ts` | 3D lyrics wiring: UI lyrics text reaches App/MapScene, spatial lyrics and cover stay outside the rotating platter, SpatialLyrics3D parses LRC into canvas textures, and spatial-wall capacity/font-size settings drive 3D text width without a fixed 1320px cap |
| `src/lib/lyricsSettings.test.ts` | Lyric setting defaults, legacy migration, and `maxCharsPerLine` clamps for all lyric styles |
| `src/lib/lyricLineWrapping.test.ts` | Shared CJK/English lyric line wrapping behavior for the per-style line-capacity slider |
| `src/lib/groundEqSettings.test.ts` | 8-band ground effects defaults, motion speed defaults/clamping, legacy curve migration, terrain density, floating block settings, per-band scaling |
| `src/lib/neteaseCookie.test.ts` | Netease cookie cleaning, storage, request headers |
| `src/lib/qqCookie.test.ts` | QQ cookie cleaning, login state, storage, request headers |
| `src/lib/qqMusicLibrary.test.ts` | QQ playlist detection, playlist filtering, song mapping, track limit parsing, quality candidates |
| `src/lib/updateSource.test.ts` | Update source normalization |
| `src/lib/updatePrompt.test.ts` | Skipped update version storage and prompt suppression behavior |
| `server/update-service.test.mjs` | GitHub Release download mirror candidates, streaming progress, channel fallback, and all-channel failure |
| `src/lib/triggerSettings.test.ts` | Pulse/meteor trigger settings import/export |
| `src/lib/presetTransfer.test.ts` | Preset package normalization, cookie exclusion, playlist migration |

## Common Change Recipes

### Fix Netease Playlist Counts

1. Reproduce against `/api/netease/playlist?id=<id>&limit=all`.
2. Check whether upstream `playlist.tracks.length` is smaller than `playlist.trackCount`.
3. If so, use `playlist.trackIds` and batch `/api/song/detail`; do not rely on `playlist.tracks`.
4. Do not pre-filter playlist lists by playable URL. The list should show the playlist contents; playback failure is handled when the user plays a song.
5. Update `server/netease-library.mjs` and `src/lib/neteasePlaylist.test.ts`.
6. Keep `vite.config.ts` and `local-server.mjs` behavior identical.
7. Run `npx tsx src/lib/neteasePlaylist.test.ts`, `npm run lint`, and `npm run build`.

### Change QQ Personal Library

1. Modify `server/qq-music.mjs`.
2. Update `src/lib/qqMusicLibrary.test.ts`.
3. Update `src/components/UI/UI.tsx` if the panel or search provider changes.
4. Run `npx tsx src/lib/qqMusicLibrary.test.ts`, `npx tsx src/lib/qqCookie.test.ts`, `npm run lint`, and `npm run build`.

### Change Playback Quality

1. Update `src/lib/playbackQuality.ts` for available UI options, defaults, storage, and URL builders.
2. For QQ quality behavior, update `server/qq-music.mjs` and `src/lib/qqMusicLibrary.test.ts`.
3. For Netease bitrate behavior, update `server/netease-playback.mjs`, `server/netease-audio-proxy.mjs` if stream behavior changes, `vite.config.ts`, and `local-server.mjs`; keep the cache key separated by bitrate and keep dev/packaged audio proxy behavior shared.
4. Update `src/components/UI/UI.tsx` if the settings panel or playback dispatch changes.
5. Run `npx tsx src/lib/playbackQuality.test.ts`, `npx tsx src/lib/neteasePlayback.test.ts`, `npx tsx src/lib/neteaseAudioProxy.test.ts`, `npx tsx src/lib/qqMusicLibrary.test.ts`, `npm run lint`, and `npm run build`.
6. For real acceptance, switch QQ and Netease quality settings, replay the same cloud song, and verify the request URL includes the selected `quality` or `br`.

### Change Language Switching

1. Add or adjust translation keys in `src/lib/locales.ts`.
2. Use `t(key, lang)` from `src/lib/i18n.ts` in `src/components/UI/UI.tsx`.
3. Keep both zh and en values present for every new key; missing keys render the key string.
4. Run `npm run lint` and `npm run build`.
5. For real acceptance, toggle zh/en in Electron and scan the main player, settings, cloud account, update prompt, and playlist/search panels.

### Fix Netease Audio Proxy Crashes

1. Start at `server/netease-audio-proxy.mjs`; it must remain the shared stream pump for `vite.config.ts` and packaged `local-server.mjs`.
2. Check `/api/netease/audio` in both files only for request parsing, playable URL lookup, and header construction.
3. Run `npx tsx src/lib/neteaseAudioProxy.test.ts`, `npx tsx src/lib/neteasePlayback.test.ts`, `npm run lint`, `npm run build`, and `npm run build:electron:dir`.
4. For real acceptance, run the packaged directory build, play a Netease cloud song, rapidly switch tracks, pause/resume, close the window during playback, and test after network/proxy interruption. The app must not show an Electron "JavaScript error occurred in the main process" dialog.

### Change Account Login

1. Check `desktop/main.js` login windows and cookie polling.
2. Check `desktop/preload.cjs` IPC exposure.
3. Update account UI in `src/components/UI/UI.tsx`.
4. Update cookie helpers and tests as needed.
5. Verify with real QR login in Electron.

### Change App Updates

1. Update `server/update-service.mjs` for GitHub Release metadata, installer asset selection, mirror candidates, download streaming, fallback, or status payload changes.
2. Update `src/components/UI/UI.tsx` for startup checks, the update prompt, Release notes display, skip-version behavior, and download progress UI.
3. Update `src/lib/updatePrompt.ts` if skipped-version storage or prompt suppression semantics change.
4. Keep `package.json` `version` and `sonicTopography.update.downloadMirrors` aligned with the release you plan to ship.
5. Run `npx tsx src/lib/updateSource.test.ts`, `npx tsx src/lib/updatePrompt.test.ts`, `npx tsx server/update-service.test.mjs`, `npm run lint`, `npm run build`, and `npm run build:electron:dir`.
6. For real acceptance, publish or simulate a higher GitHub Release with a setup `.exe`, verify the startup prompt shows Release notes, verify "next time" and "skip this version", then trigger a download and confirm progress increments before completion. To test fallback, make the first channel fail and confirm a mirror channel is selected.

### Change Local Audio Inputs

1. Update `src/lib/AudioEngine.ts` when changing player-vs-stream source wiring. Media streams must connect to `AnalyserNode` only, not `audioCtx.destination`.
2. Update `src/lib/audioInput.ts` and `src/components/UI/UI.tsx` when changing microphone device listing, labels, or hot-plug behavior.
3. Update `desktop/main.js`, `desktop/preload.cjs`, and `src/desktop.d.ts` when changing Electron system-audio support or platform flags.
4. Run `npx tsx src/lib/audioInput.test.ts`, `npx tsx src/lib/audioFrameCache.test.ts`, `npm run lint`, `npm run build`, and `npm run build:electron:dir`.
5. For real acceptance on Windows, select System Audio while another app is playing sound, then select multiple microphone devices including a newly plugged device, and confirm terrain/debugger response without program audio monitoring or feedback.

### Change Ground Effects Mixer

1. Update `src/lib/groundEqSettings.ts` for data model changes, including `terrainDensity`, floating block settings, and `deriveTerrainGridSettings()` if terrain block count or sizing changes.
2. Update `src/components/UI/UI.tsx` for the mixer UI.
3. Update `src/components/AudioVisualizer/MapScene.tsx` for band-to-shader mapping or terrain instance sizing.
4. If the stored model changes, update preset import/export normalization in `src/lib/presetTransfer.ts` tests.
5. Keep exactly 8 controls unless `AudioEngine` and `CustomShaderMaterial` add more direct terrain inputs. The first two controls tune a mixed response: a smaller continuous low-frequency base from `subBass` / `bass` plus a stronger `kickEnvelope` beat layer from `beatDetector.ts`; the remaining six controls follow real-time frequency bands. Global `motionSpeed` controls terrain response smoothing only.
6. If changing frame smoothing, kick deformation, beat-response gain, or final shader uniform bounds, update `src/lib/terrainResponse.ts` and `src/lib/terrainResponse.test.ts`.
7. If changing density, verify low density uses larger/fewer blocks, high density uses smaller/more blocks, and the terrain footprint does not visibly shrink or expand.
8. If changing floating blocks, verify the option tab appears directly after Meteor, enabled blocks hover above the terrain, min/max size and speed controls change the kick scaling visibly, disabled blocks hide, and meteors/click ripples still work.
9. If changing beat-led motion, detector sensitivity, or envelope release speed, verify the Debugger BEAT lamp and timeline first, drag the Kick Monitor slider toward both Strict and Sensitive, then confirm terrain and floating blocks follow `kickEnvelope` with the intended decay.
10. Run `npx tsx src/lib/beatDetector.test.ts`, `npx tsx src/lib/kickEnvelope.test.ts`, `npx tsx src/lib/groundEqSettings.test.ts`, `npx tsx src/lib/terrainResponse.test.ts`, `npx tsx src/lib/presetTransfer.test.ts`, `npm run lint`, and `npm run build`.

### Change Scene Rotation

1. Update `src/components/AudioVisualizer/MapScene.tsx`.
2. If UI rotation controls change, check `src/components/UI/UI.tsx` and `src/App.tsx` so custom theme speed actually becomes `MapScene.rotationSpeed`.
3. Keep terrain, floating blocks, meteors, and particles inside the same `visualPlatter` group so they rotate together.
4. Keep `OrbitControls` manual rotation enabled and auto-rotation disabled; automatic rotation should update platter yaw, not camera position.
5. Use the theme/custom-theme rotation speed directly for platter yaw; `0` means stopped.
6. Keep terrain shader vertex transforms on `modelMatrix * instanceMatrix`; otherwise group rotation will not affect the ground.
7. Keep platter rotation before material/shader early returns so the board can rotate even while shader refs initialize.
8. If pointer interaction changes, keep ripple coordinates in platter-local space.
9. Run `npx tsx src/lib/scenePlatterRotation.test.ts`, `npx tsx src/lib/groundEqSettings.test.ts`, `npx tsx src/lib/terrainResponse.test.ts`, `npm run lint`, and `npm run build`.
10. In Electron, verify custom theme rotation speed changes platter speed immediately, automatic platter rotation, manual camera orbit/pitch with horizontal and vertical drag, correct ripple locations, and no obvious frame-rate drop.

### Change 3D Lyrics

1. Update `src/lib/lyricsSettings.ts` if adding or changing lyric style data.
2. Update shared wrapping in `src/lib/lyricLineWrapping.ts` if changing per-line capacity behavior.
3. Update settings UI in `src/components/UI/UI.tsx`.
4. Keep current lyric text flowing from `UI` to `App` to `MapScene`; do not read lyrics from `currentSong` unless that model explicitly stores lyrics.
5. For last-played cloud restore, keep the silent audio preload and lyric fetch together in `src/components/UI/UI.tsx`; restoring title/cover without `setLyricsText()` leaves `App.currentLyricsText` empty after restart.
6. Keep `SpatialLyrics3D` outside `visualPlatter` in `MapScene` so the terrain rotates but the lyric wall behaves like a fixed far screen.
7. Verify LRC parsing with `parseLRC()`, canvas texture creation in `SpatialLyrics3D`, first-line timing before the first timestamp, the lyric visibility toggle path for all styles, per-line capacity and font-size response in all three styles, spatial-wall width changes at capacities such as 16/24/32/48, spatial-wall orbit offsets at -180/0/180 degrees, restart/restore of the last cloud song with lyrics present, and a real browser/Electron playback path with the changed style selected.
8. Run `npx tsx src/lib/lyricsSettings.test.ts`, `npx tsx src/lib/lyricLineWrapping.test.ts`, `npx tsx src/lib/spatialLyricsScene.test.ts`, `npx tsx src/lib/scenePlatterRotation.test.ts`, `npm run lint`, and `npm run build`.

## Local Verification Commands

```powershell
npx tsx src/lib/neteasePlaylist.test.ts
npx tsx src/lib/playbackQuality.test.ts
npx tsx src/lib/neteasePlayback.test.ts
npx tsx src/lib/neteaseAudioProxy.test.ts
npx tsx src/lib/audioInput.test.ts
npx tsx src/lib/audioFrameCache.test.ts
npx tsx src/lib/beatDetector.test.ts
npx tsx src/lib/terrainResponse.test.ts
npx tsx src/lib/kickEnvelope.test.ts
npx tsx src/lib/themes.test.ts
npx tsx src/lib/displaySettings.test.ts
npx tsx src/lib/themeShader.test.ts
npx tsx src/lib/lyricsSettings.test.ts
npx tsx src/lib/lyricLineWrapping.test.ts
npx tsx src/lib/scenePlatterRotation.test.ts
npx tsx src/lib/sceneDefaults.test.ts
npx tsx src/lib/spatialLyricsScene.test.ts
npx tsx src/lib/groundEqSettings.test.ts
npx tsx src/lib/neteaseCookie.test.ts
npx tsx src/lib/qqCookie.test.ts
npx tsx src/lib/qqMusicLibrary.test.ts
npx tsx src/lib/updateSource.test.ts
npx tsx src/lib/updatePrompt.test.ts
npx tsx server/update-service.test.mjs
npx tsx src/lib/triggerSettings.test.ts
npx tsx src/lib/presetTransfer.test.ts
npm run lint
npm run build
npm run dev:electron
npm run build:electron:dir
```

## Search Shortcuts

```powershell
rg -n "collectNeteasePlaylistTrackIds|fetchNeteaseSongDetails|getPlaylistPlayableSongs|trackIds" server vite.config.ts local-server.mjs src
rg -n "groundEqSettings|applyGroundEqBandValue|terrainResponse|GroundEqPanel|uSubBass|uAir" src
rg -n "visualPlatterRef|platterRotationRef|scenePlatterRotation|enableRotate" src
rg -n "spatial-wall|SpatialLyrics3D|currentLyricsText|parseLRC|maxCharsPerLine|wrapLyricTextLines" src
rg -n "uCoolCore|uWarmCore|uRippleColor|uFogColor|fogLinkedToBackground|brightCool|createCustomThemeColors" src
rg -n "effectiveSearchProvider|searchNetease|loadNeteaseSong|songIdentity|/api/netease|/api/qq" src vite.config.ts local-server.mjs server
rg -n "useLanguage|setLanguage|t\\(|app_language|locales" src
rg -n "playbackQuality|quality=|br=|neteasePlayableUrlCacheKey|buildNeteasePlayerUrl" src server vite.config.ts local-server.mjs
rg -n "handleQQUserPlaylists|handleQQPlaylistTracks|normalizeQQPlaylistTrackLimit|mapQQPlaylist" server src
rg -n "sonicDesktop|openNeteaseLogin|openQQLogin|Cookie" desktop src server
rg -n "wallpaper|capture|build:go|build:wallpaper|sonicserver|cmd/sonic-topography" .
```

## Known Runtime Notes

- Electron is the only formal packaging direction. Go single EXE, Wallpaper Engine, and system-audio capture are not product routes.
- Windows installer output is produced by `npm run build:electron` under `release/`. Publish that setup `.exe` as a GitHub Release asset; pushing code alone does not publish an app update.
- Update downloads try GitHub direct first, then configured public mirrors from `package.json`. Mirrors are third-party and may fail or throttle; the app should fall back across channels and report a clear failure if all channels fail.
- Do not bulk delete files or directories. If a directory must be cleared, ask the user to do it manually.
- In Electron dev mode, `src/` usually hot reloads. Changes to `desktop/main.js`, `desktop/preload.cjs`, `server/*.mjs`, `vite.config.ts`, or `local-server.mjs` may require restarting `npm run dev:electron`.
- Packaged mode starts `local-server.mjs` from `desktop/main.js`, usually on port `45437`.
- Netease audio streaming must stay shared through `server/netease-audio-proxy.mjs`; otherwise a dev-only stream fix can leave the installed Electron build exposed to unhandled Node `undici` errors during track switches, close, or network interruption.
- System audio input is Windows-first and uses Electron display-media loopback under the hood. Microphone devices use standard `navigator.mediaDevices` APIs and should refresh on `devicechange` after the OS recognizes new hardware.
- Cloud music playback can be affected by copyright, membership, region, account status, and upstream API changes.
