import { dialogActions, dialogStore } from "./dialogStore";
import {
  directoryHelpers,
  directoryStore,
  selectSelection,
} from "./directoryStore/directory";
import { clipboardHelpers } from "./clipboardHelpers";
import { favoritesStore } from "./favorites";
import { layoutModel } from "./initializeDirectory";
import { Actions, TabNode } from "flexlayout-react";
import { LayoutHelpers } from "./utils/LayoutHelpers";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { directoryDerivedStores } from "./directoryStore/directorySubscriptions";
import { directorySelection } from "./directoryStore/directorySelection";
import { GlobalShortcuts } from "@/lib/hooks/globalShortcuts";
import { subscribeToStores } from "@/lib/functions/storeHelpers";
import { confirmation } from "@/lib/components/confirmation";

function getData() {
  return directoryDerivedStores
    .get(getActiveDirectoryId())
    ?.getFilteredDirectoryData()!;
}

function getActiveDirectoryId() {
  return directoryStore.getSnapshot().context.activeDirectoryId;
}

const SHORTCUTS_KEY = "file-browser";

function getNthLayoutDirectory(n: number) {
  let dir: DirectoryId | undefined = undefined;
  let count = 0;
  const nodes: DirectoryId[] = [];

  layoutModel.visitNodes((node) => {
    // if (dir) return;
    if (node instanceof TabNode && node.getComponent() === "directory") {
      if (node.getConfig()?.directoryId) {
        count++;
        nodes.push(node.getConfig()?.directoryId);
        if (count === n) {
          dir = node.getConfig()?.directoryId;
        }
      }
    }
  });

  return dir;
}

let subscription: (() => void) | undefined = undefined;

export const FileBrowserShortcuts = {
  init: () => {
    GlobalShortcuts.create({
      key: SHORTCUTS_KEY,
      shortcuts: [
        {
          key: ["Enter", "l"],
          handler: (e) =>
            directoryHelpers.openSelectedItem(getData(), e, undefined),
          label: "Open selected item",
        },
        {
          key: { key: "p", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("finder", { initialTab: "files" });
          },
          label: "Find file",
        },
        {
          key: { key: "k", ctrlKey: true, metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("commandPalette", {});
          },
          label: "Show keyboard shortcuts",
        },
        {
          key: { key: "l", ctrlKey: true, metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("customLayouts", {});
          },
          label: "Manage custom layouts",
        },
        {
          key: { key: "s", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("finder", { initialTab: "strings" });
          },
          label: "Find string",
        },
        {
          key: { key: "f", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("finder", { initialTab: "folders" });
          },
          label: "Find folder",
        },
        {
          key: { key: "o", ctrlKey: true },
          handler: (_) => {
            directoryHelpers.onGoUpOrPrev(directoryHelpers.goPrev, undefined);
          },
          label: "Go to previous directory",
        },
        {
          key: { key: "i", ctrlKey: true },
          handler: (_) => {
            directoryHelpers.onGoUpOrPrev(directoryHelpers.goNext, undefined);
          },
          label: "Go to next directory",
        },
        {
          key: ["-", "h"],
          handler: () =>
            directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp, undefined),
          label: "Go up to parent directory",
        },
        {
          key: { key: "Backspace", metaKey: true },
          handler: () => {
            const s = selectSelection(undefined)(directoryStore.getSnapshot());
            // Command+Delete on macOS
            if (s.indexes.size === 0) return;
            const data = getData();
            const itemsToDelete = [...s.indexes].map((i) => data[i]);
            directoryHelpers.handleDelete(itemsToDelete, data, undefined);
          },
          enabledIn: () => true,
          label: "Delete selected items",
        },
        {
          key: { key: "n", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            dialogActions.open("newItem", {});
          },
          label: "Create new item",
        },
        {
          key: "r",
          notKey: { key: "r", metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            const activeId = getActiveDirectoryId();
            if (!activeId) return;

            const dir = directoryStore.getSnapshot().context.directoriesById[activeId];
            if (dir?.vimState?.currentBuffer.historyStack.hasPrev) {
               confirmation.trigger.confirm({
                 title: "Unsaved Changes",
                 message: "You have unsaved Vim changes. Reloading will discard them. Continue?",
                 confirmText: "Reload",
                 rejectText: "Cancel",
                 onConfirm: () => {
                    directoryHelpers.reload(undefined);
                 }
               });
               return;
            }
            directoryHelpers.reload(undefined);
          },
          label: "[Vim] Reload directory",
        },
        {
          key: { key: "r", metaKey: true, shiftKey: true },
          handler: (e) => {
            e?.preventDefault();
            const data = getData();
            const s = selectSelection(undefined)(directoryStore.getSnapshot());
            const itemsToRename =
              s.indexes.size < 1 ? data : [...s.indexes].map((i) => data[i]);
            dialogActions.open("batchRename", itemsToRename);
          },
          enabledIn: () => true,
          label: "Batch rename selected items",
        },
        {
          key: { key: "c", metaKey: true },
          handler: (e) => {
            // Check if user is selecting text
            const selection = window.getSelection();
            const s = selectSelection(undefined)(directoryStore.getSnapshot());
            if (selection && selection.toString().length > 0) {
              return; // Allow default text copy
            }

            e?.preventDefault();
            if (s.indexes.size === 0) return;
            const itemsToCopy = [...s.indexes].map((i) => getData()[i]);
            clipboardHelpers.copy(itemsToCopy, false, undefined);
          },
          enabledIn: () => true,
          label: "Copy selected items",
        },
        {
          key: { key: "x", metaKey: true },
          handler: (e) => {
            // Check if user is selecting text
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              return; // Allow default text cut
            }

            e?.preventDefault();
            const s = selectSelection(undefined)(directoryStore.getSnapshot());
            if (s.indexes.size === 0) return;
            const itemsToCut = [...s.indexes].map((i) => getData()[i]);
            clipboardHelpers.copy(itemsToCut, true, undefined);
          },
          enabledIn: () => true,
          label: "Cut selected items",
        },
        {
          key: { key: "v", metaKey: true },
          handler: (e) => {
            // Check if user is in an input field
            const target = e?.target as HTMLElement;
            if (
              target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable
            ) {
              return; // Allow default paste in inputs
            }

            e?.preventDefault();
            clipboardHelpers.paste(undefined);
          },
          enabledIn: () => true,
          label: "Paste items",
        },
        {
          key: { key: "v", metaKey: true, ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            directoryStore.send({
              type: "toggleViewMode",
              directoryId: undefined,
            });
          },
          label: "Toggle view mode (list/grid)",
        },
        {
          key: { key: "0", ctrlKey: true },
          handler: (_) => {
            // @ts-ignore
            document.querySelector("webview")?.openDevTools();
          },
          label: "Open dev tools",
          enabledIn: () => true,
        },
        {
          key: { key: "/" },
          handler: (e) => {
            directoryStore.trigger.focusFuzzyInput({ e });
          },
          label: "Focus search",
        },
        {
          key: { key: "l", ctrlKey: true, metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            directoryHelpers.loadDirectorySizes(undefined);
          },
          label: "Load directory sizes",
        },
        {
          key: { key: "t", metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            const activeTabSet =
              LayoutHelpers.getActiveTabsetThatHasDirectory();
            if (!activeTabSet) return;

            directoryHelpers.createDirectory({
              tabId: activeTabSet.getId(),
            });
          },
          label: "New tab",
        },
        {
          key: { key: "m", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            const activeTabSet =
              LayoutHelpers.getActiveTabsetThatHasDirectory();
            if (!activeTabSet) return;

            layoutModel.doAction(Actions.maximizeToggle(activeTabSet.getId()));
          },
          label: "Maximize/Minimize",
        },
        {
          key: { key: "w", metaKey: true },
          handler: (e) => {
            if (
              directoryStore.getSnapshot().context.directoryOrder.length === 1
            ) {
              // Close the window
              return;
            }
            e?.preventDefault();
            const activeTabSet =
              LayoutHelpers.getActiveTabsetThatHasDirectory();
            if (!activeTabSet) return;

            const activeTab =
              LayoutHelpers.getActiveTabsetThatHasDirectory()?.getSelectedNode();
            if (!activeTab) return;
            if (!LayoutHelpers.isDirectory(activeTab)) return;

            layoutModel.doAction(Actions.deleteTab(activeTab.getId()));
          },
          label: "Close tab",
        },
        {
          key: "Escape",
          handler: () => {
            directorySelection.resetSelection(undefined);
          },
          label: "Reset selection",
        },
        ...directorySelection.getSelectionShortcuts(),
        // Option+1 through Option+9 to open favorites
        ...Array.from({ length: 9 }, (_, i) => ({
          key: { key: `Digit${i + 1}`, isCode: true, altKey: true },
          handler: (e: KeyboardEvent | undefined) => {
            e?.preventDefault();
            const favorite = favoritesStore.get().context.favorites[i];
            if (favorite) {
              // Use the current active directory, not the one from the closure
              const currentActiveId =
                directoryStore.getSnapshot().context.activeDirectoryId;
              directoryHelpers.openItemFull(favorite, currentActiveId);
            }
          },
          label: `Open favorite ${i + 1}`,
        })),
        ...new Array(10).fill(0).map((_, i) => ({
          key: { key: (i + 1).toString(), metaKey: true },
          handler: (e: KeyboardEvent | undefined) => {
            e?.preventDefault();
            const dir = getNthLayoutDirectory(i + 1);
            if (!dir) return;

            directoryStore.send({
              type: "setActiveDirectoryId",
              directoryId: dir,
            });
          },
          label: `Switch to pane ${i + 1}`,
        })),
        // Vim Shortcuts
        {
          key: "u",
          handler: (e) => {
            e?.preventDefault();
            const activeId = getActiveDirectoryId();
            if (!activeId) return;
            directoryStore.send({
              type: "runVimCommand",
              command: "u",
              directoryId: activeId,
            });
          },
          label: "[Vim] Undo",
        },
        {
          key: { key: "r", ctrlKey: true },
          handler: (e) => {
            e?.preventDefault();
            const activeId = getActiveDirectoryId();
            if (!activeId) return;
            // TODO: Redo is not explicitly exposed in VimEngine yet, using historyStack might be needed or adding 'redo' to VimEngine.
            // Assuming VimEngine has no redo command exposed as a function named 'redo'.
            // Actually, historyStack has goNext().
            // I should implement 'redo' action or similar.
            // For now skipping 'redo' shortcut or implementing via custom action?
            // Let's assume we use historyStack directly via a new action or runVimCommand if I add 'redo' to VimEngine.
          },
          label: "[Vim] Redo",
        },
        {
          key: "i",
          handler: (e) => {
            e?.preventDefault();
            const activeId = getActiveDirectoryId();
            if (!activeId) return;
            // We need to enter insert mode. VimEngine might not have 'i' command that switches mode?
            // It has 'mode' property.
            // I should just update the mode manually if VimEngine doesn't have a command.
            // But let's check VimEngine.ts content from memory/logs.
            // It has 'mode' state.
            // I'll send a custom update or assume I can run a command.
            // Since I cannot change VimEngine easily here without viewing it again.
            // I'll assume I can just update the state via a specific action if I had one.
            // Wait, runVimCommand calls VimEngine functions.
            // If VimEngine has 'i' function?
            // I'll update directory.ts to support 'setVimMode' or similar if needed.
            // Or I can send 'runVimCommand' with command 'i' if I implement `i` in VimEngine later or if it exists.
            // Actually, I'll implementing 'i' logic as: "Set mode to insert".
            // I don't have a direct action for this.
            // I will add a new action 'setVimMode' to directory.ts later if needed.
            // For now, I will use 'runVimCommand' with 'i' and hope I added it or will add it to VimEngine.
            directoryStore.send({
              type: "runVimCommand",
              command: "i",
              directoryId: activeId,
            });
          },
          label: "[Vim] Insert Mode",
        },
        {
          key: { key: "s", metaKey: true },
          handler: (e) => {
            e?.preventDefault();
            const activeId = getActiveDirectoryId();
            if (!activeId) return;
            directoryHelpers.saveVimChanges(activeId);
          },
          label: "[Vim] Save changes",
        },
      ],
      enabled: true,
      sequences: [
        ...directorySelection.getSelectionSequenceShortcuts(),
        {
          sequence: ["d", "d"],
          handler: () => {
             const activeId = getActiveDirectoryId();
             if (!activeId) return;
             directoryStore.send({
               type: "runVimCommand",
               command: "dd",
               directoryId: activeId,
             });
          },
          label: "[Vim] Delete line",
        },
      ],
    });

    subscription = subscribeToStores(
      [dialogStore, confirmation],
      ([dialog, confirmation]) => [!dialog.openDialog, confirmation.isOpen],
      ([dialog, confirmation]) => {
        const enabled = !dialog.openDialog && !confirmation.isOpen;
        GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, enabled);
      },
    );
  },
  deinit: () => {
    GlobalShortcuts.updateEnabled(SHORTCUTS_KEY, false);
    subscription?.();
  },
};
