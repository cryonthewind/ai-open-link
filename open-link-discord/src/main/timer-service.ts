import { app, ipcMain, BrowserWindow } from 'electron'

let timerInterval: NodeJS.Timeout | null = null
let timerRemainingSeconds: number | null = null
let mainWindow: BrowserWindow | null = null

export function initTimerService(window: BrowserWindow): void {
  mainWindow = window

  ipcMain.handle('start-timer', (_event, minutes: number) => {
    startTimer(minutes)
    return true
  })

  ipcMain.handle('stop-timer', () => {
    stopTimer()
    return true
  })

  ipcMain.handle('get-timer-remaining', () => {
    return timerRemainingSeconds
  })
}

function startTimer(minutes: number): void {
  if (timerInterval) {
    clearInterval(timerInterval)
  }

  timerRemainingSeconds = Math.floor(minutes * 60)
  
  // Initial tick to update UI immediately
  sendTimerTick()

  timerInterval = setInterval(() => {
    if (timerRemainingSeconds === null) return

    if (timerRemainingSeconds <= 1) {
      timerRemainingSeconds = 0
      sendTimerTick()
      stopTimer()
      // Close the app when timer hits 0
      app.quit()
      return
    }

    timerRemainingSeconds -= 1
    sendTimerTick()
  }, 1000)
}

function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function sendTimerTick(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer-tick', timerRemainingSeconds)
  }
}
