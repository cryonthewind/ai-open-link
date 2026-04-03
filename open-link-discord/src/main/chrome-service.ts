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
 * Returns the window ID of the opened Chrome window (macOS only) for tracking.
 */
export function openUrlInChrome(url: string, profileDir: string, bounds?: { x: number; y: number; width: number; height: number }): Promise<{ success: boolean; windowId?: number }> {
    return new Promise((resolve) => {
        const { exec } = require('child_process')
        const platform = os.platform()

        let command = ''
        let boundsArgs = ''

        if (bounds) {
            boundsArgs = `--window-position=${Math.round(bounds.x)},${Math.round(bounds.y)} --window-size=${Math.round(bounds.width)},${Math.round(bounds.height)} `
        }

        if (platform === 'darwin') {
            const globalPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            const userPath = path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')
            const chromeBinary = fs.existsSync(globalPath) ? globalPath : fs.existsSync(userPath) ? userPath : null
            if (chromeBinary) {
                // Use --new-tab: if a Chrome window with this profile is already open,
                // Chrome will open the URL in a new tab in that window.
                // If not open yet, Chrome will open a new window for this profile.
                const safeUrl = url.replace(/"/g, '\\"')
                command = `"${chromeBinary}" --profile-directory="${profileDir}" ${boundsArgs}--new-tab "${safeUrl}"`
            } else {
                command = `open -a "Google Chrome" --args --profile-directory="${profileDir}" ${boundsArgs}"${url}"`
            }
        } else if (platform === 'win32') {
            command = `start chrome --profile-directory="${profileDir}" ${boundsArgs}"${url}"`
        } else {
            command = `google-chrome --profile-directory="${profileDir}" ${boundsArgs}"${url}"`
        }

        exec(command, (error: any) => {
            if (error) {
                console.error(`Error opening Chrome: ${error.message}`)
                resolve({ success: false })
            } else {
                // Return success immediately to the UI so it feels instant
                resolve({ success: true })

                // Window ID tracking (macOS only) can happen in the background if bounds are provided
                if (platform === 'darwin' && bounds) {
                    setTimeout(() => {
                        const script = `tell application "Google Chrome"
                            set bounds of front window to {${Math.round(bounds.x)}, ${Math.round(bounds.y)}, ${Math.round(bounds.x + bounds.width)}, ${Math.round(bounds.y + bounds.height)}}
                            get id of front window
                        end tell`
                        
                        exec(`osascript -e '${script}'`, (scriptError: any, _stdout: string) => {
                            if (scriptError) {
                                console.error(`Background window ID retrieval failed (ignoring): ${scriptError.message}`)
                                // The windowId is retrieved via osascript but currently not used.
                                // We could dispatch an event here if needed.
                            }
                        });
                    }, 500);
                }
            }
        })
    })
}

/**
 * Closes a specific Chrome window by its macOS window ID.
 */
export function closeChromeWindow(windowId: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (os.platform() !== 'darwin') {
            console.warn('closeChromeWindow is only supported on macOS');
            return resolve(false);
        }

        const { exec } = require('child_process');
        const script = `
            tell application "Google Chrome"
                try
                    close (every window whose id is ${windowId})
                end try
            end tell
        `;

        exec(`osascript -e '${script}'`, (error: any) => {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const logPath = path.join(os.homedir(), 'Desktop', 'app-close-debug.txt');
            try {
                fs.appendFileSync(logPath, `Attempted close ${windowId}. Error: ${error}\n`);
            } catch (e) { }

            if (error) {
                console.error(`Error closing Chrome window ${windowId}: ${error.message}`);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Closes multiple Chrome windows by their macOS window IDs.
 */
export function closeAllChromeWindows(windowIds: number[]): Promise<boolean> {
    return new Promise((resolve) => {
        if (os.platform() !== 'darwin') {
            console.warn('closeAllChromeWindows is only supported on macOS');
            return resolve(false);
        }

        if (!windowIds || windowIds.length === 0) {
            return resolve(true);
        }

        const { exec } = require('child_process');
        // Build an AppleScript that iterates and closes the matching windows
        const idListStr = windowIds.join(', ');
        const script = `
            tell application "Google Chrome"
                set idsToClose to {${idListStr}}
                repeat with winId in idsToClose
                    try
                        close (every window whose id is winId)
                    end try
                end repeat
            end tell
        `;

        exec(`osascript -e '${script}'`, (error: any) => {
            if (error) {
                console.error(`Error closing Chrome windows: ${error.message}`);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}
