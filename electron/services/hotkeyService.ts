import { globalShortcut } from 'electron'
import type { Settings } from '../../shared/ipc-contract'
import { hotkeyDefinitions } from './settingsService'
import type { HotkeyAction } from './runtime'
import type { AppServices } from './index'

export interface HotkeyService {
  register(nextSettings?: Settings): boolean
  unregister(): void
}

export function createHotkeyService(services: AppServices): HotkeyService {
  const rt = services.runtime

  function unregister() {
    rt.currentHotkeys.forEach(hotkey => globalShortcut.unregister(hotkey))
    rt.currentHotkeys.clear()
  }

  function register(nextSettings: Settings = rt.settings) {
    unregister()
    let allRegistered = true
    const callbacks: Record<HotkeyAction, () => void> = {
      toggle: () => services.window.toggleWindow('quick'),
      search: () => {
        void services.window.showWindow('quick').then(() => rt.sendToRenderer('focus-search'))
      },
      clear: () => {
        services.history.removeHistoryItems(item => !item.pinned && !item.favorited)
        rt.sendToRenderer('history-updated', rt.history)
        services.storage.scheduleSave()
      },
    }
    for (const definition of hotkeyDefinitions) {
      const hotkey = nextSettings[definition.key].trim()
      if (!hotkey || rt.currentHotkeys.has(definition.action) || !globalShortcut.register(hotkey, callbacks[definition.action])) {
        allRegistered = false
        if (hotkey) console.error(`Failed to register shortcut: ${hotkey}`)
        continue
      }
      rt.currentHotkeys.set(definition.action, hotkey)
    }
    return allRegistered
  }

  return { register, unregister }
}
