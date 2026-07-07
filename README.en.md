# Sonic Topography

[中文](./README.md) | **English** | [日本語](./README_ja.md)

Sonic Topography is a desktop music player and 3D music visualizer. It turns low, mid, and high frequency energy into a glowing, moving terrain so music feels like a living sound map.

> Usage restriction: this project is provided only for learning, research, and personal non-commercial use. Without explicit permission from the author, it may not be used for commercial projects, commercial performances, commercial displays, paid services, resale, or any profit-making purpose.

![Sonic Topography desktop visualizer](./public/screenshots/desktop-visualizer.png)

## Highlights

- Desktop app: built with Electron, so it runs as its own window instead of a browser tab.
- 3D music terrain: frequency bands drive terrain columns, glow, ripples, meteors, and lyrics.
- Local playback: upload local audio files and optional `.lrc` lyric files.
- Built-in demo: open the app and preview the visualizer without preparing music first.
- Netease Cloud Music: open the official login window in the desktop app, scan the QR code, and use the local Cookie for search, playlists, daily recommendations, and playback.
- QQ Music: open the official login window in the desktop app, scan the QR code, and use the QQ Music Cookie for search, playback, and lyrics.
- Local playlists: save favorite tracks into local playlists.
- More human-friendly Ground EQ: use 8 frequency faders to control how different sounds shape the terrain.
- Time display and Pomodoro: turn the visualizer into a focus-friendly desktop clock and timer.
- Preset transfer: import and export playlists, effects, Ground EQ, custom themes, and browser settings.

## Quick Start

If you only want to use the app:

1. Download and install the Windows installer.
2. Open `Sonic Topography`.
3. Click `AJIN.` in the top-left corner to open the side rail.
4. Click `Demo` first to check that visuals and audio are working.
5. Click `Upload` to play your own local audio file.
6. To use Netease or QQ Music, open `Settings -> Account`, then follow the official QR login flow.

## Interface

Click `AJIN.` in the top-left corner to open the side rail.

- `Visual`: close panels and return to the 3D music terrain.
- `Settings`: open visualizer, Ground EQ, theme, account login, and display settings.
- `Search`: search Netease Cloud Music and QQ Music.
- `Netease`: appears after a valid Netease Cookie is saved; opens liked songs, playlists, and daily recommendations.
- `Playlist`: open local playlists.
- `Demo`: play the built-in demo.
- `Upload`: choose local audio or `.lrc` lyric files.
- `Fullscreen`: enter or exit fullscreen.

## Ground EQ

Ground EQ controls how different parts of the music affect the 3D terrain. It is not a traditional audio equalizer that only changes the sound; it is a visual effects mixer for the ground.

![Human-friendly custom Ground EQ](./public/screenshots/ground-eq.png)

Each fader has a visual personality:

- `SUB BASS / Center Lift`: lets deep bass push the center of the terrain.
- `BASS / Weight`: controls the heavy body of the low end.
- `LOW MID / Slow Flow`: creates slower terrain waves.
- `MID / Direction Flow`: adds directional movement from mid frequencies.
- `HIGH MID / Peaks`: makes rhythmic highlights rise into sharper peaks.
- `PRESENCE / Flash Trigger`: controls local flashes and bright accents.
- `BRILLIANCE / Edge Shimmer`: adds small, light edge sparkles.
- `AIR / Air Particles`: controls the lightest high-frequency particles.

The `Motion Speed` slider controls how quickly the ground rises and falls. Higher values feel more responsive; lower values feel smoother and calmer.

## Time Display And Pomodoro

Sonic Topography can also work as a focus desktop background. When time display is enabled, a large clock appears over the 3D terrain. With Pomodoro mode, it can support work, study, reading, or breaks.

![Time display and Pomodoro](./public/screenshots/focus-clock.png)

Suggested use:

1. Play focus music or ambient sound.
2. Enable the time display.
3. Start a Pomodoro session at your own pace.
4. Enter fullscreen and let it become a lightweight focus desktop.

## Account Login

Open `Settings -> Account`, then choose `Netease` or `QQ Music`.

In the Electron desktop app, click `Open Official QR Login` to open the official login page. After QR login succeeds, Sonic Topography reads the Cookie from that login window and syncs it to the local proxy service.

In a normal browser dev page, QR login is unavailable. Manual Cookie inputs remain only as a fallback debug path.

Cookies are sensitive login credentials and are stored only on your machine. Do not export, upload, or share them.

## Preset Import And Export

Settings can import or export presets. Presets are useful when moving your visual setup between machines.

Preset files can include:

- Playlists
- Pulse effects
- Meteor effects
- Ground EQ
- Custom themes
- Browser settings

Export can optionally include Cookies. In most cases, do not include Cookies unless you understand the risk and are only moving data between your own devices.

## Local Data

- Themes, effects, Ground EQ, account Cookies, and most settings are stored locally on your machine.
- During source development, local playlists are saved through `/api/playlists` into `data/playlists.json`.
- In packaged Electron, local server data is stored under Electron's user data directory.
- Uploaded audio files are not exported in preset files and are not bundled into the installer.

## Development

Install dependencies:

```powershell
npm install
```

Use Electron mode for day-to-day development:

```powershell
npm run dev:electron
```

This starts the Vite dev server and opens an Electron window. Edits under `src/`, CSS, React components, and Settings UI usually hot-update.

Browser-only UI development is also available:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

Restart Electron after changing:

- `desktop/main.js`
- `desktop/preload.cjs`
- Electron packaging config, window behavior, or IPC login bridges
- Local server and proxy code

## Packaging

Before release:

```powershell
npm run build:electron
```

The Windows installer is written to:

```text
release/
```

For a packaged directory without creating an installer:

```powershell
npm run build:electron:dir
```

## Useful Commands

```powershell
npm run dev:electron
npm run lint
npm run build
npm run build:electron:dir
npm run build:electron
```

## Notes

- Netease and QQ Music playback may be affected by copyright, membership, region, or account state.
- Search results only show content available under the current anonymous state or current Cookie permissions.
- Do not commit `dist/`, `release/`, local `data/`, update downloads, or account Cookies.
- If a song appears in search but cannot play, check account state, song copyright, and whether the selected quality is available.

## Buy The Author A Coffee

If you enjoy Sonic Topography, or if it happens to keep you company during work, study, or creative time, you can buy the author a coffee.

All support will be used to buy tokens and related services so the app can keep improving, fixing bugs, adding features, and becoming nicer to use.

![Buy the author a coffee](./public/screenshots/coffee-qr.png)

Thank you for every bit of support. This project will keep growing.
