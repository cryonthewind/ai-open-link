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
    onAppLog: (callback: (log: AppLog) => void) => void
    onProfileOpened: (callback: (info: any) => void) => void
    closeChromeWindow: (windowId: number) => Promise<boolean>
    closeAllChromeWindows: (windowIds: number[]) => Promise<boolean>
    closeApp: () => Promise<boolean>
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

