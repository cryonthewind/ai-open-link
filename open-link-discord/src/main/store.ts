import Store from 'electron-store'

export interface AppSettings {
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

const schema = {
  discordToken: {
    type: 'string',
    default: ''
  },
  selectedGuildId: {
    type: 'string',
    default: ''
  },
  selectedChannelId: {
    type: 'string',
    default: ''
  },
  keywords: {
    type: 'array',
    default: []
  },
  blacklistKeywords: {
    type: 'array',
    default: []
  },
  targetProfileIds: {
    type: 'array',
    default: []
  },
  targetProfileNames: {
    type: 'array',
    default: []
  },
  logServerUrl: {
    type: 'string',
    default: ''
  },
  testLinks: {
    type: 'array',
    default: []
  }
} as const;

let storeInstance: Store<AppSettings> | null = null

export async function initStore(): Promise<void> {
  // Use dynamic import instead of require to properly load the ESM module in recent Vite/Electron builds
  const StoreModule = await import('electron-store')
  const StoreClass = StoreModule.default as any

  storeInstance = new StoreClass({
    schema,
    name: 'open-link-discord-settings'
  })
}

export const store = {
  get store(): AppSettings {
    return storeInstance ? (storeInstance.store as AppSettings) : ({} as AppSettings)
  },
  set(settings: Partial<AppSettings>) {
    if (storeInstance) {
      storeInstance.set(settings as any)
    }
  }
}
