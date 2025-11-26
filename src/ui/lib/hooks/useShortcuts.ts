import { RefObject, useEffect } from "react";

type ShortcutDefinition =
  | string
  | { key: string; metaKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean };

type ShortcutWithHandler = {
  key: ShortcutDefinition | ShortcutDefinition[];
  handler: (e: KeyboardEvent) => void;
  enabledIn?: RefObject<HTMLElement | null>;
};
export function useShortcuts(shortcuts: ShortcutWithHandler[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Sonra başka bir şeyler yapabiliriz

      shortcuts.forEach((shortcut) => {
        const enabledIn = shortcut.enabledIn?.current;
        if (
          e.target instanceof HTMLInputElement &&
          (!enabledIn || enabledIn !== e.target)
        )
          return;

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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts]);
}

function checkShortcut(shortcut: ShortcutDefinition, e: KeyboardEvent) {
  if (typeof shortcut === "string") {
    return e.key === shortcut;
  }

  if (typeof shortcut === "object" && "key" in shortcut) {
    if (shortcut.metaKey !== undefined && e.metaKey !== shortcut.metaKey)
      return false;
    if (shortcut.shiftKey !== undefined && e.shiftKey !== shortcut.shiftKey)
      return false;
    if (shortcut.ctrlKey !== undefined && e.ctrlKey !== shortcut.ctrlKey)
      return false;
    return e.key === shortcut.key;
  }

  const _exhaustiveCheck: $ExpectNever<typeof shortcut> = shortcut;
  return _exhaustiveCheck;
}
