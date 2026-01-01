import {
  compileSequences,
  compileShortcuts,
  handleKeydown,
} from "@/lib/hooks/shortcutCompilation";
import { VimEngine } from "@common/VimEngine";
import { vimStore } from "./vimStore";
import { directoryStore } from "../directoryStore/directory";

function createHandler(updater: (state: VimEngine.State) => VimEngine.State) {
  return (e: KeyboardEvent | undefined) => {
    e?.preventDefault();
    const directoryId = directoryStore.getSnapshot().context.activeDirectoryId;
    const state =
      vimStore.getSnapshot().context.vimStatesByDirectoryId[directoryId];
    if (!state) return;
    vimStore.send({
      type: "updateVimState",
      directoryId,
      updater,
    });
  };
}

const shortcuts = compileShortcuts([
  {
    key: "p",
    handler: createHandler(VimEngine.p),
    label: "Paste [VIM]",
  },
  {
    key: "P",
    handler: createHandler(VimEngine.P),
    label: "Paste Before [VIM]",
  },
  {
    key: "u",
    handler: createHandler(VimEngine.u),
    label: "Undo [VIM]",
  },
  {
    key: "C",
    handler: createHandler(VimEngine.C),
    label: "Change to end of line [VIM]",
  },
]);

const sequences = compileSequences([
  {
    sequence: ["d", "d"],
    handler: createHandler(VimEngine.dd),
    label: "Delete line(s) [VIM]",
  },
  {
    sequence: ["c", "c"],
    handler: createHandler(VimEngine.cc),
    label: "Change line(s) [VIM]",
  },
  {
    sequence: ["y", "y"],
    handler: createHandler(VimEngine.yy),
    label: "Yank line(s) [VIM]",
  },
  {
    sequence: ["c", "i", "w"],
    handler: createHandler(VimEngine.ciw),
    label: "Paste [VIM]",
  },
]);

function getNumberFromEvent(e: KeyboardEvent) {
  return e.key.length === 1 && e.key >= "0" && e.key <= "9" && parseInt(e.key);
}

export function addVimShortcuts() {
  const listener = (e: KeyboardEvent) => {
    const activeVim =
      vimStore.getSnapshot().context.vimStatesByDirectoryId[
        directoryStore.getSnapshot().context.activeDirectoryId
      ];
    if (!activeVim) return;
    // insert modu rowlarda handle edicez
    if (activeVim.mode !== "normal") return;

    const number = getNumberFromEvent(e);
    if (number) {
      const handler = createHandler((state) =>
        VimEngine.addToCount(state, number),
      );
      handler(e);
      return;
    }

    handleKeydown(shortcuts, sequences, e);
  };

  window.addEventListener("keydown", listener);

  return () => {
    window.removeEventListener("keydown", listener);
  };
}
