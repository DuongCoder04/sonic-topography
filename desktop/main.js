import { app, BrowserWindow, desktopCapturer, ipcMain, net, session, shell } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAnalytics } from './analytics.js';
import { configureUpdateService } from '../server/update-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const isDev = Boolean(process.env.SONIC_ELECTRON_DEV_URL);
const appUrl = process.env.SONIC_ELECTRON_DEV_URL || `http://127.0.0.1:${process.env.PORT || '45437'}`;
const updateDownloadDir = path.join(app.getPath('userData'), 'updates', 'downloads');
const dataDir = path.join(app.getPath('userData'), 'data');
const mainLogPath = path.join(app.getPath('userData'), 'logs', 'main.log');
const updateLogPath = path.join(app.getPath('userData'), 'logs', 'update.log');
const analytics = createAnalytics({ app });

const NETEASE_LOGIN_PARTITION = 'persist:sonic-topography-netease-login';
const NETEASE_LOGIN_URL = 'https://music.163.com/#/login';
const QQ_LOGIN_PARTITION = 'persist:sonic-topography-qqmusic-login';
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile';

let mainWindow = null;
const windowDragState = new Map();

function logMainProcessError(kind, error) {
  const message = error?.stack || error?.message || String(error || '');
  const line = `[${new Date().toISOString()}] ${kind}\n${message}\n\n`;
  try {
    fs.mkdirSync(path.dirname(mainLogPath), { recursive: true });
    fs.appendFileSync(mainLogPath, line, 'utf8');
  } catch {
    // Logging must never become another startup failure.
  }
}

process.on('uncaughtException', (error) => {
  logMainProcessError('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  logMainProcessError('unhandledRejection', reason);
});

for (const [name, value] of [
  ['autoplay-policy', 'no-user-gesture-required'],
  ['force_high_performance_gpu'],
  ['ignore-gpu-blocklist'],
  ['enable-gpu-rasterization'],
  ['enable-zero-copy'],
  ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'],
]) {
  if (value == null) app.commandLine.appendSwitch(name);
  else app.commandLine.appendSwitch(name, value);
}

app.setName('Sonic Topography');
app.setAppUserModelId('com.sonic-topography.desktop');

function parseCookieHeader(cookieText) {
  const out = {};
  String(cookieText || '').split(';').forEach((part) => {
    const raw = String(part || '').trim();
    if (!raw) return;
    const index = raw.indexOf('=');
    if (index <= 0) return;
    const key = raw.slice(0, index).trim();
    const value = raw.slice(index + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}

function normalizeQQUin(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || digits;
}

function qqCookieUin(cookie) {
  const raw = Number(cookie.login_type) === 2
    ? (cookie.wxuin || cookie.uin || cookie.p_uin)
    : (cookie.uin || cookie.qqmusic_uin || cookie.wxuin || cookie.p_uin);
  return normalizeQQUin(raw);
}

function qqCookieMusicKey(cookie) {
  return cookie.qm_keyst
    || cookie.qqmusic_key
    || cookie.music_key
    || cookie.p_skey
    || cookie.skey
    || cookie.psrf_qqaccess_token
    || cookie.psrf_qqrefresh_token
    || cookie.wxrefresh_token
    || cookie.wxskey
    || '';
}

function qqCookiePlaybackKey(cookie) {
  return cookie.qm_keyst || cookie.qqmusic_key || cookie.music_key || cookie.wxskey || '';
}

function qqCookieHasLogin(cookieText) {
  const cookie = parseCookieHeader(cookieText);
  return Boolean(qqCookieUin(cookie) && qqCookieMusicKey(cookie));
}

function qqCookieHasPlaybackLogin(cookieText) {
  const cookie = parseCookieHeader(cookieText);
  return Boolean(qqCookieUin(cookie) && qqCookiePlaybackKey(cookie));
}

function neteaseCookieHasLogin(cookieText) {
  const cookie = parseCookieHeader(cookieText);
  return Boolean(cookie.MUSIC_U);
}

function isQQCookieDomain(domain) {
  const clean = String(domain || '').replace(/^\./, '').toLowerCase();
  return clean === 'qq.com' || clean.endsWith('.qq.com') || clean === 'y.qq.com';
}

function isNeteaseCookieDomain(domain) {
  const clean = String(domain || '').replace(/^\./, '').toLowerCase();
  return clean === 'music.163.com' || clean.endsWith('.music.163.com') || clean === '163.com' || clean.endsWith('.163.com');
}

function buildCookieHeader(cookies, isAllowedDomain, priority) {
  const picked = new Map();
  const prioritySet = new Set(priority);
  for (const cookie of cookies || []) {
    if (!cookie?.name || !isAllowedDomain(cookie.domain)) continue;
    picked.set(cookie.name, cookie.value || '');
  }
  return [
    ...priority.filter((key) => picked.has(key)).map((key) => [key, picked.get(key)]),
    ...[...picked.entries()].filter(([key]) => !prioritySet.has(key)).sort(([a], [b]) => a.localeCompare(b)),
  ]
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function readNeteaseLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeader(cookies, isNeteaseCookieDomain, [
    'MUSIC_U',
    '__csrf',
    'NMTID',
    'MUSIC_A',
    'MUSIC_R_T',
    'MUSIC_SNS',
  ]);
}

async function readQQLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeader(cookies, isQQCookieDomain, [
    'uin',
    'qqmusic_uin',
    'wxuin',
    'login_type',
    'qm_keyst',
    'qqmusic_key',
    'music_key',
    'p_skey',
    'skey',
    'psrf_qqopenid',
    'psrf_qqunionid',
    'psrf_qqaccess_token',
    'psrf_qqrefresh_token',
    'wxopenid',
    'wxunionid',
    'wxrefresh_token',
    'wxskey',
    'p_uin',
    'ptcz',
    'RK',
  ]);
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function createLoginWindow(owner, options) {
  return new BrowserWindow({
    width: options.width,
    height: options.height,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    parent: owner && !owner.isDestroyed() ? owner : undefined,
    modal: false,
    show: false,
    autoHideMenuBar: true,
    title: options.title,
    backgroundColor: '#111111',
    webPreferences: {
      partition: options.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
}

async function openNeteaseMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  const initialCookie = await readNeteaseLoginCookieHeader(cookieSession);
  if (neteaseCookieHasLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    const loginWindow = createLoginWindow(owner, {
      width: 940,
      height: 760,
      minWidth: 780,
      minHeight: 580,
      title: '网易云音乐登录',
      partition: NETEASE_LOGIN_PARTITION,
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (!loginWindow.isDestroyed()) loginWindow.close();
      resolve(result);
    };

    const checkCookies = async () => {
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession);
        if (neteaseCookieHasLogin(cookie)) finish({ ok: true, cookie });
      } catch (error) {
        console.warn('Netease login cookie check failed:', error.message);
      }
    };

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\/([^/]+\.)?(163|music\.163|netease)\.com/i.test(url)) {
        loginWindow.loadURL(url).catch((error) => console.warn('Netease login popup navigation failed:', error.message));
      } else if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies();
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const docs = [document];
          document.querySelectorAll('iframe').forEach((frame) => {
            try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
          });
          for (const doc of docs) {
            const nodes = Array.from(doc.querySelectorAll('a, button, span, div'));
            const loginNode = nodes.find((node) => {
              const text = (node.textContent || '').trim();
              if (!/登录|立即登录/.test(text)) return false;
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            if (loginNode) { loginNode.click(); return true; }
          }
          return false;
        }, 900);
      `, true).catch(() => {});
    });

    loginWindow.on('ready-to-show', () => loginWindow.show());
    loginWindow.on('closed', async () => {
      if (settled) return;
      if (pollTimer) clearInterval(pollTimer);
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession);
        resolve(neteaseCookieHasLogin(cookie)
          ? { ok: true, cookie }
          : { ok: false, cancelled: true, message: '网易云登录窗口已关闭' });
      } catch (error) {
        resolve({ ok: false, error: error.message || '网易云登录窗口已关闭' });
      }
    });

    pollTimer = setInterval(checkCookies, 1200);
    loginWindow.loadURL(NETEASE_LOGIN_URL).catch((error) => finish({ ok: false, error: error.message }));
  });
}

async function openQQMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION);
  const initialCookie = await readQQLoginCookieHeader(cookieSession);
  if (qqCookieHasPlaybackLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    let warmupStarted = false;
    const loginWindow = createLoginWindow(owner, {
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      title: 'QQ 音乐登录',
      partition: QQ_LOGIN_PARTITION,
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (!loginWindow.isDestroyed()) loginWindow.close();
      resolve(result);
    };

    const checkCookies = async () => {
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession);
        if (qqCookieHasPlaybackLogin(cookie)) {
          finish({ ok: true, cookie });
        } else if (qqCookieHasLogin(cookie) && !warmupStarted) {
          warmupStarted = true;
          setTimeout(() => {
            if (!settled && !loginWindow.isDestroyed()) {
              loginWindow.loadURL('https://y.qq.com/n/ryqq/player').catch((error) => console.warn('QQ login warmup navigation failed:', error.message));
            }
          }, 900);
        }
      } catch (error) {
        console.warn('QQ login cookie check failed:', error.message);
      }
    };

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        loginWindow.loadURL(url).catch((error) => console.warn('QQ login popup navigation failed:', error.message));
      } else {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies();
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
          const loginNode = nodes.find((node) => {
            const text = (node.textContent || '').trim();
            if (!/登录|登陆/.test(text)) return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (loginNode) loginNode.click();
        }, 700);
      `, true).catch(() => {});
    });

    loginWindow.on('ready-to-show', () => loginWindow.show());
    loginWindow.on('closed', async () => {
      if (settled) return;
      if (pollTimer) clearInterval(pollTimer);
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession);
        resolve(qqCookieHasLogin(cookie)
          ? { ok: true, cookie, partial: !qqCookieHasPlaybackLogin(cookie) }
          : { ok: false, cancelled: true, message: 'QQ 音乐登录窗口已关闭' });
      } catch (error) {
        resolve({ ok: false, error: error.message || 'QQ 音乐登录窗口已关闭' });
      }
    });

    pollTimer = setInterval(checkCookies, 1200);
    loginWindow.loadURL(QQ_LOGIN_URL).catch((error) => finish({ ok: false, error: error.message }));
  });
}

async function clearLoginSession(partition) {
  const cookieSession = session.fromPartition(partition);
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  });
  return { ok: true };
}

function waitForHttp(url, timeoutMs = 12000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
      request.setTimeout(1000, () => {
        request.destroy();
      });
    };
    tick();
  });
}

async function startProductionServer() {
  process.env.PORT = process.env.PORT || '45437';
  process.env.SONIC_UPDATE_DOWNLOAD_DIR = updateDownloadDir;
  process.env.SONIC_DATA_DIR = dataDir;
  configureUpdateService({ fetchImpl: (...args) => net.fetch(...args), logPath: updateLogPath });
  await import(pathToFileURL(path.join(appRoot, 'local-server.mjs')).href);
  await waitForHttp(appUrl);
}

function configureSystemAudioCapture() {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (process.platform !== 'win32') {
      callback({});
      return;
    }

    desktopCapturer.getSources({ types: ['screen'] })
      .then((sources) => {
        callback({
          video: sources[0],
          audio: 'loopback',
        });
      })
      .catch(() => callback({}));
  }, { useSystemPicker: false });
}

async function createWindow() {
  if (!isDev) await startProductionServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    autoHideMenuBar: true,
    title: 'Sonic Topography',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(appUrl);
}

ipcMain.handle('sonic-window-minimize', () => mainWindow?.minimize());
ipcMain.handle('sonic-window-toggle-maximize', () => {
  if (!mainWindow) return { maximized: false };
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return { maximized: mainWindow.isMaximized() };
});
ipcMain.handle('sonic-window-close', () => mainWindow?.close());
ipcMain.handle('sonic-window-drag-start', (event, point) => {
  const win = getSenderWindow(event);
  if (!win) return { ok: false };
  windowDragState.set(win.id, {
    mouseX: Number(point?.screenX || 0),
    mouseY: Number(point?.screenY || 0),
    bounds: win.getBounds(),
  });
  return { ok: true };
});
ipcMain.handle('sonic-window-drag-move', (event, point) => {
  const win = getSenderWindow(event);
  if (!win) return { ok: false };
  const state = windowDragState.get(win.id);
  if (!state) return { ok: false };
  const nextX = Math.round(state.bounds.x + Number(point?.screenX || 0) - state.mouseX);
  const nextY = Math.round(state.bounds.y + Number(point?.screenY || 0) - state.mouseY);
  win.setBounds({ x: nextX, y: nextY, width: state.bounds.width, height: state.bounds.height }, false);
  return { ok: true };
});
ipcMain.handle('sonic-window-drag-end', (event) => {
  const win = getSenderWindow(event);
  if (win) windowDragState.delete(win.id);
  return { ok: true };
});
ipcMain.handle('sonic-open-netease-login', (event) => openNeteaseMusicLoginWindow(getSenderWindow(event)));
ipcMain.handle('sonic-clear-netease-login', () => clearLoginSession(NETEASE_LOGIN_PARTITION));
ipcMain.handle('sonic-open-qq-login', (event) => openQQMusicLoginWindow(getSenderWindow(event)));
ipcMain.handle('sonic-clear-qq-login', () => clearLoginSession(QQ_LOGIN_PARTITION));
ipcMain.handle('sonic-open-update-installer', async (_event, filePath) => {
  const target = path.resolve(String(filePath || ''));
  const allowedRoot = path.resolve(updateDownloadDir);
  if (!target.startsWith(allowedRoot + path.sep) || !fs.existsSync(target)) {
    return { ok: false, error: 'Invalid update installer path' };
  }
  const error = await shell.openPath(target);
  return error ? { ok: false, error } : { ok: true };
});

app.whenReady().then(async () => {
  configureSystemAudioCapture();
  await createWindow();
  analytics.init();
});
ipcMain.handle('sonic-open-update-release', async (_event, releaseUrl) => {
  try {
    const target = new URL(String(releaseUrl || ''));
    const allowedPath = '/yin-yizhen/sonic-topography/releases';
    if (target.protocol !== 'https:' || target.hostname !== 'github.com' || (target.pathname !== allowedPath && !target.pathname.startsWith(`${allowedPath}/`))) {
      return { ok: false, error: 'Invalid update release URL' };
    }
    await shell.openExternal(target.toString());
    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid update release URL' };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
