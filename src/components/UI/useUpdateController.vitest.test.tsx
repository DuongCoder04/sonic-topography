import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateController } from './useUpdateController';
import { fetchLatestUpdate } from '../../lib/updateApi';

vi.mock('../../lib/updateApi', () => ({
  fetchLatestUpdate: vi.fn(),
  createUpdateDownload: vi.fn(),
  fetchUpdateDownloadStatus: vi.fn(),
}));

describe('update controller', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('reports the current version for a manual no-update check', async () => {
    vi.mocked(fetchLatestUpdate).mockResolvedValue({
      configured: true,
      currentVersion: '1.1.4',
      latestVersion: '1.1.4',
      updateAvailable: false,
    });
    const { result } = renderHook(() => useUpdateController('zh'));
    await act(async () => result.current.checkForUpdate({ manual: true }));
    expect(result.current.updateStatus).toContain('1.1.4');
    expect(result.current.showUpdatePrompt).toBe(false);
  });

  it('cleans the startup timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useUpdateController('en'));
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
