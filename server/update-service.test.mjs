import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildDownloadCandidates,
  configureUpdateService,
  downloadJob,
  normalizeDownloadMirrors,
  prepareUpdateDownload,
} from './update-service.mjs';

const githubUrl = 'https://github.com/yin-yizhen/sonic-topography/releases/download/1.1.2/SonicTopography-1.1.2-Setup.exe';

assert.deepEqual(normalizeDownloadMirrors([
  'https://ghfast.top/',
  { name: 'LLKK', prefix: ' https://gh.llkk.cc/ ' },
  'https://ghfast.top/',
  { name: '', prefix: '' },
]), [
  { name: 'ghfast.top', prefix: 'https://ghfast.top/' },
  { name: 'LLKK', prefix: 'https://gh.llkk.cc/' },
]);

assert.deepEqual(buildDownloadCandidates(githubUrl, [{ name: 'Fast', prefix: 'https://ghfast.top/' }]), [
  { name: 'GitHub', url: githubUrl },
  { name: 'Fast', url: `https://ghfast.top/${githubUrl}` },
]);

assert.deepEqual(buildDownloadCandidates('https://example.com/file.exe', [{ name: 'Fast', prefix: 'https://ghfast.top/' }]), [
  { name: 'GitHub', url: 'https://example.com/file.exe' },
]);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sonic-update-test-'));
const updateLogPath = path.join(tmpDir, 'update.log');
configureUpdateService({ logPath: updateLogPath });
const filePath = path.join(tmpDir, 'update.exe');
const attempts = [];

const job = {
  id: 'test-job',
  status: 'queued',
  version: '1.1.2',
  name: 'update.exe',
  downloadUrl: githubUrl,
  downloadMirrors: [{ name: 'Mirror', prefix: 'https://ghfast.top/' }],
  received: 0,
  total: 0,
  filePath,
  error: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const firstChunk = new Uint8Array([0x4d, 0x5a, 3]);
const secondChunk = new Uint8Array([4, 5]);
const progress = [];

await downloadJob(job, {
  stallTimeoutMs: 1000,
  onProgress: (nextJob) => progress.push(nextJob.received),
  fetchImpl: async (url) => {
    attempts.push(url);
    if (attempts.length === 1) return new Response('blocked', { status: 503 });
    let chunkIndex = 0;
    return new Response(new ReadableStream({
      pull(controller) {
        if (chunkIndex === 0) {
          chunkIndex += 1;
          controller.enqueue(firstChunk);
          return;
        }
        if (chunkIndex === 1) {
          chunkIndex += 1;
          controller.enqueue(secondChunk);
          return;
        }
        if (chunkIndex === 2) {
          chunkIndex += 1;
          controller.close();
        }
      },
    }), {
      status: 200,
      headers: { 'content-length': String(firstChunk.length + secondChunk.length) },
    });
  },
});

assert.equal(job.status, 'ready');
assert.equal(job.received, 5);
assert.equal(job.total, 5);
assert.equal(job.channelName, 'Mirror');
assert.equal(attempts.length, 2);
assert.deepEqual(progress, [3, 5]);
assert.deepEqual([...await fs.readFile(filePath)], [0x4d, 0x5a, 3, 4, 5]);

const failedJob = {
  ...job,
  id: 'failed-job',
  status: 'queued',
  received: 0,
  total: 0,
  filePath: path.join(tmpDir, 'failed.exe'),
  error: '',
};

await downloadJob(failedJob, {
  stallTimeoutMs: 1000,
  fetchImpl: async () => new Response('nope', { status: 404 }),
});

assert.equal(failedJob.status, 'failed');
assert.match(failedJob.error, /All download channels failed/);
assert.equal(failedJob.errorCode, 'ALL_DOWNLOAD_CHANNELS_FAILED');
const updateLog = await fs.readFile(updateLogPath, 'utf8');
assert.match(updateLog, /download_attempt_started/);
assert.match(updateLog, /download_attempt_failed/);
assert.match(updateLog, /download_failed/);

const invalidInstallerJob = {
  ...job,
  id: 'invalid-installer-job',
  status: 'queued',
  received: 0,
  total: 4,
  expectedSize: 4,
  downloadMirrors: [],
  filePath: path.join(tmpDir, 'invalid.exe'),
  error: '',
};
await downloadJob(invalidInstallerJob, {
  fetchImpl: async () => new Response('<h1>', { status: 200, headers: { 'content-length': '4' } }),
});
assert.equal(invalidInstallerJob.status, 'failed');
assert.equal(invalidInstallerJob.attempts[0].errorCode, 'INSTALLER_INVALID_FORMAT');
assert.equal(await fs.stat(invalidInstallerJob.filePath).then(() => true, () => false), false);

const truncatedInstallerJob = {
  ...job,
  id: 'truncated-installer-job',
  status: 'queued',
  received: 0,
  total: 10,
  expectedSize: 10,
  downloadMirrors: [],
  filePath: path.join(tmpDir, 'truncated.exe'),
  error: '',
};
await downloadJob(truncatedInstallerJob, {
  fetchImpl: async () => new Response(new Uint8Array([0x4d, 0x5a, 1]), { status: 200 }),
});
assert.equal(truncatedInstallerJob.status, 'failed');
assert.equal(truncatedInstallerJob.attempts[0].errorCode, 'INSTALLER_SIZE_MISMATCH');

const staleTarget = path.join(tmpDir, 'stale.exe');
await fs.writeFile(`${staleTarget}.download`, 'partial');
await prepareUpdateDownload(staleTarget);
assert.equal(await fs.stat(`${staleTarget}.download`).then(() => true, () => false), false);

console.log('update service tests passed');
