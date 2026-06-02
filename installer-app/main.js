const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

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

ipcMain.handle('start-install', async () => {
  try {
    // Create installation directory
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true })
    }

    // Source files (the unpacked app)
    const sourcePath = path.join(__dirname, '..', 'release', 'win-unpacked')

    // Check if source exists, if not, try relative to app
    let actualSource = sourcePath
    if (!fs.existsSync(actualSource)) {
      actualSource = path.join(app.getAppPath(), '..', 'win-unpacked')
    }

    // If still not found, use the built-in files
    if (!fs.existsSync(actualSource)) {
      // Copy from the installer's bundled files
      actualSource = path.join(app.getAppPath(), 'app')
    }

    // Get list of files to copy
    const files = getAllFiles(actualSource)
    const totalFiles = files.length
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

async function createShortcuts() {
  try {
    const exePath = path.join(installPath, 'ClipMaster.exe')

    // Desktop shortcut
    const desktopPath = app.getPath('desktop')
    const shortcutPath = path.join(desktopPath, 'ClipMaster.lnk')

    // Use PowerShell to create shortcut
    const psCommand = `
      $ws = New-Object -ComObject WScript.Shell
      $shortcut = $ws.CreateShortcut('${shortcutPath.replace(/\\/g, '\\\\')}')
      $shortcut.TargetPath = '${exePath.replace(/\\/g, '\\\\')}'
      $shortcut.WorkingDirectory = '${installPath.replace(/\\/g, '\\\\')}'
      $shortcut.Description = 'ClipMaster - 现代剪贴板管理器'
      $shortcut.Save()
    `

    execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { stdio: 'ignore' })

    // Start menu shortcut
    const startMenuPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ClipMaster')
    if (!fs.existsSync(startMenuPath)) {
      fs.mkdirSync(startMenuPath, { recursive: true })
    }

    const menuShortcutPath = path.join(startMenuPath, 'ClipMaster.lnk')
    const psCommand2 = `
      $ws = New-Object -ComObject WScript.Shell
      $shortcut = $ws.CreateShortcut('${menuShortcutPath.replace(/\\/g, '\\\\')}')
      $shortcut.TargetPath = '${exePath.replace(/\\/g, '\\\\')}'
      $shortcut.WorkingDirectory = '${installPath.replace(/\\/g, '\\\\')}'
      $shortcut.Description = 'ClipMaster - 现代剪贴板管理器'
      $shortcut.Save()
    `

    execSync(`powershell -Command "${psCommand2.replace(/\n/g, ' ')}"`, { stdio: 'ignore' })
  } catch (error) {
    console.error('Failed to create shortcuts:', error)
  }
}

async function registerApp() {
  try {
    const exePath = path.join(installPath, 'ClipMaster.exe')

    // Register uninstaller
    const regCommand = `
      New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Force
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Name "DisplayName" -Value "ClipMaster"
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Name "UninstallString" -Value "\\"${path.join(installPath, 'Uninstall.exe').replace(/\\/g, '\\\\')}\\""
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Name "DisplayIcon" -Value "\\"${exePath.replace(/\\/g, '\\\\')}\\""
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Name "Publisher" -Value "ClipMaster Team"
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ClipMaster" -Name "DisplayVersion" -Value "1.0.0"
    `

    execSync(`powershell -Command "${regCommand.replace(/\n/g, ' ')}"`, { stdio: 'ignore' })

    // Auto-start
    const autoStartCommand = `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "ClipMaster" -Value "\\"${exePath.replace(/\\/g, '\\\\')}\\""
    `

    execSync(`powershell -Command "${autoStartCommand.replace(/\n/g, ' ')}"`, { stdio: 'ignore' })
  } catch (error) {
    console.error('Failed to register app:', error)
  }
}
