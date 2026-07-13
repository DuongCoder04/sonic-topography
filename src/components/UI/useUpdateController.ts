import { useEffect, useRef, useState } from 'react';
import { t, type Language } from '../../lib/i18n';
import {
  readSkippedUpdateVersionStorage,
  shouldShowUpdatePrompt,
  writeSkippedUpdateVersionStorage,
} from '../../lib/updatePrompt';
import { createUpdateDownload, fetchLatestUpdate, fetchUpdateDownloadStatus } from '../../lib/updateApi';
import type { AvailableUpdateInfo, UpdateDownloadJob } from '../../types';

export function formatBytes(value: number | undefined) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = bytes;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function useUpdateController(lang: Language) {
  const [updateStatus, setUpdateStatus] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdateInfo | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [downloadJob, setDownloadJob] = useState<UpdateDownloadJob | null>(null);
  const [showUpdateReleaseFallback, setShowUpdateReleaseFallback] = useState(false);
  const [skippedUpdateVersion, setSkippedUpdateVersion] = useState(readSkippedUpdateVersionStorage);
  const updatePollTimerRef = useRef<number | null>(null);

  const clearUpdatePollTimer = () => {
    if (updatePollTimerRef.current !== null) {
      window.clearTimeout(updatePollTimerRef.current);
      updatePollTimerRef.current = null;
    }
  };

  const checkForUpdate = async (options: { silent?: boolean; manual?: boolean } = {}) => {
    setIsCheckingUpdate(true);
    if (!options.silent) setUpdateStatus(t('ui.text.27', lang));
    try {
      const data = await fetchLatestUpdate();
      if (!data.configured) {
        if (!options.silent) setUpdateStatus(t('ui.text.28', lang));
        return;
      }
      if (!data.updateAvailable) {
        if (!options.silent) setUpdateStatus(`当前已是最新版本 ${data.currentVersion}`);
        return;
      }
      setAvailableUpdate(data);
      setDownloadJob(null);
      setShowUpdateReleaseFallback(false);
      setUpdateStatus(`发现新版本 ${data.latestVersion}`);
      if (options.manual || shouldShowUpdatePrompt(data.latestVersion || '', skippedUpdateVersion)) {
        setShowUpdatePrompt(true);
      }
    } catch (error) {
      console.warn('Unable to check updates:', error);
      if (!options.silent) setUpdateStatus(t('ui.text.29', lang));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const startUpdateDownload = async () => {
    clearUpdatePollTimer();
    setShowUpdateReleaseFallback(false);
    setUpdateStatus(t('ui.text.30', lang));
    try {
      const downloadData = await createUpdateDownload();
      if (!downloadData.ok || !downloadData.job?.id) {
        setUpdateStatus(downloadData.error || t('ui.text.31', lang));
        return;
      }
      setDownloadJob(downloadData.job);
      const poll = async () => {
        try {
          const { job } = await fetchUpdateDownloadStatus(downloadData.job!.id);
          if (!job) {
            setUpdateStatus(t('ui.text.32', lang));
            return;
          }
          setDownloadJob(job);
          if (job.status === 'ready') {
            if (window.sonicDesktop?.isDesktop && job.filePath) {
              const result = await window.sonicDesktop.openUpdateInstaller(job.filePath);
              if (!result?.ok) {
                setUpdateStatus(`${t('ui.text.344', lang)}${result?.error ? `: ${result.error}` : ''}`);
                setShowUpdateReleaseFallback(true);
                return;
              }
            }
            setUpdateStatus(t('ui.text.33', lang));
            return;
          }
          if (job.status === 'failed') {
            setUpdateStatus(t('ui.text.343', lang));
            setShowUpdateReleaseFallback(true);
            return;
          }
          const total = Number(job.total || 0);
          const progress = total > 0
            ? `${formatBytes(job.received)} / ${formatBytes(total)}`
            : `已下载 ${formatBytes(job.received)}`;
          setUpdateStatus(`正在通过 ${job.channelName || t('ui.text.35', lang)} 下载... ${progress}`);
          updatePollTimerRef.current = window.setTimeout(poll, 1000);
        } catch (error) {
          console.warn('Unable to poll update download:', error);
          setUpdateStatus(t('ui.text.36', lang));
        }
      };
      void poll();
    } catch (error) {
      console.warn('Unable to start update download:', error);
      setUpdateStatus(t('ui.text.37', lang));
    }
  };

  const openUpdateRelease = async () => {
    const releaseUrl = downloadJob?.releaseUrl || availableUpdate?.release?.htmlUrl || '';
    if (!releaseUrl || !window.sonicDesktop?.isDesktop) return;
    const result = await window.sonicDesktop.openUpdateRelease(releaseUrl);
    if (!result?.ok) setUpdateStatus(`${t('ui.text.346', lang)}${result?.error ? `: ${result.error}` : ''}`);
  };

  const remindUpdateLater = () => setShowUpdatePrompt(false);
  const skipThisUpdateVersion = () => {
    const version = availableUpdate?.latestVersion || '';
    writeSkippedUpdateVersionStorage(version);
    setSkippedUpdateVersion(version);
    setShowUpdatePrompt(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void checkForUpdate({ silent: true }), 5000);
    return () => window.clearTimeout(timer);
  }, [skippedUpdateVersion]);

  useEffect(() => clearUpdatePollTimer, []);

  return {
    updateStatus,
    isCheckingUpdate,
    availableUpdate,
    showUpdatePrompt,
    downloadJob,
    showUpdateReleaseFallback,
    checkForUpdate,
    startUpdateDownload,
    openUpdateRelease,
    remindUpdateLater,
    skipThisUpdateVersion,
  };
}
