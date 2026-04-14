import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getChromeProfiles: () => ipcRenderer.invoke('get-chrome-profiles'),
  connectDiscord: (token: string) => ipcRenderer.invoke('connect-discord', token),
  disconnectDiscord: () => ipcRenderer.invoke('disconnect-discord'),
  getDiscordData: () => ipcRenderer.invoke('get-discord-data'),
  testReadLatestMessage: () => ipcRenderer.invoke('test-read-latest-message'),
  onAppLog: (callback: (log: any) => void) => {
    const fn = (_event, value) => callback(value)
    ipcRenderer.on('app-log', fn)
    return () => ipcRenderer.removeListener('app-log', fn)
  },
  onProfileOpened: (callback: (info: any) => void) => {
    const fn = (_event, value) => callback(value)
    ipcRenderer.on('profile-opened', fn)
    return () => ipcRenderer.removeListener('profile-opened', fn)
  },
  closeChromeWindow: (windowId: number) => ipcRenderer.invoke('close-chrome-window', windowId),
  closeAllChromeWindows: (windowIds: number[]) => ipcRenderer.invoke('close-all-chrome-windows', windowIds),
  closeApp: () => ipcRenderer.invoke('close-app'),
  openUrlInChrome: (url: string, profileId: string) => ipcRenderer.invoke('open-url-in-chrome', url, profileId),

  // 7net Zaiko Integrations
  login7net: (creds: any) => ipcRenderer.invoke('login-7net', creds),
  startMonitoring: (config: any) => ipcRenderer.send('start-monitoring', config),
  stopMonitoring: () => ipcRenderer.send('stop-monitoring'),
  
  // Timer Integrations
  startTimer: (minutes: number) => ipcRenderer.invoke('start-timer', minutes),
  stopTimer: () => ipcRenderer.invoke('stop-timer'),
  getTimerRemaining: () => ipcRenderer.invoke('get-timer-remaining'),
  onTimerTick: (callback: (remaining: number | null) => void) => {
    const fn = (_event, value) => callback(value)
    ipcRenderer.on('timer-tick', fn)
    return () => ipcRenderer.removeListener('timer-tick', fn)
  },

  // Event Listeners for 7net
  onLogMessage: (callback: any) => {
    const fn = (_event: any, msg: string) => callback(_event, msg)
    ipcRenderer.on('log-message', fn)
    return () => ipcRenderer.off('log-message', fn)
  },
  onStatusChange: (callback: any) => {
    const fn = (_event: any, status: string) => callback(_event, status)
    ipcRenderer.on('status-change', fn)
    return () => ipcRenderer.off('status-change', fn)
  },
  onCookieUpdated: (callback: any) => {
    const fn = (_event: any, cookie: string) => callback(_event, cookie)
    ipcRenderer.on('cookie-updated', fn)
    return () => ipcRenderer.off('cookie-updated', fn)
  },
  exportKeywords: (keywords: string[], type: 'Whitelist' | 'Blacklist') => ipcRenderer.invoke('export-keywords', keywords, type),
  importKeywords: () => ipcRenderer.invoke('import-keywords')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
