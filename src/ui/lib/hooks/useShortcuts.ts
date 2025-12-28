import { RefObject, useEffect, useRef } from "react";
import { shortcutRegistryAPI } from "./shortcutRegistry";
import { shortcutCustomizationStore } from "./shortcutCustomization";

export type ShortcutDefinition =
  | string
  | {
      key: string;
      isCode?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
    };

export type ShortcutWithHandler = {
  key: ShortcutDefinition | ShortcutDefinition[];
  handler: (e: KeyboardEvent | undefined) => void;
  enabledIn?:
    | RefObject<HTMLElement | null>
    | ((e: KeyboardEvent | undefined) => boolean);
  notKey?: ShortcutDefinition | ShortcutDefinition[];
  label: string; // Required label for the command palette
};

export type SequenceShortcut = {
  sequence: string[];
  handler: (e: KeyboardEvent | undefined) => void;
  timeout?: number;
  enabledIn?: RefObject<HTMLElement | null> | ((e: KeyboardEvent) => boolean);
  label: string; // Required label for the command palette
};

export type UseShortcutsOptions = {
  isDisabled?: boolean;
  /** Timeout in ms for key sequences (default: 500) */
  sequenceTimeout?: number;
  hideInPalette?: boolean;
};

export type ShortcutInput = $Maybe<DefinedShortcutInput> | boolean;

export type DefinedShortcutInput = ShortcutWithHandler | SequenceShortcut;

export function isSequenceShortcut(
  shortcut: ShortcutWithHandler | SequenceShortcut,
): shortcut is SequenceShortcut {
  return "sequence" in shortcut;
}

// Helper to apply custom shortcuts to a shortcut definition
function applyCustomShortcut(
  shortcut: DefinedShortcutInput,
  customShortcuts: Record<string, any>,
): DefinedShortcutInput {
  const customKey = customShortcuts[shortcut.label];

  if (!customKey) {
    return shortcut;
  }

  const customizedShortcut = { ...shortcut };

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

  return customizedShortcut;
}

// Helper to convert ShortcutDefinition to human-readable string
export function useShortcuts(
  shortcuts: ShortcutInput[],
  opts?: UseShortcutsOptions,
) {
  const sequenceBufferRef = useRef<{ keys: string[]; lastTime: number }>({
    keys: [],
    lastTime: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (opts?.isDisabled) return;

      // Apply custom shortcuts
      const customShortcuts =
        shortcutCustomizationStore.get().context.customShortcuts;
      const customizedShortcuts = shortcuts.map((s) => {
        if (!s || s === true) return s;
        return applyCustomShortcut(s, customShortcuts);
      });

      handleKeyDownWithShortcuts(
        e,
        customizedShortcuts,
        sequenceBufferRef.current,
        opts,
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, opts]);

  // Register shortcuts in the global registry
  useEffect(() => {
    if (opts?.hideInPalette || opts?.isDisabled) return;
    shortcuts.forEach((shortcut) => {
      if (!shortcut || shortcut === true) return;

      shortcutRegistryAPI.register(shortcut.label, shortcut);
    });

    // Cleanup: unregister shortcuts when component unmounts
    return () => {
      shortcuts.forEach((shortcut) => {
        if (!shortcut || shortcut === true) return;
        shortcutRegistryAPI.unregister(shortcut.label);
      });
    };
  }, [shortcuts]);
}

function checkShortcut(shortcut: ShortcutDefinition, e: KeyboardEvent) {
  if (typeof shortcut === "string") {
    return e.key === shortcut;
  }

  if (shortcut.metaKey !== undefined && e.metaKey !== shortcut.metaKey)
    return false;
  if (shortcut.shiftKey !== undefined && e.shiftKey !== shortcut.shiftKey)
    return false;
  if (shortcut.ctrlKey !== undefined && e.ctrlKey !== shortcut.ctrlKey)
    return false;
  if (shortcut.altKey !== undefined && e.altKey !== shortcut.altKey)
    return false;

  // When isCode is true, match against e.code instead of e.key
  if (shortcut.isCode) {
    return e.code === shortcut.key;
  }

  return e.key === shortcut.key;
}

/**
 * Calculate specificity of a shortcut definition
 * More specific shortcuts have higher numbers
 * Specificity is the number of boolean modifiers that are explicitly set
 */
function getShortcutSpecificity(shortcut: ShortcutDefinition): number {
  if (typeof shortcut === "string") {
    return 0; // No modifiers specified
  }

  let specificity = 0;
  if (shortcut.metaKey !== undefined) specificity++;
  if (shortcut.shiftKey !== undefined) specificity++;
  if (shortcut.ctrlKey !== undefined) specificity++;
  if (shortcut.altKey !== undefined) specificity++;
  if (shortcut.isCode !== undefined) specificity++;

  return specificity;
}

function checkEnabledIn(
  enabledIn:
    | RefObject<HTMLElement | null>
    | ((e: KeyboardEvent) => boolean)
    | undefined,
  e: KeyboardEvent,
): boolean {
  if (e.target instanceof HTMLInputElement) {
    if (!enabledIn) return false;
    if (typeof enabledIn === "function") {
      return enabledIn(e);
    }
    return enabledIn.current === e.target;
  }
  return true;
}

export function handleKeyDownWithShortcuts(
  e: KeyboardEvent,
  shortcuts: ShortcutInput[],
  sequenceBuffer: { keys: string[]; lastTime: number },
  opts?: UseShortcutsOptions,
) {
  const now = Date.now();
  const defaultTimeout = opts?.sequenceTimeout ?? 500;

  // Get all sequence shortcuts to determine max length and check for matches
  const sequenceShortcuts = shortcuts.filter(
    (s): s is SequenceShortcut => !!s && s !== true && isSequenceShortcut(s),
  );

  // Check if we should reset the buffer (timeout exceeded)
  if (sequenceShortcuts.length > 0) {
    const minTimeout = Math.min(
      ...sequenceShortcuts.map((s) => s.timeout ?? defaultTimeout),
    );
    if (now - sequenceBuffer.lastTime > minTimeout) {
      sequenceBuffer.keys = [];
    }

    // Add the new key to the buffer
    sequenceBuffer.keys.push(e.key);
    sequenceBuffer.lastTime = now;

    // Keep buffer at max needed length
    const maxLength = Math.max(
      ...sequenceShortcuts.map((s) => s.sequence.length),
    );
    if (sequenceBuffer.keys.length > maxLength) {
      sequenceBuffer.keys = sequenceBuffer.keys.slice(-maxLength);
    }

    // Check sequence shortcuts first
    for (const shortcut of sequenceShortcuts) {
      if (!checkEnabledIn(shortcut.enabledIn, e)) continue;

      const timeout = shortcut.timeout ?? defaultTimeout;
      if (now - sequenceBuffer.lastTime > timeout) continue;

      if (sequenceBuffer.keys.length < shortcut.sequence.length) continue;

      // Check if the end of the buffer matches the sequence
      const bufferEnd = sequenceBuffer.keys.slice(-shortcut.sequence.length);
      const matches = shortcut.sequence.every((key, i) => bufferEnd[i] === key);

      if (matches) {
        shortcut.handler(e);
        sequenceBuffer.keys = []; // Reset after match
        return; // Sequence matched, don't process regular shortcuts
      }
    }
  }

  // Process regular shortcuts - find all matching shortcuts and pick the most specific
  const matchingShortcuts: Array<{
    shortcut: ShortcutWithHandler;
    specificity: number;
  }> = [];

  shortcuts.forEach((shortcut) => {
    if (!shortcut || shortcut === true) return;
    if (isSequenceShortcut(shortcut)) return; // Already handled above

    if (!checkEnabledIn(shortcut.enabledIn, e)) return;

    // Check if notKey excludes this shortcut
    if (shortcut.notKey) {
      if (Array.isArray(shortcut.notKey)) {
        if (shortcut.notKey.some((k) => checkShortcut(k, e))) {
          return;
        }
      } else {
        if (checkShortcut(shortcut.notKey, e)) {
          return;
        }
      }
    }

    // Check if this shortcut matches
    let matchedDefinition: ShortcutDefinition | null = null;
    if (Array.isArray(shortcut.key)) {
      const matched = shortcut.key.find((k) => checkShortcut(k, e));
      if (matched) {
        matchedDefinition = matched;
      }
    } else {
      if (checkShortcut(shortcut.key, e)) {
        matchedDefinition = shortcut.key;
      }
    }

    // If matched, calculate specificity and add to candidates
    if (matchedDefinition) {
      const specificity = getShortcutSpecificity(matchedDefinition);
      matchingShortcuts.push({ shortcut, specificity });
    }
  });

  // If we have matching shortcuts, execute only the most specific one
  if (matchingShortcuts.length > 0) {
    // Sort by specificity (highest first)
    matchingShortcuts.sort((a, b) => b.specificity - a.specificity);

    // Execute only the most specific shortcut
    const mostSpecific = matchingShortcuts[0];
    mostSpecific.shortcut.handler(e);
  }
}
