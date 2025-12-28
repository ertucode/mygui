import { ShortcutDefinition, ShortcutWithHandler } from "./useShortcuts";

/*
 *{
      isCode?: boolean;
      metaKey?: boolean;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
      key: string;
    }
 *
 * 5 booleans + _ + key|keyCode string 
 * TFFFT_e
 * */
export type CompiledShortcut = $Branded<
  ShortcutDefinition,
  "compiled-shortcut"
>;
type Handler = (e: KeyboardEvent) => void;
export type CompiledShortcutSequence = CompiledShortcut[];

function compileShortcut(shortcut: ShortcutDefinition): CompiledShortcut {
  if (typeof shortcut === "string") {
    return ("FFFFF_" + shortcut) as CompiledShortcut;
  }

  return [
    shortcut.isCode ? "T" : "F",
    shortcut.metaKey ? "T" : "F",
    shortcut.shiftKey ? "T" : "F",
    shortcut.ctrlKey ? "T" : "F",
    shortcut.altKey ? "T" : "F",
    shortcut.key,
  ].join("") as CompiledShortcut;
}

function compileEvent(e: KeyboardEvent): [CompiledShortcut, CompiledShortcut] {
  return [
    [
      "T",
      e.metaKey ? "T" : "F",
      e.shiftKey ? "T" : "F",
      e.ctrlKey ? "T" : "F",
      e.altKey ? "T" : "F",
      e.code,
    ].join("") as CompiledShortcut,
    [
      "F",
      e.metaKey ? "T" : "F",
      e.shiftKey ? "T" : "F",
      e.ctrlKey ? "T" : "F",
      e.altKey ? "T" : "F",
      e.key,
    ].join("") as CompiledShortcut,
  ];
}

export function compileShortcuts(
  shortcut: ShortcutWithHandler[],
): Map<CompiledShortcut, Handler> {
  const shortcuts = new Map<CompiledShortcut, Handler>();
  for (const s of shortcut) {
    if (Array.isArray(s.key)) {
      for (const k of s.key) {
        shortcuts.set(compileShortcut(k), s.handler);
      }
    } else {
      shortcuts.set(compileShortcut(s.key), s.handler);
    }
  }
  return shortcuts;
}

type SequenceState = {
  active: boolean;
  index: number;
  sequence: CompiledShortcutSequence | null;
  startedAt: number;
  handler: Handler;
};
const sequenceTimeout = 500;
let state: SequenceState = {
  active: false,
  index: 0,
  sequence: null,
  startedAt: 0,
  handler: () => {},
};

export function handleKeydown(
  single: Map<CompiledShortcut, Handler>,
  sequences: {
    seq: CompiledShortcutSequence;
    handler: Handler;
  }[],
  e: KeyboardEvent,
) {
  const keys = compileEvent(e);
  const now = performance.now();

  // 1️⃣ If we're in a sequence
  if (state.active) {
    if (now - state.startedAt > sequenceTimeout) {
      resetState();
      return;
    }

    const expected = state.sequence![state.index];

    if (keys.includes(expected)) {
      state.index++;

      if (state.index === state.sequence!.length) {
        state.handler!(e);
        resetState();
      }

      return;
    }

    // mismatch → cancel
    resetState();
  }

  // 2️⃣ Try to start a sequence
  for (const s of sequences) {
    if (keys.includes(s.seq[0])) {
      state = {
        active: true,
        index: 1,
        sequence: s.seq,
        handler: s.handler,
        startedAt: now,
      };

      return;
    }
  }

  // 3️⃣ Fallback to single shortcuts
  for (const k of keys) {
    const handler = single.get(k);
    if (handler) {
      handler(e);
      return;
    }
  }
}

function resetState() {
  state.active = false;
  state.index = 0;
  state.sequence = null;
}
