import {
  CompiledSequences,
  CompiledShortcuts,
  compileSequences,
  compileShortcuts,
  handleKeydown,
} from "./shortcutCompilation";
import { SequenceShortcut, ShortcutWithHandler } from "./useShortcuts";

export namespace GlobalShortcuts {
  export type Create = {
    key: string;
    shortcuts: ShortcutWithHandler[];
    enabled: boolean;
    sequences: SequenceShortcut[];
  };

  type Item = {
    shortcuts: CompiledShortcuts;
    sequences: CompiledSequences;
    enabled: boolean;
    key: string;
  };

  type FlattenedGlobalShortcuts = {
    shortcuts: CompiledShortcuts;
    sequences: CompiledSequences;
  };

  const shortcutsMap: Record<string, Item> = {};
  const flattened: FlattenedGlobalShortcuts = {
    shortcuts: new Map(),
    sequences: [],
  };

  function recreateFlattened() {
    flattened.shortcuts = new Map();
    flattened.sequences = [];

    for (const item of Object.values(shortcutsMap)) {
      if (item.enabled) {
        item.shortcuts.forEach((item, k) => flattened.shortcuts.set(k, item));
        flattened.sequences.push(...item.sequences);
      }
    }
  }

  export function create(item: Create) {
    const compiled = {
      shortcuts: compileShortcuts(item.shortcuts),
      sequences: compileSequences(item.sequences),
      enabled: item.enabled,
      key: item.key,
    };
    shortcutsMap[item.key] = compiled;

    if (item.enabled) {
      compiled.shortcuts.forEach((item, k) => flattened.shortcuts.set(k, item));
      flattened.sequences.push(...compiled.sequences);
    }
  }

  export function updateEnabled(key: string, enabled: boolean) {
    const item = shortcutsMap[key];
    if (!item) {
      console.error(`Global shortcut ${key} not found`);
      return;
    }

    if (item.enabled === enabled) return;
    item.enabled = enabled;

    recreateFlattened();
  }

  export function remove(key: string) {
    const item = shortcutsMap[key];
    if (!item) {
      console.error(`Global shortcut ${key} not found`);
      return;
    }

    delete shortcutsMap[key];
    recreateFlattened();
  }

  function check(e: KeyboardEvent) {
    handleKeydown(flattened.shortcuts, flattened.sequences, e);
  }

  function throttle(fn: Function, delay: number) {
    let timeout: number | undefined;
    return function (...args: any[]) {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        fn(...args);
        timeout = undefined;
      }, delay);
    };
  }

  // çok hızlı state değişince patlıyoruz
  window.addEventListener("keydown", throttle(check, 0));
}
