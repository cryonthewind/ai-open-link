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
  onAppLog: (callback: (log: any) => void) => ipcRenderer.on('app-log', (_event, value) => callback(value)),
  onProfileOpened: (callback: (info: any) => void) => ipcRenderer.on('profile-opened', (_event, value) => callback(value)),
  closeChromeWindow: (windowId: number) => ipcRenderer.invoke('close-chrome-window', windowId),
  closeAllChromeWindows: (windowIds: number[]) => ipcRenderer.invoke('close-all-chrome-windows', windowIds),
  closeApp: () => ipcRenderer.invoke('close-app'),
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
