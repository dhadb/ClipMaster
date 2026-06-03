const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

let mainWindow
let installPath = path.join(app.getPath('userData'), '..', 'Local', 'Programs', 'ClipMaster')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 580,
    height: 460,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    skipTaskbar: false,
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  mainWindow.loadFile('src/index.html')
  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: path.dirname(installPath),
    title: '选择安装目录',
  })
  if (!result.canceled && result.filePaths.length > 0) {
    installPath = path.join(result.filePaths[0], 'ClipMaster')
    return installPath
  }
  return null
})

ipcMain.handle('get-install-path', () => installPath)

ipcMain.handle('set-install-path', (event, customPath) => {
  if (typeof customPath !== 'string') return installPath

  const trimmedPath = customPath.trim()
  if (trimmedPath) {
    installPath = trimmedPath
  }

  return installPath
})

ipcMain.handle('start-install', async (event, customPath) => {
  if (typeof customPath === 'string' && customPath.trim()) {
    installPath = customPath.trim()
  }

  try {
    // Create installation directory
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true })
    }

    // Source files (the unpacked app payload bundled with this animated installer)
    const candidates = [
      path.join(process.resourcesPath || '', 'app-payload'),
      path.join(__dirname, '..', 'release', 'win-unpacked'),
      path.join(app.getAppPath(), '..', 'win-unpacked'),
      path.join(app.getAppPath(), 'app-payload'),
      path.join(app.getAppPath(), 'app'),
    ]

    const actualSource = candidates.find(candidate => candidate && fs.existsSync(candidate))

    // Get list of files to copy
    if (!actualSource || !fs.existsSync(actualSource)) {
      throw new Error('安装源不存在，请重新下载安装包')
    }

    const files = getAllFiles(actualSource)
    const totalFiles = files.length
    if (totalFiles === 0) {
      throw new Error('安装包内容为空，请重新下载安装包')
    }

    let copiedFiles = 0

    // Copy files with progress
    for (const file of files) {
      const relativePath = path.relative(actualSource, file)
      const destPath = path.join(installPath, relativePath)
      const destDir = path.dirname(destPath)

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      fs.copyFileSync(file, destPath)
      copiedFiles++

      // Send progress (check if window still exists)
      const progress = Math.round((copiedFiles / totalFiles) * 100)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('install-progress', {
          progress,
          current: copiedFiles,
          total: totalFiles,
          file: relativePath,
        })
      }

      // Small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 15))
    }

    // Create shortcuts
    const installedExe = path.join(installPath, 'ClipMaster.exe')
    if (!fs.existsSync(installedExe)) {
      throw new Error('安装失败：未找到 ClipMaster.exe')
    }

    await createShortcuts()

    // Register in Windows
    await registerApp()

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message || String(error) }
  }
})

ipcMain.handle('close-installer', () => {
  app.quit()
})

ipcMain.handle('launch-app', () => {
  const exePath = path.join(installPath, 'ClipMaster.exe')
  if (fs.existsSync(exePath)) {
    const { spawn } = require('child_process')
    spawn(exePath, [], { detached: true, stdio: 'ignore' })
  }
  app.quit()
})

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles

  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles)
    } else {
      arrayOfFiles.push(fullPath)
    }
  }
  return arrayOfFiles
}

function runPowerShell(script) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'PowerShell command failed')
  }
}

function psString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function createShortcuts() {
  try {
    const exePath = path.join(installPath, 'ClipMaster.exe')

    // Desktop shortcut
    const desktopPath = app.getPath('desktop')
    const shortcutPath = path.join(desktopPath, 'ClipMaster.lnk')

    runPowerShell(`
      $ws = New-Object -ComObject WScript.Shell
      $shortcut = $ws.CreateShortcut(${psString(shortcutPath)})
      $shortcut.TargetPath = ${psString(exePath)}
      $shortcut.WorkingDirectory = ${psString(installPath)}
      $shortcut.Description = ${psString('ClipMaster - 现代剪贴板管理器')}
      $shortcut.Save()
    `)

    // Start menu shortcut
    const startMenuPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ClipMaster')
    if (!fs.existsSync(startMenuPath)) {
      fs.mkdirSync(startMenuPath, { recursive: true })
    }

    const menuShortcutPath = path.join(startMenuPath, 'ClipMaster.lnk')
    runPowerShell(`
      $ws = New-Object -ComObject WScript.Shell
      $shortcut = $ws.CreateShortcut(${psString(menuShortcutPath)})
      $shortcut.TargetPath = ${psString(exePath)}
      $shortcut.WorkingDirectory = ${psString(installPath)}
      $shortcut.Description = ${psString('ClipMaster - 现代剪贴板管理器')}
      $shortcut.Save()
    `)
  } catch (error) {
    console.error('Failed to create shortcuts:', error)
    throw error
  }
}

async function registerApp() {
  try {
    const exePath = path.join(installPath, 'ClipMaster.exe')
    const uninstallPath = path.join(installPath, 'Uninstall.exe')
    const uninstallString = fs.existsSync(uninstallPath) ? `\"${uninstallPath}\"` : `\"${exePath}\" --uninstall`

    runPowerShell(`
      New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Force | Out-Null
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Name 'DisplayName' -Value ${psString('ClipMaster')}
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Name 'UninstallString' -Value ${psString(uninstallString)}
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Name 'DisplayIcon' -Value ${psString(`\"${exePath}\"`)}
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Name 'Publisher' -Value ${psString('ClipMaster Team')}
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster' -Name 'DisplayVersion' -Value ${psString('1.0.0')}
      Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'ClipMaster' -Value ${psString(`\"${exePath}\"`)}
    `)
  } catch (error) {
    console.error('Failed to register app:', error)
    throw error
  }
}
