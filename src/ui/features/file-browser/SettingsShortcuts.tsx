import { useShortcuts } from '@/lib/hooks/useShortcuts'
import { fileBrowserSettingsStore } from './settings'

export function SettingsShortcuts() {
  useShortcuts([
    {
      sequence: ['g', '.'],
      handler: () => {
        fileBrowserSettingsStore.trigger.toggleShowDotFiles()
      },
      label: 'Toggle show dot files',
    },
  ])
  return undefined
}
