import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { useSelector } from "@xstate/store/react";
import { dialogActions, useIsDialogOpen } from "./dialogStore";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import {
  directoryHelpers,
  directoryStore,
  selectSelection,
} from "./directoryStore/directory";
import { favoritesStore } from "./favorites";
import { layoutModel } from "./initializeDirectory";
import { Actions, TabNode } from "flexlayout-react";
import { LayoutHelpers } from "./utils/LayoutHelpers";
import { DirectoryId } from "./directoryStore/DirectoryBase";
import { directoryDerivedStores } from "./directoryStore/directorySubscriptions";
import { directorySelection } from "./directoryStore/directorySelection";

function getData(activeDirectoryId: DirectoryId) {
  return directoryDerivedStores
    .get(activeDirectoryId)
    ?.getFilteredDirectoryData()!;
}

export function FileBrowserShortcuts() {
  const isConfirmationOpen = useConfirmation().isOpen;
  const isDialogsOpen = useIsDialogOpen();
  const directoryId = useSelector(
    directoryStore,
    (s) => s.context.activeDirectoryId,
  );

  const selection = useSelector(directoryStore, selectSelection(directoryId));

  const dataCount = directoryDerivedStores
    .get(directoryId)!
    .useFilteredDirectoryData().length;

  const directories = useSelector(
    directoryStore,
    (s) => s.context.directoryOrder,
  );

  // Create a selection object compatible with the old API
  const s = {
    state: selection,
    setState: (update: any) => {
      const newState =
        typeof update === "function" ? update(selection) : update;
      directoryStore.send({
        type: "setSelection",
        indexes: newState.indexes,
        lastSelected: newState.lastSelected,
      } as any);
    },
    select: directorySelection.select,
    reset: directorySelection.resetSelection,
    isSelected: directorySelection.isSelected,
  };

  useShortcuts(
    [
      {
        key: ["Enter", "l"],
        handler: (e) =>
          directoryHelpers.openSelectedItem(
            getData(directoryId),
            e,
            directoryId,
          ),
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
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goPrev, directoryId);
        },
        label: "Go to previous directory",
      },
      {
        key: { key: "i", ctrlKey: true },
        handler: (_) => {
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goNext, directoryId);
        },
        label: "Go to next directory",
      },
      {
        key: " ",
        handler: (_) => {
          if (s.state.last == null) {
            directorySelection.selectManually(0, directoryId);
          }
        },
        label: "Select first item",
      },
      {
        key: ["-", "h"],
        handler: () =>
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp, directoryId),
        label: "Go up to parent directory",
      },
      {
        key: { key: "Backspace", metaKey: true },
        handler: () => {
          // Command+Delete on macOS
          if (s.state.indexes.size === 0) return;
          const data = getData(directoryId);
          const itemsToDelete = [...s.state.indexes].map((i) => data[i]);
          directoryHelpers.handleDelete(itemsToDelete, data, directoryId);
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
          directoryHelpers.reload(directoryId);
        },
        label: "Reload directory",
      },
      {
        key: { key: "c", metaKey: true },
        handler: (e) => {
          // Check if user is selecting text
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Allow default text copy
          }

          e?.preventDefault();
          if (s.state.indexes.size === 0) return;
          const itemsToCopy = [...s.state.indexes].map(
            (i) => getData(directoryId)[i],
          );
          directoryHelpers.handleCopy(itemsToCopy, false, directoryId);
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
          if (s.state.indexes.size === 0) return;
          const itemsToCut = [...s.state.indexes].map(
            (i) => getData(directoryId)[i],
          );
          directoryHelpers.handleCopy(itemsToCut, true, directoryId);
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
          directoryHelpers.handlePaste(directoryId);
        },
        enabledIn: () => true,
        label: "Paste items",
      },
      {
        key: { key: "0", ctrlKey: true },
        handler: (_) => {
          // @ts-ignore
          document.querySelector("webview")?.openDevTools();
        },
        label: "Open dev tools",
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
          directoryHelpers.loadDirectorySizes(directoryId);
        },
        label: "Load directory sizes",
      },
      {
        key: { key: "t", metaKey: true },
        handler: (e) => {
          e?.preventDefault();
          const activeTabSet = LayoutHelpers.getActiveTabsetThatHasDirectory();
          if (!activeTabSet) return;

          directoryStore.trigger.createDirectory({
            tabId: activeTabSet.getId(),
          });
        },
        label: "New tab",
      },
      {
        // layoutModel.doAction(Actions.deleteTab(node.getId()));

        key: { key: "w", metaKey: true },
        handler: (e) => {
          e?.preventDefault();
          const activeTab =
            LayoutHelpers.getActiveTabsetThatHasDirectory()?.getSelectedNode();
          if (!activeTab) return;
          if (!LayoutHelpers.isDirectory(activeTab)) return;

          layoutModel.doAction(Actions.deleteTab(activeTab.getId()));
        },
        label: "Close tab",
      },
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
      ...directorySelection.getSelectionShortcuts(dataCount, directoryId),
      ...directories.map((_, i) => ({
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
    ],
    {
      isDisabled: isConfirmationOpen || isDialogsOpen,
    },
  );
  return undefined;
}

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
