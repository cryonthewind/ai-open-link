import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<boolean>
      getChromeProfiles: () => Promise<any>
      connectDiscord: (token: string) => Promise<any>
      disconnectDiscord: () => Promise<boolean>
      getDiscordData: () => Promise<any>
      testReadLatestMessage: () => Promise<any>
      onAppLog: (callback: (log: any) => void) => void
      
      // 7net Zaiko APIs
      login7net: (creds: any) => Promise<any>
      startMonitoring: (config: any) => void
      stopMonitoring: () => void
      
      // Event Listeners
      onLogMessage: (callback: (event: any, msg: string) => void) => () => void
      onStatusChange: (callback: (event: any, status: string) => void) => () => void
      onCookieUpdated: (callback: (event: any, cookie: string) => void) => () => void
      
      // Chrome/App Controls
      closeChromeWindow: (windowId: number) => Promise<boolean>
      closeAllChromeWindows: (windowIds: number[]) => Promise<boolean>
      closeApp: () => Promise<boolean>
      openUrlInChrome: (url: string, profileId: string) => Promise<any>
    }
  }
}
