import { Client } from 'discord.js-selfbot-v13'
import { store } from './store'
import { openUrlInChrome } from './chrome-service'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

let mainWindow: BrowserWindow | null = null

export function initDiscordService(win: BrowserWindow) {
    mainWindow = win
}

export function dispatchLog(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
    const log = {
        timestamp: new Date().toISOString(),
        message: String(message), // Ensure it's a string
        type
    }
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-log', log)
    } else {
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) w.webContents.send('app-log', log)
        })
    }

    if (type === 'error') console.error(message)
    else if (type === 'warning') console.warn(message)
    else console.log(message)
}

let client: Client | null = null

/**
 * Extracts all standard HTTP/HTTPS URLs from a given text.
 */
function extractUrls(text: string): string[] {
    if (!text) return []
    // Match URLs but avoid trailing markdown/discord characters like <, >, ), or ]
    const urlRegex = /(https?:\/\/[^\s<)\]>"']+)/g
    const matches = text.match(urlRegex)
    return matches || []
}

/**
 * Normalizes a URL for deduplication purposes.
 * Handles trailing slashes, site-specific variations (like Yodobashi's /ec/), 
 * and removes query parameters if they don't seem like product identifiers.
 */
function normalizeUrl(url: string): string {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        let hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        let pathname = urlObj.pathname.replace(/\/+$/, '');

        // Site-specific normalizations
        if (hostname.includes('yodobashi.com')) {
            // Yodobashi uses /ec/product/ and /product/ interchangeably
            pathname = pathname.replace(/^\/ec\//, '/');
        } else if (hostname.includes('amazon.')) {
            // Amazon product URLs often have a lot of junk before /dp/ASIN
            const asinMatch = pathname.match(/\/dp\/([A-Z0-9]{10})/i);
            if (asinMatch) {
                pathname = `/dp/${asinMatch[1]}`;
            }
        }

        // We use hostname + pathname as a unique key. 
        // We usually ignore query params for stock alerts as they are mostly tracking/affiliate tags.
        return `${hostname}${pathname}`;
    } catch (e) {
        // Fallback for malformed URLs
        return url.toLowerCase().trim().replace(/\/+$/, '');
    }
}

/**
 * Common Webhook sender that supports App Start, App Stop, and Link Opened messages.
 */
export async function sendWebhookLog(currentSettings: any, type: 'link' | 'start' | 'stop', data?: any) {
    const urlString = currentSettings.logServerUrl;
    if (!urlString) return;

    try {
        let finalPayload: any = {};
        const isDiscord = urlString.includes('discord.com/api/webhooks');

        if (type === 'link') {
            const { url, message, profileNames } = data;

            const profileDisplay = Array.isArray(profileNames) && profileNames.length > 0
                ? profileNames.join(', ')
                : 'N/A';

            const payload = {
                url: url,
                timestamp: new Date().toISOString(),
                channelId: message.channelId,
                guildId: message.guildId,
                profileNames: profileNames
            };
            finalPayload = payload;

            if (isDiscord) {
                finalPayload = {
                    content: null,
                    embeds: [
                        {
                            title: "🔗 Mở Link Thành Công",
                            description: `Ứng dụng vừa tự động mở một liên kết.`,
                            color: 4437375, // Indigo
                            fields: [
                                { name: "URL", value: `[${url}](${url})` },
                                { name: "Channel ID", value: message.channelId, inline: true },
                                { name: "Server ID", value: message.guildId || 'N/A', inline: true },
                                { name: "Google Profile(s)", value: profileDisplay }
                            ],
                            timestamp: payload.timestamp
                        }
                    ]
                }
            }
        } else if (type === 'start') {
            finalPayload = { message: "App started", timestamp: new Date().toISOString() };
            if (isDiscord) {
                finalPayload = {
                    content: null,
                    embeds: [{
                        title: "🟢 Ứng Dụng Đã Khởi Động",
                        description: "Discord Link Opener đã được bật và đang bắt đầu chờ kết nối...",
                        color: 5763719, // Green
                        timestamp: new Date().toISOString()
                    }]
                }
            }
        } else if (type === 'stop') {
            finalPayload = { message: "App stopped", timestamp: new Date().toISOString() };
            if (isDiscord) {
                finalPayload = {
                    content: null,
                    embeds: [{
                        title: "🔴 Ứng Dụng Đã Tắt",
                        description: "Discord Link Opener đã ngưng hoạt động.",
                        color: 15548997, // Red
                        timestamp: new Date().toISOString()
                    }]
                }
            }
        }

        await fetch(urlString, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });
        dispatchLog(`Logged to webhook successfully (${type}).`, 'success');
    } catch (err) {
        dispatchLog(`Failed to send log to webhook endpoint: ${err}`, 'error');
    }
}

/**
 * Checks if the text contains any of the provided keywords (ignoring spaces and case).
 * Returns the matched keyword if found, otherwise null.
 */
function getMatchedKeyword(text: string, keywords: string[]): string | null {
    if (!keywords || keywords.length === 0) return null

    // Remove all whitespace characters (spaces, newlines, tabs) for robust matching
    const normalizedText = text.toLowerCase().replace(/\s+/g, '')

    for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '')
        if (normalizedKeyword && normalizedText.includes(normalizedKeyword)) {
            return keyword
        }
    }
    return null
}

const rawMessageCache = new Map<string, any>();
const urlRateLimitCache = new Map<string, number>();
const processedMessageCache = new Map<string, number>();
const messageContentCache = new Map<string, number>();

const messageProcessQueue: Array<() => Promise<boolean | void>> = [];
let isMessageQueueProcessing = false;

async function processMessageQueue() {
    if (isMessageQueueProcessing) return;
    isMessageQueueProcessing = true;
    while (messageProcessQueue.length > 0) {
        const task = messageProcessQueue.shift();
        if (task) {
            try {
                const didOpenWindow = await task();
                if (didOpenWindow) {
                    // Nếu thực sự có mở URL, nghỉ 2 giây rồi mới xử lý tin nhắn tiếp theo
                    // để tránh mở cả chục tab cùng một lúc gây nghẽn máy
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (e) {
                console.error("Task queue error", e);
            }
        }
    }
    isMessageQueueProcessing = false;
}

export async function connectDiscord(token: string) {
    if (client) {
        client.removeAllListeners()
        client.destroy()
    }

    client = new (Client as any)({
        checkUpdate: false
    })

    client!.on('ready', async () => {
        dispatchLog(`Discord self-bot connected as ${client?.user?.username}`, 'success')
        // Send event to renderer
    })

    client!.on('raw', (packet) => {
        if (packet.t === 'MESSAGE_CREATE' || packet.t === 'MESSAGE_UPDATE') {
            if (packet.d && packet.d.id) {
                rawMessageCache.set(packet.d.id, packet.d);
                if (rawMessageCache.size > 200) {
                    const firstKey = rawMessageCache.keys().next().value;
                    if (firstKey) rawMessageCache.delete(firstKey);
                }
            }
        }
    })

    client!.on('messageCreate', async (message) => {
        // 0. Deduplicate identical messages to prevent double triggering
        const nowMs = Date.now();
        if (processedMessageCache.has(message.id)) return;
        processedMessageCache.set(message.id, nowMs);

        for (const [msgId, timestamp] of processedMessageCache.entries()) {
            if (nowMs - timestamp > 5 * 60 * 1000) processedMessageCache.delete(msgId);
        }

        // 1. Check if the message is from the selected channel
        const currentSettings = store.store
        if (message.channelId !== currentSettings.selectedChannelId) return

        let fullText = message.content || ''
        let urls: string[] = extractUrls(message.content || '')

        // DEBUG DUMP
        try {
            const dumpPath = path.join(os.homedir(), 'Desktop', 'discord-msg-dump.txt')
            const dumpData = `\n--- MESSAGE RECEIVED AT ${new Date().toISOString()} ---\n` + JSON.stringify(message.toJSON() || {}, null, 2) + '\n'
            fs.appendFileSync(dumpPath, dumpData)
        } catch (e) { }

        // Also extract from any attachments just in case it's in the URL
        if (message.attachments && message.attachments.size > 0) {
            message.attachments.forEach(attachment => {
                fullText += '\n' + attachment.url
                urls.push(attachment.url)
            })
        }

        if (message.embeds && message.embeds.length > 0) {
            for (const embed of message.embeds) {
                if (embed.title) fullText += '\n' + embed.title
                if (embed.description) fullText += '\n' + embed.description
                if (embed.author?.name) fullText += '\n' + embed.author.name
                if (embed.footer?.text) fullText += '\n' + embed.footer.text
                if (embed.fields) {
                    for (const field of embed.fields) {
                        fullText += '\n' + field.name + '\n' + field.value
                    }
                }

                // Add explicit URLs from embeds
                if (embed.url) urls.push(embed.url)
                if (embed.author?.url) urls.push(embed.author.url)

                // Extract URLs from embed text fields
                if (embed.title) urls.push(...extractUrls(embed.title))
                if (embed.description) urls.push(...extractUrls(embed.description))
                if (embed.fields) {
                    for (const field of embed.fields) {
                        urls.push(...extractUrls(field.name))
                        urls.push(...extractUrls(field.value))
                    }
                }
            }

            if (message.type === 'REPLY' && message.reference && message.reference.messageId) {
                // Try to get the original message from cache
                const referencedMessage = message.channel.messages.cache.get(message.reference.messageId)
                if (referencedMessage) {
                    fullText += '\n[REFERENCED] ' + referencedMessage.content
                    urls.push(...extractUrls(referencedMessage.content || ''))

                    if (referencedMessage.embeds && referencedMessage.embeds.length > 0) {
                        for (const embed of referencedMessage.embeds) {
                            if (embed.title) fullText += '\n' + embed.title
                            if (embed.description) fullText += '\n' + embed.description
                            if (embed.author?.name) fullText += '\n' + embed.author.name
                            if (embed.footer?.text) fullText += '\n' + embed.footer.text
                            if (embed.fields) {
                                for (const field of embed.fields) {
                                    fullText += '\n' + field.name + '\n' + field.value
                                }
                            }
                            if (embed.url) urls.push(embed.url)
                            if (embed.author?.url) urls.push(embed.author.url)
                            if (embed.title) urls.push(...extractUrls(embed.title))
                            if (embed.description) urls.push(...extractUrls(embed.description))
                            if (embed.fields) {
                                for (const field of embed.fields) {
                                    urls.push(...extractUrls(field.name))
                                    urls.push(...extractUrls(field.value))
                                }
                            }
                        }
                    }
                }
            }

            // Also check message snapshots (new discord forwarding feature) using RAW CACHE
            try {
                const rawPacket = rawMessageCache.get(message.id);
                if (rawPacket && rawPacket.message_snapshots && Array.isArray(rawPacket.message_snapshots)) {
                    for (const snapshotRef of rawPacket.message_snapshots) {
                        const snapshot = snapshotRef;
                        if (snapshot && typeof snapshot === 'object' && snapshot.message) {
                            if (snapshot.message.content) {
                                fullText += '\n[SNAPSHOT] ' + snapshot.message.content
                                urls.push(...extractUrls(snapshot.message.content))
                            }
                            if (snapshot.message.embeds && Array.isArray(snapshot.message.embeds)) {
                                for (const embed of snapshot.message.embeds) {
                                    if (embed.title) fullText += '\n' + embed.title
                                    if (embed.description) fullText += '\n' + embed.description
                                    if (embed.url) urls.push(embed.url)
                                    if (embed.author?.url) urls.push(embed.author.url)
                                    if (embed.fields && Array.isArray(embed.fields)) {
                                        for (const field of embed.fields) {
                                            fullText += '\n' + field.name + '\n' + field.value
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Fallback to library parsing if cache missed
                    const rawMsg = message as any
                    if (rawMsg.messageSnapshots && Array.isArray(rawMsg.messageSnapshots) && rawMsg.messageSnapshots.length > 0) {
                        for (const snapshotRef of rawMsg.messageSnapshots) {
                            // Some discord clients send snapshots as objects, some as IDs
                            const snapshot = typeof snapshotRef === 'object' ? snapshotRef : rawMsg.client.channels.cache.get(message.channelId)?.messages.cache.get(snapshotRef);

                            if (snapshot && typeof snapshot === 'object') {
                                if (snapshot.message?.content) {
                                    fullText += '\n[SNAPSHOT] ' + snapshot.message.content
                                    urls.push(...extractUrls(snapshot.message.content))
                                }
                                if (snapshot.message?.embeds) {
                                    for (const embed of snapshot.message.embeds) {
                                        if (embed.title) fullText += '\n' + embed.title
                                        if (embed.description) fullText += '\n' + embed.description
                                        if (embed.fields) {
                                            for (const field of embed.fields) {
                                                fullText += '\n' + field.name + '\n' + field.value
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) { }
        }

        // Cleanup cache just in case
        rawMessageCache.delete(message.id);

        // Handle raw message references/forwards if content is hidden
        if (fullText.trim().length === 0 || urls.length === 0) {
            // Fetch raw message payload from Discord API directly to bypass library limitations with message_snapshots
            try {
                const res = await fetch(`https://discord.com/api/v9/channels/${message.channelId}/messages/${message.id}`, {
                    headers: { 'Authorization': token }
                })
                if (res.ok) {
                    const rawJsonObj = await res.json()

                    if (rawJsonObj.message_snapshots && Array.isArray(rawJsonObj.message_snapshots)) {
                        for (const snapshot of rawJsonObj.message_snapshots) {
                            if (snapshot && typeof snapshot === 'object' && snapshot.message) {
                                if (snapshot.message.content) {
                                    fullText += '\n[REST SNAPSHOT] ' + snapshot.message.content
                                    urls.push(...extractUrls(snapshot.message.content))
                                }
                                if (snapshot.message.embeds && Array.isArray(snapshot.message.embeds)) {
                                    for (const embed of snapshot.message.embeds) {
                                        if (embed.title) fullText += '\n' + embed.title
                                        if (embed.description) fullText += '\n' + embed.description
                                        if (embed.url) urls.push(embed.url)
                                        if (embed.author?.url) urls.push(embed.author.url)
                                        if (embed.fields && Array.isArray(embed.fields)) {
                                            for (const field of embed.fields) {
                                                fullText += '\n' + field.name + '\n' + field.value
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        const rawJsonStr = JSON.stringify(rawJsonObj || {})
                        fullText += '\n[REST API DATA] ' + rawJsonStr
                        const rawUrls = rawJsonStr.match(/(https?:\/\/[^\s<)\]>"']+)/g) || []
                        urls.push(...rawUrls)
                    }
                }
            } catch (e) {
                dispatchLog(`Failed to fetch raw message API: ${e}`, 'warning')
            }
        }

        let preview = fullText ? fullText.replace(/\n/g, ' ').substring(0, 100) : ''
        dispatchLog(`[Channel] Msg received: ${preview}`, 'info')



        // Deduplicate URLs and ignore Discord's internal/avatar URLs
        let uniqueUrls = [...new Set(urls)]
        uniqueUrls = uniqueUrls.filter(u => !u.includes('discord.com/') && !u.includes('discordapp.com/') && !u.includes('discordapp.net/'));
        urls = uniqueUrls;

        // 2. Check keywords (Whitelist)
        const keywords = currentSettings.keywords || []
        const matchedWhitelist = getMatchedKeyword(fullText, keywords)
        if (!matchedWhitelist) {
            dispatchLog(`Ignored: No whitelist keywords matched. Keywords: [${keywords.join(', ')}]`, 'warning')
            return
        }

        // 2.5 Check Blocklist
        const blacklistKeywords = currentSettings.blacklistKeywords || []
        const matchedBlacklist = getMatchedKeyword(fullText, blacklistKeywords)
        if (matchedBlacklist) {
            dispatchLog(`Ignored: Hit blacklist keyword "${matchedBlacklist}".`, 'warning')
            return
        }

        // 3. Extract URLs
        if (urls.length === 0) {
            dispatchLog(`Ignored: Whitelist matched ("${matchedWhitelist}"), but no URLs found in message.`, 'warning')
            return
        }

        // We only want to open the first valid link found, to prevent opening multiple 
        // secondary links (like author profiles, StockX, etc) contained in the same message.
        urls = [urls[0]]
        const urlToOpen = urls[0];

        // 4. Enqueue the URL opening to prevent race conditions and Applescript crashes when multiple messages arrive instantly
        messageProcessQueue.push(async () => {
            const RATE_LIMIT_MS = 3 * 60 * 1000;
            const now = Date.now();

            // Check the cache again inside the serial queue block
            const normalizedUrl = normalizeUrl(urlToOpen);
            const lastOpened = urlRateLimitCache.get(normalizedUrl);
            if (lastOpened && now - lastOpened < RATE_LIMIT_MS) {
                const remainingSecs = Math.ceil((RATE_LIMIT_MS - (now - lastOpened)) / 1000);
                dispatchLog(`Ignored (Queue): URL and resource node already active. Cooldown: ${remainingSecs}s remaining.`, 'warning');
                return false;
            }

            // Also check message content to prevent duplicate triggers from identical messages without catching URL changes
            // Improved hashing: Keep digits (IDs), remove emojis/punctuation which bots rotate to bypass filters
            const contentHash = fullText
                .toLowerCase()
                .replace(/[^\p{L}\p{N}]/gu, '') // Keep letters and numbers only, remove emojis/punctuation
                .substring(0, 500);

            if (contentHash.length > 10) {
                const lastContentTime = messageContentCache.get(contentHash);
                if (lastContentTime && now - lastContentTime < RATE_LIMIT_MS) {
                    const remainingSecs = Math.ceil((RATE_LIMIT_MS - (now - lastContentTime)) / 1000);
                    dispatchLog(`Ignored (Queue): Identical message content detected. Cooldown: ${remainingSecs}s remaining.`, 'warning');
                    return false;
                }
                messageContentCache.set(contentHash, now);
            }

            // Immediately reserve this URL in the cache synchronously
            urlRateLimitCache.set(normalizedUrl, now);

            // Clean up old entries to prevent memory leaks
            for (const [cachedUrl, timestamp] of urlRateLimitCache.entries()) {
                if (now - timestamp > RATE_LIMIT_MS) {
                    urlRateLimitCache.delete(cachedUrl);
                }
            }
            for (const [cachedHash, timestamp] of messageContentCache.entries()) {
                if (now - timestamp > RATE_LIMIT_MS) {
                    messageContentCache.delete(cachedHash);
                }
            }

            // 5. Open URLs in target Chrome profile
            const profileIds = currentSettings.targetProfileIds || []

            // Handle legacy storage format if targetProfileIds is empty but targetProfileId exists
            if (profileIds.length === 0 && (currentSettings as any).targetProfileId) {
                profileIds.push((currentSettings as any).targetProfileId)
            }

            if (profileIds.length === 0) {
                dispatchLog('Matching message found, but no target Chrome profile is selected.', 'warning')
                return false;
            }

            dispatchLog(`Opening URL (${urlToOpen}) in ${profileIds.length} profile(s): ${profileIds.join(', ')}`, 'success')

            const totalProfiles = profileIds.length;
            let screenW = 1920;
            let screenH = 1080;
            try {
                const { screen } = require('electron')
                const workArea = screen.getPrimaryDisplay().workAreaSize;
                screenW = workArea.width;
                screenH = workArea.height;
            } catch (e) {
                // fallback if screen is not fully initialized
            }
            const windowWidth = Math.floor(screenW / totalProfiles);

            for (const url of urls) {
                // Open sequentially to allow AppleScript resizing without race conditions
                for (let index = 0; index < profileIds.length; index++) {
                    const profileId = profileIds[index];
                    const bounds = totalProfiles > 1 ? {
                        x: index * windowWidth,
                        y: 0,
                        width: windowWidth,
                        height: screenH
                    } : undefined;

                    const { success, windowId, error } = await openUrlInChrome(url, profileId, bounds)

                    if (success && windowId) {
                        const profileName = (currentSettings as any).targetProfileNames?.[index] || profileId;
                        BrowserWindow.getAllWindows().forEach(w => {
                            w.webContents.send('profile-opened', {
                                url,
                                profileId,
                                profileName,
                                windowId,
                                timestamp: Date.now()
                            });
                        });
                    } else if (!success) {
                        dispatchLog(`Failed to open URL in profile ${profileId}: ${error || 'Unknown error'}`, 'error')
                    }
                }

                // Log to webhook once per link, providing all profile names
                await sendWebhookLog(currentSettings, 'link', {
                    url,
                    message,
                    profileNames: currentSettings.targetProfileNames || []
                })
            }
            return true; // Báo hiệu đã mở cửa sổ thành công để Queue nghỉ 2 giây
        });

        // Trigger the queue processing
        processMessageQueue();
    })

    try {
        await client!.login(token)
        return { success: true }
    } catch (error: any) {
        dispatchLog(`Discord login failed: ${error.message}`, 'error')
        return { success: false, error: error.message }
    }
}

export function disconnectDiscord() {
    if (client) {
        client.destroy()
        client = null
    }
}

export function getGuildsAndChannels() {
    if (!client || !client.isReady()) {
        return []
    }

    const result: any[] = []

    // Note: For User accounts, caching behavior might differ slightly from Bot accounts,
    // but client.guilds.cache should still contain the joined servers.
    client.guilds.cache.forEach(guild => {
        const channels: any[] = []
        guild.channels.cache.forEach(channel => {
            // Filter primarily for Text Channels (type 0) and GUILD_ANNOUNCEMENT (type 5)
            if (channel.isText()) {
                channels.push({
                    id: channel.id,
                    name: channel.name
                })
            }
        })

        result.push({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL() || '',
            channels: channels.sort((a, b) => a.name.localeCompare(b.name))
        })
    })

    return result.sort((a, b) => a.name.localeCompare(b.name))
}

export async function testReadLatestMessage() {
    if (!client || !client.isReady()) {
        dispatchLog('Bot is not connected.', 'error')
        return { success: false, error: 'Not connected' }
    }

    const currentSettings = store.store
    const channelId = currentSettings.selectedChannelId
    if (!channelId) {
        dispatchLog('No channel selected to test.', 'error')
        return { success: false, error: 'No channel selected' }
    }

    try {
        const channel = await client.channels.fetch(channelId)
        if (!channel || !channel.isText()) {
            dispatchLog('Selected channel is not a valid text channel.', 'error')
            return { success: false, error: 'Invalid channel' }
        }

        const messages = await channel.messages.fetch({ limit: 1 })
        const latestMessage = messages.first()

        if (!latestMessage) {
            dispatchLog('No messages found in the selected channel.', 'warning')
            return { success: false, error: 'No messages found' }
        }

        dispatchLog(`Testing latest message: ${latestMessage.id}...`, 'info')
        // We simulate emitting a messageCreate event so it goes through the exact same logic
        client.emit('messageCreate', latestMessage)
        return { success: true }
    } catch (error: any) {
        dispatchLog(`Failed to test latest message: ${error.message}`, 'error')
        return { success: false, error: error.message }
    }
}
