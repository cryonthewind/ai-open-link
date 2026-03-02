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
    }
  }
}
