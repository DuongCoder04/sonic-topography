import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioInputController } from './useAudioInputController';
import { engine } from '../../lib/AudioEngine';
import { listAudioInputDevices } from '../../lib/audioInput';

vi.mock('../../lib/AudioEngine', () => ({
  engine: {
    stopExternalInput: vi.fn(),
    loadStream: vi.fn(),
  },
}));

vi.mock('../../lib/audioInput', () => ({
  hasMediaDeviceSupport: () => true,
  listAudioInputDevices: vi.fn(),
}));

describe('audio input controller', () => {
  beforeEach(() => {
    vi.mocked(listAudioInputDevices).mockResolvedValue([{ id: 'mic-1', label: 'Studio Mic' }]);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getUserMedia: vi.fn(),
        getDisplayMedia: vi.fn(),
        enumerateDevices: vi.fn(),
      },
    });
  });

  it('loads devices and removes listeners/external input on unmount', async () => {
    const { result, unmount } = renderHook(() => useAudioInputController({
      currentTrackName: 'No track selected',
      hasCurrentSong: false,
      onPrepareExternalInput: vi.fn(),
      onResetDisconnectedInput: vi.fn(),
      onReturnToPlayer: vi.fn(),
      onClosePanel: vi.fn(),
    }));
    await waitFor(() => expect(result.current.audioInputDevices).toHaveLength(1));
    expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
    unmount();
    expect(navigator.mediaDevices.removeEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
    expect(engine.stopExternalInput).toHaveBeenCalled();
  });
});
