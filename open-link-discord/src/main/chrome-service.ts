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
                if (bounds) {
                    // Direct binary invocation uses Chromium IPC (opens new window when bounds or multiple profiles are used)
                    command = `"${chromeBinary}" --profile-directory="${profileDir}" ${boundsArgs}"${url}"`
                } else {
                    // Single profile handling: to reliably open a new tab instead of a new window on macOS,
                    // we bring the target profile window to the front first, then use AppleScript to open the URL in a new tab.
                    const safeUrl = url.replace(/'/g, "'\\''");
                    command = `"${chromeBinary}" --profile-directory="${profileDir}" & sleep 0.5 && osascript -e 'tell application "Google Chrome" to open location "${safeUrl}"'`
                }
            } else {
                command = `open -n -a "Google Chrome" --args --profile-directory="${profileDir}" ${boundsArgs}"${url}"`
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
                if (platform === 'darwin') {
                    // Give Chrome a moment to open and focus, then force resize via AppleScript
                    setTimeout(() => {
                        let script = ''
                        if (bounds) {
                            script += `set bounds of front window to {${Math.round(bounds.x)}, ${Math.round(bounds.y)}, ${Math.round(bounds.x + bounds.width)}, ${Math.round(bounds.y + bounds.height)}}\n`
                        }
                        script += `get id of front window`

                        const fullScript = `tell application "Google Chrome"\n${script}\nend tell`
                        exec(`osascript -e '${fullScript}'`, (scriptError: any, stdout: string) => {
                            if (scriptError) {
                                console.error(`Error getting Chrome window ID: ${scriptError.message}`)
                                resolve({ success: true })
                            } else {
                                const windowId = parseInt(stdout.trim(), 10)
                                resolve({ success: true, windowId: isNaN(windowId) ? undefined : windowId });
                            }
                        });
                    }, 800);
                } else {
                    resolve({ success: true })
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
