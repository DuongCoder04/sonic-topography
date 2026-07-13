import type { AvailableUpdateInfo, UpdateDownloadJob } from '../types';

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return await response.json() as T;
}

export function fetchLatestUpdate() {
  return readJson<AvailableUpdateInfo>('/api/update/latest');
}

export function createUpdateDownload() {
  return readJson<{ ok?: boolean; error?: string; job?: UpdateDownloadJob }>('/api/update/download', { method: 'POST' });
}

export function fetchUpdateDownloadStatus(id: string) {
  return readJson<{ job?: UpdateDownloadJob }>(`/api/update/download/status?id=${encodeURIComponent(id)}`);
}
