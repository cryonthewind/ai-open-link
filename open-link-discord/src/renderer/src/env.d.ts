/// <reference types="vite/client" />

export interface SettingsType {
    discordToken: string | null
    selectedGuildId: string | null
    selectedChannelId: string | null
    keywords: string[]
    blacklistKeywords: string[]
    targetProfileIds: string[]
    targetProfileNames: string[]
    logServerUrl: string | null
    testLinks: { product: string; url: string }[]
    // 7net Zaiko Settings
    zaikoUrl?: string
    zaikoEmail?: string
    zaikoPassword?: string
    zaikoCookie?: string
    zaikoDiscord?: string
}

export interface ChromeProfile {
    id: string
    name: string
    avatar?: string
}

export interface DiscordChannel {
    id: string
    name: string
}

export interface DiscordGuild {
    id: string
    name: string
    icon: string
    channels: DiscordChannel[]
}

export interface IElectronAPI {
    getSettings: () => Promise<SettingsType>
    saveSettings: (settings: Partial<SettingsType>) => Promise<boolean>
    getChromeProfiles: () => Promise<ChromeProfile[]>
    connectDiscord: (token: string) => Promise<{ success: boolean; error?: string }>
    disconnectDiscord: () => Promise<boolean>
    getDiscordData: () => Promise<DiscordGuild[]>
    testReadLatestMessage: () => Promise<any>
    onAppLog: (callback: (log: AppLog) => void) => (() => void)
    onProfileOpened: (callback: (info: any) => void) => (() => void)
    closeChromeWindow: (windowId: number) => Promise<boolean>
    closeAllChromeWindows: (windowIds: number[]) => Promise<boolean>
    closeApp: () => Promise<boolean>
    openUrlInChrome: (url: string, profileId: string) => Promise<{ success: boolean; windowId?: number }>
    
    // 7net Zaiko API Integration
    login7net: (creds: { email?: string; password?: string }) => Promise<{ success: boolean; cookie?: string; error?: string }>
    startMonitoring: (config: { url: string; email?: string; password?: string; cookie?: string; discord?: string }) => void
    stopMonitoring: () => void
    
    // Event Listeners for Zaiko
    onLogMessage: (callback: (event: any, msg: string) => void) => (() => void)
    onStatusChange: (callback: (event: any, status: string) => void) => (() => void)
    onCookieUpdated: (callback: (event: any, cookie: string) => void) => (() => void)
    
    // Timer API
    startTimer: (minutes: number) => Promise<boolean>
    stopTimer: () => Promise<boolean>
    getTimerRemaining: () => Promise<number | null>
    onTimerTick: (callback: (remaining: number | null) => void) => (() => void)

    exportKeywords: (keywords: string[], type: 'Whitelist' | 'Blacklist') => Promise<boolean>
    importKeywords: () => Promise<string[] | null>
}

export interface AppLog {
    timestamp: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
}

declare global {
    interface Window {
        electron: any
        api: IElectronAPI
    }
}
