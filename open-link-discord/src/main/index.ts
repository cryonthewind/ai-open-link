import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { store, initStore, AppSettings } from './store'
import { getChromeProfiles, openUrlInChrome, closeChromeWindow, closeAllChromeWindows } from './chrome-service'
import { connectDiscord, disconnectDiscord, getGuildsAndChannels, sendWebhookLog, testReadLatestMessage } from './discord-service'
import { initZaikoService, run7netLogin, startMonitoring, stopMonitoring } from './zaiko-service'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000', // Fully transparent
    vibrancy: 'under-window',    // macOS vibrancy effect
    visualEffectState: 'active',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Initialize Zaiko Service with this window
  initZaikoService(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length > 0) {
      const mainWindow = allWindows[0]
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      mainWindow.show()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // IPC for Settings
    ipcMain.handle('get-settings', () => {
      return store.store
    })

    ipcMain.handle('save-settings', (_, newSettings: Partial<AppSettings>) => {
      // Merge new settings with existing settings
      const currentSettings = store.store
      const updatedSettings = { ...currentSettings, ...newSettings }
      store.set(updatedSettings)
      return true
    })

    // IPC for Chrome Service
    ipcMain.handle('get-chrome-profiles', () => {
      return getChromeProfiles()
    })

    ipcMain.handle('open-url-in-chrome', async (_, url: string, profileDir: string, bounds?: { x: number; y: number; width: number; height: number }) => {
      return await openUrlInChrome(url, profileDir, bounds)
    })

    ipcMain.handle('close-chrome-window', async (_, windowId: number) => {
      return await closeChromeWindow(windowId)
    })

    ipcMain.handle('close-all-chrome-windows', async (_, windowIds: number[]) => {
      return await closeAllChromeWindows(windowIds)
    })

    // IPC for Discord Service
    ipcMain.handle('connect-discord', async (_, token: string) => {
      return await connectDiscord(token)
    })

    ipcMain.handle('disconnect-discord', () => {
      disconnectDiscord()
      return true
    })

    ipcMain.handle('get-discord-data', () => {
      return getGuildsAndChannels()
    })

    ipcMain.handle('test-read-latest-message', async () => {
      return await testReadLatestMessage()
    })

    // IPC for Zaiko Service (7ID Integrated)
    ipcMain.handle('login-7net', async (_, creds) => {
      return await run7netLogin(creds)
    })

    ipcMain.on('start-monitoring', (_, config) => {
      startMonitoring(config)
    })

    ipcMain.on('stop-monitoring', () => {
      stopMonitoring('Monitoring halted manually.')
    })

    ipcMain.handle('close-app', () => {
      app.quit()
      return true
    })

    // Initialize electron-store
    await initStore()
    await sendWebhookLog(store.store, 'start');

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  let isQuitting = false;
  app.on('before-quit', async (e) => {
    if (!isQuitting) {
      e.preventDefault();
      isQuitting = true;
      await sendWebhookLog(store.store, 'stop');
      app.quit();
    }
  });

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.
}
