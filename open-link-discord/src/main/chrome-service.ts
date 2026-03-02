import fs from 'fs'
import path from 'path'
import os from 'os'

export interface ChromeProfile {
    id: string
    name: string
    avatar?: string
}

/**
 * Returns the path to the Google Chrome user data directory based on the OS.
 */
function getChromeDataDir(): string {
    const homeDir = os.homedir()
    const platform = os.platform()

    switch (platform) {
        case 'darwin':
            return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome')
        case 'win32':
            return path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
        case 'linux':
            return path.join(homeDir, '.config', 'google-chrome')
        default:
            console.warn(`Unsupported platform for Chrome profile parsing: ${platform}`)
            return ''
    }
}

/**
 * Reads the 'Local State' file inside the Chrome User Data directory.
 * This file contains metadata about all the locally available Chrome profiles.
 */
export function getChromeProfiles(): ChromeProfile[] {
    const chromeDataDir = getChromeDataDir()
    if (!chromeDataDir) return []

    const localStatePath = path.join(chromeDataDir, 'Local State')
    if (!fs.existsSync(localStatePath)) {
        console.error(`Chrome Local State file not found at: ${localStatePath}`)
        return []
    }

    try {
        const localStateRaw = fs.readFileSync(localStatePath, 'utf8')
        const localState = JSON.parse(localStateRaw)

        // The profile cache holds all profiles known by Chrome.
        // Example keys: "Default", "Profile 1", "Profile 2"
        const profileCache = localState?.profile?.info_cache

        if (!profileCache) {
            console.warn('Could not find profile.info_cache in Local State')
            return []
        }

        const profiles: ChromeProfile[] = []

        for (const [dirName, profileData] of Object.entries<any>(profileCache)) {
            // Chrome tends to flag guest/system profiles differently, though we usually just want any valid user profile.
            profiles.push({
                id: dirName,
                name: profileData.name || dirName,
                avatar: profileData.avatar_icon
            })
        }

        // Sort alphabetically by name
        profiles.sort((a, b) => a.name.localeCompare(b.name))

        return profiles
    } catch (error) {
        console.error('Failed to parse Chrome Local State file:', error)
        return []
    }
}

/**
 * Opens a given URL in Google Chrome using the specified profile directory.
 * Works natively on macOS. Needs adaptation for Windows/Linux if required.
 */
export function openUrlInChrome(url: string, profileDir: string): Promise<boolean> {
    return new Promise((resolve) => {
        const { exec } = require('child_process')
        const platform = os.platform()

        let command = ''

        if (platform === 'darwin') {
            command = `open -na "Google Chrome" --args --profile-directory="${profileDir}" "${url}"`
        } else if (platform === 'win32') {
            command = `start chrome --profile-directory="${profileDir}" "${url}"`
        } else {
            command = `google-chrome --profile-directory="${profileDir}" "${url}"`
        }

        exec(command, (error: any) => {
            if (error) {
                console.error(`Error opening Chrome: ${error.message}`)
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}
