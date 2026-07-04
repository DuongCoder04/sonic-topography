import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const downloadJobs = new Map();
const DEFAULT_DOWNLOAD_MIRRORS = [
  { name: 'GH Proxy', prefix: 'https://gh-proxy.com/' },
  { name: 'GHFast', prefix: 'https://ghfast.top/' },
  { name: 'GH LLKK', prefix: 'https://gh.llkk.cc/' },
  { name: 'GitHubProxy', prefix: 'https://githubproxy.net/' },
];
const DEFAULT_DOWNLOAD_STALL_TIMEOUT_MS = 90000;

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map((part) => Number(part) || 0);
  const right = normalizeVersion(b).split('.').map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function normalizeUpdateSource(value) {
  const input = value && typeof value === 'object' ? value : {};
  let owner = String(input.owner || '').trim();
  let repo = String(input.repo || '').trim();
  if (owner.includes('/') && !repo) {
    const [nextOwner, nextRepo] = owner.split('/');
    owner = nextOwner || '';
    repo = nextRepo || '';
  }
  return {
    configured: Boolean(owner && repo),
    provider: 'github',
    owner,
    repo,
  };
}

function trimTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function normalizeDownloadMirrors(value) {
  const input = Array.isArray(value) ? value : DEFAULT_DOWNLOAD_MIRRORS;
  const seen = new Set();
  const mirrors = [];
  for (const item of input) {
    const rawPrefix = typeof item === 'string' ? item : item?.prefix;
    const prefix = trimTrailingSlashes(rawPrefix);
    if (!prefix || seen.has(prefix)) continue;
    seen.add(prefix);
    let name = typeof item === 'object' && item?.name ? String(item.name).trim() : '';
    if (!name) {
      try {
        name = new URL(prefix).hostname.replace(/^www\./, '');
      } catch {
        name = prefix;
      }
    }
    mirrors.push({ name, prefix: `${prefix}/` });
  }
  return mirrors;
}

async function readPackageJson() {
  const raw = await fs.readFile(path.join(appRoot, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

async function getUpdateConfig() {
  const pkg = await readPackageJson();
  const envRepo = String(process.env.SONIC_UPDATE_REPO || '').trim();
  const source = envRepo
    ? normalizeUpdateSource({ owner: envRepo })
    : normalizeUpdateSource(pkg.sonicTopography?.update);
  return {
    ...source,
    currentVersion: normalizeVersion(pkg.version || '0.0.0'),
    downloadMirrors: normalizeDownloadMirrors(pkg.sonicTopography?.update?.downloadMirrors),
  };
}

function isGithubDownloadUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase() === 'github.com';
  } catch {
    return false;
  }
}

export function buildDownloadCandidates(downloadUrl, mirrors = DEFAULT_DOWNLOAD_MIRRORS) {
  const url = String(downloadUrl || '').trim();
  if (!url) return [];
  const candidates = [{ name: 'GitHub', url }];
  if (!isGithubDownloadUrl(url)) return candidates;
  const seen = new Set([url]);
  for (const mirror of normalizeDownloadMirrors(mirrors)) {
    const candidateUrl = `${mirror.prefix}${url}`;
    if (seen.has(candidateUrl)) continue;
    seen.add(candidateUrl);
    candidates.push({ name: mirror.name, url: candidateUrl });
  }
  return candidates;
}

function pickInstallerAsset(assets, latestVersion) {
  const candidates = (Array.isArray(assets) ? assets : []).filter((asset) => {
    const name = String(asset?.name || '');
    return /\.exe$/i.test(name);
  });
  return candidates.find((asset) => /setup|installer/i.test(asset.name || ''))
    || candidates.find((asset) => String(asset?.name || '').includes(latestVersion))
    || candidates[0]
    || null;
}

function safeFileName(name) {
  return String(name || 'SonicTopography-Update.exe').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
}

async function getLatestUpdate() {
  const config = await getUpdateConfig();
  if (!config.configured) {
    return {
      configured: false,
      updateAvailable: false,
      currentVersion: config.currentVersion,
      latestVersion: config.currentVersion,
      message: '更新源未配置',
    };
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/latest`;
  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SonicTopographyUpdater',
    },
  });
  if (!response.ok) throw new Error(`GitHub latest release failed: ${response.status}`);
  const release = await response.json();
  const latestVersion = normalizeVersion(release.tag_name || release.name || config.currentVersion);
  const asset = pickInstallerAsset(release.assets, latestVersion);
  const updateAvailable = compareVersions(latestVersion, config.currentVersion) > 0;

  return {
    configured: true,
    provider: 'github',
    owner: config.owner,
    repo: config.repo,
    currentVersion: config.currentVersion,
    latestVersion,
    updateAvailable,
    release: {
      tagName: release.tag_name || `v${latestVersion}`,
      name: release.name || `Sonic Topography v${latestVersion}`,
      htmlUrl: release.html_url || '',
      publishedAt: release.published_at || '',
      notes: release.body || '',
    },
    asset: asset ? {
      name: asset.name || `SonicTopography-${latestVersion}-Setup.exe`,
      size: asset.size || 0,
      downloadUrl: asset.browser_download_url || '',
    } : null,
    downloadMirrors: config.downloadMirrors,
  };
}

function getDownloadDir() {
  return process.env.SONIC_UPDATE_DOWNLOAD_DIR || path.join(appRoot, 'updates', 'downloads');
}

function jobPayload(job) {
  return {
    id: job.id,
    status: job.status,
    version: job.version,
    name: job.name,
    received: job.received,
    total: job.total,
    filePath: job.filePath,
    error: job.error,
    channelName: job.channelName || '',
    channelUrl: job.channelUrl || '',
    attempts: Array.isArray(job.attempts) ? job.attempts : [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function streamResponseToFile(response, filePath, job, options = {}) {
  const stallTimeoutMs = Number(options.stallTimeoutMs || DEFAULT_DOWNLOAD_STALL_TIMEOUT_MS);
  job.total = Number(response.headers.get('content-length') || job.total || 0);
  job.received = 0;
  job.updatedAt = Date.now();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.download`;
  const fileHandle = await fs.open(tempFilePath, 'w');
  const reader = response.body?.getReader?.();
  if (!reader) {
    await fileHandle.close();
    throw new Error('Download response body is not readable');
  }

  try {
    while (true) {
      let timeoutId;
      const readResult = await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Download stalled with no incoming data')), stallTimeoutMs);
        }),
      ]).finally(() => clearTimeout(timeoutId));
      if (readResult.done) break;
      const chunk = Buffer.from(readResult.value || []);
      if (!chunk.length) continue;
      await fileHandle.write(chunk);
      job.received += chunk.length;
      job.updatedAt = Date.now();
      options.onProgress?.(job);
    }
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // Ignore release failures after aborted reads.
    }
    await fileHandle.close();
  }

  await fs.rm(filePath, { force: true }).catch(() => {});
  await fs.rename(tempFilePath, filePath);
}

export async function downloadJob(job, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const candidates = buildDownloadCandidates(job.downloadUrl, job.downloadMirrors);
  job.attempts = [];
  job.status = 'downloading';
  job.updatedAt = Date.now();

  for (const candidate of candidates) {
    job.channelName = candidate.name;
    job.channelUrl = candidate.url;
    job.received = 0;
    job.error = '';
    job.updatedAt = Date.now();
    const attempt = {
      name: candidate.name,
      url: candidate.url,
      status: 'downloading',
      error: '',
      startedAt: Date.now(),
      finishedAt: 0,
    };
    job.attempts.push(attempt);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Number(options.stallTimeoutMs || DEFAULT_DOWNLOAD_STALL_TIMEOUT_MS));
      const response = await fetchImpl(candidate.url, {
        headers: { 'User-Agent': 'SonicTopographyUpdater' },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      await streamResponseToFile(response, job.filePath, job, options);
      attempt.status = 'ready';
      attempt.finishedAt = Date.now();
      job.status = 'ready';
      job.error = '';
      job.updatedAt = Date.now();
      return;
    } catch (error) {
      attempt.status = 'failed';
      attempt.error = error.message || 'Download failed';
      attempt.finishedAt = Date.now();
      job.error = attempt.error;
      job.updatedAt = Date.now();
      await fs.rm(`${job.filePath}.download`, { force: true }).catch(() => {});
    }
  }

  job.status = 'failed';
  job.error = job.attempts.length
    ? `All download channels failed: ${job.error || 'download failed'}`
    : 'No download channels available';
  job.updatedAt = Date.now();
}

async function startDownload() {
  const latest = await getLatestUpdate();
  if (!latest.configured) return { ok: false, error: 'UPDATE_SOURCE_NOT_CONFIGURED', latest };
  if (!latest.updateAvailable) return { ok: false, error: 'NO_UPDATE_AVAILABLE', latest };
  if (!latest.asset?.downloadUrl) return { ok: false, error: 'UPDATE_ASSET_MISSING', latest };

  const id = `${latest.latestVersion}-${Date.now()}`;
  const name = safeFileName(latest.asset.name || `SonicTopography-${latest.latestVersion}-Setup.exe`);
  const job = {
    id,
    status: 'queued',
    version: latest.latestVersion,
    name,
    downloadUrl: latest.asset.downloadUrl,
    downloadMirrors: latest.downloadMirrors || [],
    received: 0,
    total: latest.asset.size || 0,
    filePath: path.join(getDownloadDir(), name),
    error: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  downloadJobs.set(id, job);
  downloadJob(job);
  return { ok: true, job: jobPayload(job), latest };
}

async function readRequestJson(req) {
  return await new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function writeJsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handleRoute(req, res, parsedUrl, writeJson = writeJsonResponse) {
  try {
    if (parsedUrl.pathname === '/api/update/latest') {
      writeJson(res, 200, await getLatestUpdate());
      return true;
    }

    if (parsedUrl.pathname === '/api/update/download') {
      if (!['POST', 'GET'].includes(req.method || '')) return false;
      if (!req.body) await readRequestJson(req);
      writeJson(res, 200, await startDownload());
      return true;
    }

    if (parsedUrl.pathname === '/api/update/download/status') {
      const id = parsedUrl.searchParams.get('id') || '';
      const job = downloadJobs.get(id);
      writeJson(res, job ? 200 : 404, job ? { ok: true, job: jobPayload(job) } : { ok: false, error: 'DOWNLOAD_JOB_NOT_FOUND' });
      return true;
    }
  } catch (error) {
    writeJson(res, 500, { ok: false, error: error.message || 'Update request failed' });
    return true;
  }
  return false;
}

export function registerUpdateExpressRoutes(app) {
  app.use(async (req, res, next) => {
    const parsedUrl = new URL(req.originalUrl || req.url || '', 'http://localhost');
    if (await handleRoute(req, res, parsedUrl, (response, status, payload) => response.status(status).json(payload))) return;
    next();
  });
}

export function registerUpdateViteMiddlewares(server, writeJson) {
  server.middlewares.use(async (req, res, next) => {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    if (!parsedUrl.pathname.startsWith('/api/update/')) {
      next();
      return;
    }
    if (await handleRoute(req, res, parsedUrl, writeJson)) return;
    next();
  });
}
