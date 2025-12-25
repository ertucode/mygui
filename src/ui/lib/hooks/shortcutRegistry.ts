// Global registry for all active shortcuts
// Uses a Map with labels as keys to store shortcuts

import { DefinedShortcutInput, ShortcutDefinition, isSequenceShortcut } from "./useShortcuts";
import { shortcutCustomizationStore } from "./shortcutCustomization";

export type RegisteredShortcut = {
  label: string;
  shortcut: DefinedShortcutInput;
  defaultShortcut: DefinedShortcutInput; // Store original default
};

const shortcutRegistry = new Map<string, RegisteredShortcut>();

export const shortcutRegistryAPI = {
  register: (label: string, shortcut: DefinedShortcutInput) => {
    shortcutRegistry.set(label, { 
      label, 
      shortcut,
      defaultShortcut: shortcut, // Store the original
    });
  },

  unregister: (label: string) => {
    shortcutRegistry.delete(label);
  },

  getAll: () => {
    const customShortcuts = shortcutCustomizationStore.get().context.customShortcuts;
    
    return Array.from(shortcutRegistry.values()).map((registered) => {
      const customKey = customShortcuts[registered.label];
      
      if (!customKey) {
        return registered;
      }

      // Apply custom shortcut override
      const customizedShortcut = { ...registered.shortcut };
      
      if (isSequenceShortcut(customizedShortcut)) {
        // Handle sequence shortcuts
        if (typeof customKey === "object" && "sequence" in customKey) {
          customizedShortcut.sequence = customKey.sequence;
        }
      } else {
        // Handle regular shortcuts
        if (Array.isArray(customKey)) {
          customizedShortcut.key = customKey as ShortcutDefinition[];
        } else {
          customizedShortcut.key = customKey as ShortcutDefinition;
        }
      }

      return {
        ...registered,
        shortcut: customizedShortcut,
      };
    });
  },

  clear: () => {
    shortcutRegistry.clear();
  },
};
