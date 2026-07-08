const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sonicDesktop', {
  isDesktop: true,
  platform: process.platform,
  supportsSystemAudioLoopback: process.platform === 'win32',
  minimize: () => ipcRenderer.invoke('sonic-window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('sonic-window-toggle-maximize'),
  close: () => ipcRenderer.invoke('sonic-window-close'),
  startWindowDrag: (point) => ipcRenderer.invoke('sonic-window-drag-start', point),
  moveWindowDrag: (point) => ipcRenderer.invoke('sonic-window-drag-move', point),
  endWindowDrag: () => ipcRenderer.invoke('sonic-window-drag-end'),
  openNeteaseLogin: () => ipcRenderer.invoke('sonic-open-netease-login'),
  clearNeteaseLogin: () => ipcRenderer.invoke('sonic-clear-netease-login'),
  openQQLogin: () => ipcRenderer.invoke('sonic-open-qq-login'),
  clearQQLogin: () => ipcRenderer.invoke('sonic-clear-qq-login'),
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('sonic-open-update-installer', filePath),
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
});
