import { RefObject } from "react";
import {
  SequenceShortcut,
  ShortcutDefinition,
  ShortcutWithHandler,
} from "./useShortcuts";

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
 * 5 booleans + key|keyCode string 
 * TFFFTe
 * */
export type CompiledShortcut = $Branded<
  ShortcutDefinition,
  "compiled-shortcut"
>;
type Handler = (e: KeyboardEvent) => void;
export type CompiledShortcutSequence = CompiledShortcut[];

function compileShortcut(shortcut: ShortcutDefinition): CompiledShortcut {
  if (typeof shortcut === "string") {
    return ("FFFFF" + shortcut) as CompiledShortcut;
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

function compileSequence(
  sequence: ShortcutDefinition[],
): CompiledShortcutSequence {
  return sequence.map(compileShortcut);
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
): CompiledShortcuts {
  const shortcuts = new Map<CompiledShortcut, ShortcutWithHandler>();
  for (const s of shortcut) {
    if (Array.isArray(s.key)) {
      for (const k of s.key) {
        shortcuts.set(compileShortcut(k), s);
      }
    } else {
      shortcuts.set(compileShortcut(s.key), s);
    }
  }
  return shortcuts;
}

export function compileSequences(
  sequences: SequenceShortcut[],
): CompiledSequences {
  return sequences.map((s) => ({
    seq: compileSequence(s.sequence),
    def: s,
  }));
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

export type CompiledSequences = {
  seq: CompiledShortcutSequence;
  def: SequenceShortcut;
}[];
export type CompiledShortcuts = Map<CompiledShortcut, ShortcutWithHandler>;
export function handleKeydown(
  single: CompiledShortcuts,
  sequences: CompiledSequences,
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
        handler: s.def.handler,
        startedAt: now,
      };

      return;
    }
  }

  // 3️⃣ Fallback to single shortcuts
  for (const k of keys) {
    const def = single.get(k);
    if (def && checkEnabledIn(def.enabledIn, e)) {
      def.handler(e);
      return;
    }
  }
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

function resetState() {
  state.active = false;
  state.index = 0;
  state.sequence = null;
}
