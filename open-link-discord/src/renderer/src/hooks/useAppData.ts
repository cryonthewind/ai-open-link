import { useState, useEffect } from 'react'
import { SettingsType, ChromeProfile, DiscordGuild } from '../env'

export function useAppData() {
    const [settings, setSettings] = useState<SettingsType | null>(null)
    const [profiles, setProfiles] = useState<ChromeProfile[]>([])
    const [guilds, setGuilds] = useState<DiscordGuild[]>([])
    const [discordStatus, setDiscordStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'ERROR'>('DISCONNECTED')
    const [loading, setLoading] = useState(true)

    const loadInitialData = async () => {
        setLoading(true)
        const storedSettings = await window.api.getSettings()
        const chromeProfiles = await window.api.getChromeProfiles()

        setSettings(storedSettings)
        setProfiles(chromeProfiles)

        // Auto connect if token exists
        if (storedSettings.discordToken) {
            await connectDiscord(storedSettings.discordToken)
        }

        setLoading(false)
    }

    const connectDiscord = async (token: string) => {
        setDiscordStatus('DISCONNECTED')
        const res = await window.api.connectDiscord(token)
        if (res.success) {
            setDiscordStatus('CONNECTED')
            const data = await window.api.getDiscordData()
            setGuilds(data)
        } else {
            setDiscordStatus('ERROR')
            console.error(res.error)
        }
    }

    const disconnectDiscord = async () => {
        await window.api.disconnectDiscord()
        setDiscordStatus('DISCONNECTED')
        setGuilds([])
    }

    const updateSettings = async (partial: Partial<SettingsType>) => {
        await window.api.saveSettings(partial)
        setSettings(prev => prev ? { ...prev, ...partial } : null)
    }

    useEffect(() => {
        loadInitialData()
    }, [])

    return {
        settings,
        profiles,
        guilds,
        discordStatus,
        loading,
        connectDiscord,
        disconnectDiscord,
        updateSettings
    }
}
