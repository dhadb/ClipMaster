import { execFile } from 'child_process'
import type { ForegroundTarget } from './ports'
import type { AppServices } from './index'

const targetedPasteScript = [
  'Add-Type @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class ClipMasterPaste {',
  '  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion U; }',
  '  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public KEYBDINPUT ki; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool IsWindow(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern bool SetForegroundWindow(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '  [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);',
  '  public static INPUT CreateKeyInput(ushort virtualKey, bool keyUp) {',
  '    return new INPUT { type = 1, U = new InputUnion { ki = new KEYBDINPUT { wVk = virtualKey, dwFlags = keyUp ? 0x0002u : 0u } } };',
  '  }',
  '}',
  '"@',
  '$rawHandle = $env:CLIPMASTER_TARGET_HWND',
  '$rawPid = $env:CLIPMASTER_TARGET_PID',
  '$ok = $false',
  'try {',
  '  if ($rawHandle -notmatch "^\\d{1,20}$" -or $rawPid -notmatch "^\\d{1,10}$") { throw "Invalid target" }',
  '  $target = [IntPtr]::new([Int64]$rawHandle)',
  '  $expectedPid = [uint32]$rawPid',
  '  if (-not [ClipMasterPaste]::IsWindow($target)) { throw "Closed target" }',
  '  $actualPid = [uint32]0',
  '  [void][ClipMasterPaste]::GetWindowThreadProcessId($target, [ref]$actualPid)',
  '  if ($actualPid -ne $expectedPid) { throw "Changed target" }',
  '  if ([ClipMasterPaste]::IsIconic($target)) { [void][ClipMasterPaste]::ShowWindowAsync($target, 9) }',
  '  if (-not [ClipMasterPaste]::SetForegroundWindow($target)) { throw "Foreground denied" }',
  '  Start-Sleep -Milliseconds 50',
  '  if ([ClipMasterPaste]::GetForegroundWindow() -ne $target) { throw "Foreground changed" }',
  '  $inputs = [ClipMasterPaste+INPUT[]]@(',
  '    [ClipMasterPaste]::CreateKeyInput(0x11, $false),',
  '    [ClipMasterPaste]::CreateKeyInput(0x56, $false),',
  '    [ClipMasterPaste]::CreateKeyInput(0x56, $true),',
  '    [ClipMasterPaste]::CreateKeyInput(0x11, $true)',
  '  )',
  '  $sent = [ClipMasterPaste]::SendInput([uint32]4, $inputs, [Runtime.InteropServices.Marshal]::SizeOf([type][ClipMasterPaste+INPUT]))',
  '  $ok = $sent -eq 4',
  '} catch {}',
  'if ($ok) { [Console]::Out.Write("ok") } else { [Console]::Out.Write("failed") }',
].join('\n')

export interface QuickPasteService {
  captureQuickPasteTarget(): Promise<void>
  sendTargetedPaste(target: ForegroundTarget | null): void
}

export function createQuickPasteService(services: AppServices): QuickPasteService {
  const rt = services.runtime

  function isUsableQuickPasteTarget(target: ForegroundTarget | null): target is ForegroundTarget {
    return Boolean(target
      && !services.foreground.isClipMasterTarget(target)
      && /^\d{1,20}$/.test(target.hwnd)
      && Number.isSafeInteger(target.processId)
      && target.processId > 0)
  }

  function sendTargetedPaste(target: ForegroundTarget | null) {
    if (process.platform !== 'win32' || !isUsableQuickPasteTarget(target)) return
    try {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', targetedPasteScript], {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true,
        maxBuffer: 1024,
        env: {
          ...process.env,
          CLIPMASTER_TARGET_HWND: target.hwnd,
          CLIPMASTER_TARGET_PID: String(target.processId),
        },
      }, (error, stdout) => {
        if (error || stdout.trim() !== 'ok') console.warn('Quick paste did not reach its saved target; content remains copied.')
      })
    } catch (err) {
      console.error('Failed to target quick paste:', err)
    }
  }

  async function captureQuickPasteTarget() {
    rt.quickPasteTarget = null
    if (process.platform !== 'win32') return

    const requestedAt = rt.now()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeout = new Promise<null>(resolve => {
      timeoutId = setTimeout(() => resolve(null), 180)
    })
    const target = await Promise.race([services.foreground.sample(), timeout])
    if (timeoutId) clearTimeout(timeoutId)
    if (!target || target.capturedAt < requestedAt || services.foreground.isClipMasterTarget(target)) return
    rt.quickPasteTarget = { ...target }
  }

  return { captureQuickPasteTarget, sendTargetedPaste }
}
