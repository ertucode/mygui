import { RefObject, useEffect, useRef } from "react";

type ShortcutDefinition =
  | string
  | {
      key: string;
      isCode?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
    };

type ShortcutWithHandler = {
  key: ShortcutDefinition | ShortcutDefinition[];
  handler: (e: KeyboardEvent) => void;
  enabledIn?: RefObject<HTMLElement | null> | ((e: KeyboardEvent) => boolean);
  notKey?: ShortcutDefinition | ShortcutDefinition[];
};

type SequenceShortcut = {
  sequence: string[];
  handler: (e: KeyboardEvent) => void;
  timeout?: number;
  enabledIn?: RefObject<HTMLElement | null> | ((e: KeyboardEvent) => boolean);
};

export type UseShortcutsOptions = {
  isDisabled?: boolean;
  /** Timeout in ms for key sequences (default: 500) */
  sequenceTimeout?: number;
};

type ShortcutInput = $Maybe<ShortcutWithHandler | SequenceShortcut> | boolean;

function isSequenceShortcut(
  shortcut: ShortcutWithHandler | SequenceShortcut,
): shortcut is SequenceShortcut {
  return "sequence" in shortcut;
}

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
      handleKeyDownWithShortcuts(e, shortcuts, sequenceBufferRef.current, opts);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, opts]);
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

  // Process regular shortcuts
  shortcuts.forEach((shortcut) => {
    if (!shortcut || shortcut === true) return;
    if (isSequenceShortcut(shortcut)) return; // Already handled above

    if (!checkEnabledIn(shortcut.enabledIn, e)) return;

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

    if (Array.isArray(shortcut.key)) {
      if (shortcut.key.some((k) => checkShortcut(k, e))) {
        shortcut.handler(e);
      }
    } else {
      if (checkShortcut(shortcut.key, e)) {
        shortcut.handler(e);
      }
    }
  });
}
