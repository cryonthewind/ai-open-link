import { BrowserWindow } from 'electron'
import { store } from './store'
import axios from 'axios'
import open from 'open'
import { fetchPage } from './zaiko/fetcher'
import { isItemInStock } from './zaiko/parser'

let isMonitoring = false
let checkIntervalId: NodeJS.Timeout | null = null
let mainWindow: BrowserWindow | null = null
let attempts = 0

export function initZaikoService(win: BrowserWindow): void {
  mainWindow = win
}

export async function run7netLogin(creds: { email?: string; password?: string }): Promise<{ success: boolean; cookie?: string; error?: string }> {
  const loginWin = new BrowserWindow({
    width: 800,
    height: 800,
    show: true,
    title: 'Mangekyo Sharingan: 7net Login'
  })

  loginWin.loadURL('https://auth.7id.omni7.jp/login-id/input?sitecd=0001&r_url=https%3A%2F%2F7net.omni7.jp%2Ftop%2F&utm_campaign=7ns_7id-acc&utm_medium=referral&utm_source=7ns')

  loginWin.webContents.on('did-finish-load', () => {
    const currentUrl = loginWin.webContents.getURL()
    if (currentUrl.includes('auth.7id.omni7.jp/login-id/input')) {
      loginWin.webContents.executeJavaScript(`
        (function() {
          let attempts = 0;
          const maxAttempts = 5;
          function tryFill() {
            const idInput = document.querySelector('#input-01');
            const passInput = document.querySelector('#input-02');
            const loginBtn = document.querySelector('#passwordLoginBtn') ||
                             document.querySelector('button[type="submit"]') || 
                             Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ログイン'));
            
            if (idInput && passInput) {
              function setAndTrigger(el, val) {
                if (!el) return;
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
              }
              setAndTrigger(idInput, ${JSON.stringify(creds.email)});
              setAndTrigger(passInput, ${JSON.stringify(creds.password)});
              if (loginBtn && !loginBtn.disabled) loginBtn.click();
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(tryFill, 1000);
            }
          }
          tryFill();
        })();
      `)
    }
  })

  return new Promise((resolve) => {
    let closedExplicitly = false
    const cookieCheckInterval = setInterval(async () => {
      if (loginWin.isDestroyed()) {
        clearInterval(cookieCheckInterval)
        if (!closedExplicitly) resolve({ success: false, error: 'User aborted synchronization.' })
        return
      }

      const cookies = await loginWin.webContents.session.cookies.get({})
      const filteredCookies = cookies.filter(c => c.domain && c.domain.includes('omni7.jp'))
      const currentUrl = loginWin.webContents.getURL()

      if (currentUrl.includes('7net.omni7.jp') && !currentUrl.includes('auth')) {
        const hasSessionCookie = filteredCookies.some(c => ['SSID', 'NTID', 'OWS_SESSION_ID'].includes(c.name))
        if (hasSessionCookie || filteredCookies.length > 5) {
          closedExplicitly = true
          clearInterval(cookieCheckInterval)
          const cookieString = filteredCookies.map(c => `${c.name}=${c.value}`).join('; ')
          resolve({ success: true, cookie: cookieString })
          loginWin.destroy()
        }
      }
    }, 2000)
  })
}

export function stopMonitoring(reason?: string): void {
  isMonitoring = false
  if (checkIntervalId) {
    clearTimeout(checkIntervalId)
    checkIntervalId = null
  }
  if (reason) sendLogToRenderer(reason)
  if (mainWindow) mainWindow.webContents.send('status-change', 'stopped')
}

export async function startMonitoring(config: { url: string; discord?: string; email?: string; password?: string; cookie?: string }): Promise<void> {
  if (isMonitoring) return
  isMonitoring = true
  attempts = 0

  if (config.cookie) {
    process.env.COOKIE = config.cookie
  }

  const targetUrl = config.url
  const discordWebhook = config.discord

  if (!targetUrl) {
    sendLogToRenderer('CRITICAL_ERROR: Targeting URI is empty.', 'error')
    stopMonitoring()
    return
  }

  sendLogToRenderer(`7NET_SCAN_INITIALIZED: Targeting ${targetUrl}`, 'info')
  if (mainWindow) mainWindow.webContents.send('status-change', 'running')
  
  startPolling(targetUrl, discordWebhook || '')
}

function sendLogToRenderer(msg: string, _type: string = 'info'): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-message', msg)
  }
}

async function notifyDiscord(webhookUrl: string, title: string, message: string): Promise<void> {
  if (!webhookUrl) return
  try {
    await axios.post(webhookUrl, { content: `🎉 **${title}**\n${message}` })
  } catch (error: any) {
    sendLogToRenderer(`WEBHOOK_FAILURE: ${error.message}`, 'error')
  }
}

async function startPolling(targetUrl: string, discordWebhook: string): Promise<void> {
  const notifiedItems = new Map<string, number>()

  const loop = async (): Promise<void> => {
    if (!isMonitoring) return

    attempts++
    sendLogToRenderer(`[Attempt #${attempts}] Fetching status...`, 'info')

    try {
      const response = await fetchPage(targetUrl)

      if (response.status === 200) {
        if (response.data.includes('id="loginId"') || response.data.includes('global/auth/login')) {
          sendLogToRenderer('⚠️ SESSION_EXPIRED: Attempting auto-refactoring...', 'info')
          const email = store.store.zaikoEmail
          const password = store.store.zaikoPassword

          if (email && password) {
            const result = await run7netLogin({ email, password })
            if (result.success && result.cookie) {
              sendLogToRenderer('✅ AUTO_REFLECT_SUCCESS: Session renewed.', 'success')
              process.env.COOKIE = result.cookie
              store.set({ zaikoCookie: result.cookie })
              if (mainWindow) mainWindow.webContents.send('cookie-updated', result.cookie)
              return loop()
            }
          }
          stopMonitoring('SESSION_TERMINATED: Manual auth required.')
          return
        }

        const inStockItems = isItemInStock(response.data)
        if (inStockItems.length > 0) {
          sendLogToRenderer(`🎉 IN_STOCK: Found ${inStockItems.length} valid object(s).`, 'success')
          const now = Date.now()
          for (const item of inStockItems) {
            const itemUrl = item.url || targetUrl
            const lastNotified = notifiedItems.get(itemUrl) || 0
            if (now - lastNotified >= 180000) { // 3m cooldown
              notifiedItems.set(itemUrl, now)
              if (lastNotified === 0) {
                sendLogToRenderer(`- DEPLOYING_LINK: ${item.name || 'Target Product'}`, 'success')
                await open(itemUrl)
              }
              if (discordWebhook) await notifyDiscord(discordWebhook, '7net Stock Alert', `**${item.name || 'Product'}** IN STOCK!\n${itemUrl}`)
            }
          }
        } else {
          sendLogToRenderer(`[Attempt #${attempts}] Status: OUT_OF_STOCK`, 'info')
        }
      } else if (response.status === 403 || response.status === 429) {
        sendLogToRenderer(`WARNED: Rate limit (Error ${response.status}). Throttling 60s...`, 'error')
        checkIntervalId = setTimeout(loop, 60000)
        return
      }
    } catch (err: any) {
      sendLogToRenderer(`FETCH_FAILURE: ${err.message}`, 'error')
    }

    if (isMonitoring) {
      const delay = Math.floor(Math.random() * 10001) + 5000 // 5-15s
      checkIntervalId = setTimeout(loop, delay)
    }
  }

  loop()
}
