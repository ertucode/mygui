import {
  SequenceShortcut,
  ShortcutWithHandler,
} from "@/lib/hooks/useShortcuts";
import { directoryStore } from "./directory";
import { DirectoryId, getActiveDirectory } from "./DirectoryBase";
import { directoryDerivedStores } from "./directorySubscriptions";
import { throttle } from "@common/throttle";

export const directorySelection = {
  // Selection helpers
  select: (
    index: number,
    event: React.MouseEvent | KeyboardEvent | undefined,
    _directoryId: DirectoryId | undefined,
  ) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      _directoryId,
    );
    const directoryId = state.directoryId;
    const filteredData = directoryDerivedStores
      .get(state.directoryId)!
      .getFilteredDirectoryData()!;
    index = index < 0 ? filteredData.length + index : index;

    // Helper to remove item from set
    const removeFromSet = (set: Set<number>, item: number) => {
      const newSet = new Set(set);
      newSet.delete(item);
      return newSet;
    };

    const isShiftEvent =
      event &&
      event.shiftKey &&
      (!("key" in event) || (event.key !== "G" && event.key !== "g"));
    if (isShiftEvent && state.selection.last != null) {
      const lastSelected = state.selection.last;
      const indexes = new Set(state.selection.indexes);

      if (lastSelected > index) {
        let allSelected = true;
        for (let i = lastSelected - 1; i >= index; i--) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.add(i);
          }
        }
      } else {
        let allSelected = true;
        for (let i = lastSelected + 1; i <= index; i++) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.add(i);
          }
        }
      }

      directoryStore.send({
        type: "setSelection",
        indexes,
        last: index,
        directoryId,
      });
      return;
    }

    const isCtrlEvent = event && event.metaKey;
    if (isCtrlEvent) {
      if (state.selection.indexes.has(index)) {
        directoryStore.send({
          type: "setSelection",
          indexes: removeFromSet(state.selection.indexes, index),
          last: index,
          directoryId,
        });
        return;
      }
      directoryStore.send({
        type: "setSelection",
        indexes: new Set([...state.selection.indexes, index]),
        last: index,
        directoryId,
      });
      return;
    }

    directoryStore.send({
      type: "setSelection",
      indexes: new Set([index]),
      last: index,
      directoryId,
    });
  },

  getSelectionShortcuts: (): ShortcutWithHandler[] => {
    // Helper function to calculate columns in grid view
    const getColumnsPerRow = (): number => {
      const context = getActiveDirectory(
        directoryStore.getSnapshot().context,
        undefined,
      );
      if (context.viewMode !== "grid") return 1;

      // Find the grid container
      const gridContainer = document.querySelector(
        `[data-list-id="${context.directoryId}"] > div`,
      ) as HTMLElement;
      if (!gridContainer) return 1;

      // Get all grid items
      const gridItems = gridContainer.querySelectorAll("[data-list-item]");
      if (gridItems.length < 2) return 1;

      // Calculate columns based on the position of first two items
      const firstItem = gridItems[0] as HTMLElement;
      const secondItem = gridItems[1] as HTMLElement;

      const firstRect = firstItem.getBoundingClientRect();
      const secondRect = secondItem.getBoundingClientRect();

      // If the second item is on the same row (y position is similar)
      if (Math.abs(firstRect.top - secondRect.top) < 10) {
        // Count how many items are on the first row
        let cols = 1;
        for (let i = 1; i < gridItems.length; i++) {
          const itemRect = (
            gridItems[i] as HTMLElement
          ).getBoundingClientRect();
          if (Math.abs(itemRect.top - firstRect.top) < 10) {
            cols++;
          } else {
            break;
          }
        }
        return cols;
      }

      return 1;
    };

    // Throttle delay for selection shortcuts
    const THROTTLE_DELAY = 5;

    return [
      {
        key: [{ key: "a", metaKey: true }],
        handler: (e) => {
          const context = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(context.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          directoryStore.send({
            type: "setSelection",
            indexes: new Set(Array.from({ length: count }).map((_, i) => i)),
            last: count - 1,
            directoryId: context.directoryId,
          });
          e?.preventDefault();
        },
        label: "Select all items",
      },
      {
        key: ["ArrowUp", "k", "K"],
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(state.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          const lastSelected = state.selection.last ?? 0;
          const cols = getColumnsPerRow();
          const offset = state.viewMode === "grid" ? cols : 1;
          const targetIndex = lastSelected - offset;

          // In grid mode with offset > 1, we need special handling for shift
          const isShiftEvent =
            e &&
            e.shiftKey &&
            (!("key" in e) || (e.key !== "G" && e.key !== "g"));
          const isGridJump = state.viewMode === "grid" && offset > 1;

          if (state.selection.indexes.has(targetIndex)) {
            const newSet = new Set(state.selection.indexes);
            newSet.delete(lastSelected);
            directoryStore.send({
              type: "setSelection",
              indexes: newSet,
              last: targetIndex,
              directoryId: state.directoryId,
            });
          } else {
            let finalTarget = targetIndex < 0 ? count - 1 : targetIndex;

            if (isShiftEvent && isGridJump && state.selection.last != null) {
              // In grid mode with shift, select items in a visual column pattern
              const indexes = new Set(state.selection.indexes);
              const current = state.selection.last;

              // Move up by cols each time
              let pos = current;
              while (pos > finalTarget && pos >= 0) {
                indexes.add(pos);
                pos -= cols;
              }
              if (pos >= 0) indexes.add(pos);

              directoryStore.send({
                type: "setSelection",
                indexes,
                last: finalTarget,
                directoryId: state.directoryId,
              });
            } else if (isShiftEvent) {
              // Normal shift behavior for list mode
              directorySelection.select(finalTarget, e, state.directoryId);
            } else {
              // No shift - just move selection
              directoryStore.send({
                type: "setSelection",
                indexes: new Set([finalTarget]),
                last: finalTarget,
                directoryId: state.directoryId,
              });
            }
          }
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Select previous item",
      },
      {
        key: ["ArrowDown", "j", "J"],
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(state.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          const lastSelected = state.selection.last ?? 0;
          const cols = getColumnsPerRow();
          const offset = state.viewMode === "grid" ? cols : 1;
          const targetIndex = lastSelected + offset;

          // In grid mode with offset > 1, we need special handling for shift
          const isShiftEvent =
            e &&
            e.shiftKey &&
            (!("key" in e) || (e.key !== "G" && e.key !== "g"));
          const isGridJump = state.viewMode === "grid" && offset > 1;

          if (state.selection.indexes.has(targetIndex)) {
            const newSet = new Set(state.selection.indexes);
            newSet.delete(lastSelected);
            directoryStore.send({
              type: "setSelection",
              indexes: newSet,
              last: targetIndex,
              directoryId: state.directoryId,
            });
          } else {
            let finalTarget = targetIndex >= count ? 0 : targetIndex;

            if (isShiftEvent && isGridJump && state.selection.last != null) {
              // In grid mode with shift, select items in a visual column pattern
              const indexes = new Set(state.selection.indexes);
              const current = state.selection.last;

              // Move down by cols each time
              let pos = current;
              while (pos < finalTarget && pos < count) {
                indexes.add(pos);
                pos += cols;
              }
              if (pos < count) indexes.add(pos);

              directoryStore.send({
                type: "setSelection",
                indexes,
                last: finalTarget,
                directoryId: state.directoryId,
              });
            } else if (isShiftEvent) {
              // Normal shift behavior for list mode
              directorySelection.select(finalTarget, e, state.directoryId);
            } else {
              // No shift - just move selection
              directoryStore.send({
                type: "setSelection",
                indexes: new Set([finalTarget]),
                last: finalTarget,
                directoryId: state.directoryId,
              });
            }
          }
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Select next item",
      },
      {
        key: "ArrowLeft",
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(state.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          const lastSelected = state.selection.last ?? 0;

          if (state.viewMode === "grid") {
            // In grid mode, move left by 1
            const targetIndex = lastSelected - 1;
            const finalTarget = targetIndex < 0 ? count - 1 : targetIndex;

            const isShiftEvent = e && e.shiftKey;
            if (isShiftEvent && state.selection.last != null) {
              // Add/remove from selection
              const indexes = new Set(state.selection.indexes);
              if (indexes.has(finalTarget)) {
                indexes.delete(state.selection.last);
              } else {
                indexes.add(finalTarget);
              }
              directoryStore.send({
                type: "setSelection",
                indexes,
                last: finalTarget,
                directoryId: state.directoryId,
              });
            } else {
              // Just move selection
              directoryStore.send({
                type: "setSelection",
                indexes: new Set([finalTarget]),
                last: finalTarget,
                directoryId: state.directoryId,
              });
            }
          } else {
            // In list mode, jump 10 items up (use original behavior)
            directorySelection.select(lastSelected - 10, e, state.directoryId);
          }
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Move left or Jump 10 items up",
      },
      {
        key: "ArrowRight",
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(state.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          const lastSelected = state.selection.last ?? 0;

          if (state.viewMode === "grid") {
            // In grid mode, move right by 1
            const targetIndex = lastSelected + 1;
            const finalTarget = targetIndex >= count ? 0 : targetIndex;

            const isShiftEvent = e && e.shiftKey;
            if (isShiftEvent && state.selection.last != null) {
              // Add/remove from selection
              const indexes = new Set(state.selection.indexes);
              if (indexes.has(finalTarget)) {
                indexes.delete(state.selection.last);
              } else {
                indexes.add(finalTarget);
              }
              directoryStore.send({
                type: "setSelection",
                indexes,
                last: finalTarget,
                directoryId: state.directoryId,
              });
            } else {
              // Just move selection
              directoryStore.send({
                type: "setSelection",
                indexes: new Set([finalTarget]),
                last: finalTarget,
                directoryId: state.directoryId,
              });
            }
          } else {
            // In list mode, jump 10 items down (use original behavior)
            directorySelection.select(lastSelected + 10, e, state.directoryId);
          }
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Move right or Jump 10 items down",
      },
      {
        key: { key: "G", shiftKey: true },
        handler: (e) => {
          // Go to the bottom (like vim G)
          directorySelection.select(-1, e, undefined);
          e?.preventDefault();
        },
        label: "Go to last item",
      },
      {
        key: { key: "d", ctrlKey: true },
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const filteredData = directoryDerivedStores
            .get(state.directoryId)!
            .getFilteredDirectoryData()!;
          const count = filteredData.length;
          const lastSelected = state.selection.last ?? 0;
          directorySelection.select(
            Math.min(lastSelected + 10, count - 1),
            e,
            state.directoryId,
          );
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Page down",
      },
      {
        key: { key: "u", ctrlKey: true },
        handler: throttle((e) => {
          const state = getActiveDirectory(
            directoryStore.getSnapshot().context,
            undefined,
          );
          const lastSelected = state.selection.last ?? 0;
          directorySelection.select(
            Math.max(lastSelected - 10, 0),
            e,
            state.directoryId,
          );
          e?.preventDefault();
        }, THROTTLE_DELAY),
        label: "Page up",
      },
    ];
  },
  getSelectionSequenceShortcuts: (): SequenceShortcut[] => {
    return [
      {
        // Go to the top (like vim gg)
        sequence: ["g", "g"],
        handler: (e) => {
          directorySelection.select(0, e, undefined);
          e?.preventDefault();
        },
        label: "Go to first item",
      },
    ];
  },

  resetSelection: (directoryId: DirectoryId | undefined) => {
    directoryStore.send({ type: "resetSelection", directoryId });
  },

  isSelected: (index: number, directoryId: DirectoryId) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    return state.selection.indexes.has(index);
  },

  selectManually: (index: number, directoryId: DirectoryId | undefined) => {
    directoryStore.send({ type: "selectManually", index, directoryId });
  },

  setSelection: (
    h: number | ((s: number) => number),
    directoryId: DirectoryId,
  ) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    let newSelection: number;
    if (state.selection.indexes.size === 0) {
      newSelection = typeof h === "number" ? h : h(0);
    } else if (state.selection.indexes.size === 1) {
      newSelection = typeof h === "number" ? h : h(state.selection.last!);
    } else {
      newSelection = typeof h === "number" ? h : h(state.selection.last!);
    }
    directoryStore.send({
      type: "setSelection",
      indexes: new Set([newSelection]),
      last: newSelection,
      directoryId,
    });
  },
};
