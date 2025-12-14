import { useConfirmation } from "@/lib/hooks/useConfirmation";
import { useSelector } from "@xstate/store/react";
import { dialogActions, useIsDialogOpen } from "./dialogStore";
import { useShortcuts } from "@/lib/hooks/useShortcuts";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { directoryHelpers, directoryStore, selectSelection } from "./directory";
import { favoritesStore } from "./favorites";

export function useFileBrowserShortcuts(
  data: GetFilesAndFoldersInDirectoryItem[],
) {
  const isConfirmationOpen = useConfirmation().isOpen;
  const isDialogsOpen = useIsDialogOpen();

  const selection = useSelector(directoryStore, selectSelection);

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
    select: directoryHelpers.select,
    reset: directoryHelpers.resetSelection,
    isSelected: directoryHelpers.isSelected,
  };

  useShortcuts(
    [
      {
        key: ["Enter", "l"],
        handler: (e) => directoryHelpers.openSelectedItem(data, e),
      },
      {
        key: { key: "p", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          dialogActions.open("finder", { initialTab: "files" });
        },
      },
      {
        key: { key: "s", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          dialogActions.open("finder", { initialTab: "strings" });
        },
      },
      {
        key: { key: "f", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          dialogActions.open("finder", { initialTab: "folders" });
        },
      },
      {
        key: { key: "o", ctrlKey: true },
        handler: (_) => {
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goPrev);
        },
      },
      {
        key: { key: "i", ctrlKey: true },
        handler: (_) => {
          directoryHelpers.onGoUpOrPrev(directoryHelpers.goNext);
        },
      },
      {
        key: " ",
        handler: (_) => {
          if (s.state.last == null) {
            directoryHelpers.selectManually(0);
          }
        },
      },
      {
        key: ["-", "h"],
        handler: () => directoryHelpers.onGoUpOrPrev(directoryHelpers.goUp),
      },
      {
        key: { key: "Backspace", metaKey: true },
        handler: () => {
          // Command+Delete on macOS
          if (s.state.indexes.size === 0) return;
          const itemsToDelete = [...s.state.indexes].map((i) => data[i]);
          directoryHelpers.handleDelete(itemsToDelete, data);
        },
        enabledIn: () => true,
      },
      {
        key: { key: "n", ctrlKey: true },
        handler: (e) => {
          e.preventDefault();
          dialogActions.open("newItem", {});
        },
      },
      {
        key: "r",
        handler: (e) => {
          e.preventDefault();
          directoryHelpers.reload();
        },
      },
      {
        key: { key: "c", metaKey: true },
        handler: (e) => {
          // Check if user is selecting text
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Allow default text copy
          }

          e.preventDefault();
          if (s.state.indexes.size === 0) return;
          const itemsToCopy = [...s.state.indexes].map((i) => data[i]);
          directoryHelpers.handleCopy(itemsToCopy, false);
        },
        enabledIn: () => true,
      },
      {
        key: { key: "x", metaKey: true },
        handler: (e) => {
          // Check if user is selecting text
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // Allow default text cut
          }

          e.preventDefault();
          if (s.state.indexes.size === 0) return;
          const itemsToCut = [...s.state.indexes].map((i) => data[i]);
          directoryHelpers.handleCopy(itemsToCut, true);
        },
        enabledIn: () => true,
      },
      {
        key: { key: "v", metaKey: true },
        handler: (e) => {
          // Check if user is in an input field
          const target = e.target as HTMLElement;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          ) {
            return; // Allow default paste in inputs
          }

          e.preventDefault();
          directoryHelpers.handlePaste();
        },
        enabledIn: () => true,
      },
      {
        key: { key: "0", ctrlKey: true },
        handler: (_) => {
          // @ts-ignore
          document.querySelector("webview")?.openDevTools();
        },
      },
      {
        key: { key: "/" },
        handler: (e) => {
          directoryStore.trigger.focusFuzzyInput({ e });
        },
      },
      // Option+1 through Option+9 to open favorites
      ...Array.from({ length: 9 }, (_, i) => ({
        key: { key: `Digit${i + 1}`, isCode: true, altKey: true },
        handler: (e: KeyboardEvent) => {
          e.preventDefault();
          const favorite = favoritesStore.get().context.favorites[i];
          if (favorite) {
            directoryHelpers.openItemFull(favorite);
          }
        },
      })),
      ...directoryHelpers.getSelectionShortcuts(data.length),
    ],
    {
      isDisabled: isConfirmationOpen || isDialogsOpen,
    },
  );
}
