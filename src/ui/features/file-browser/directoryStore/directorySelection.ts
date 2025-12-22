import { ShortcutInput } from "@/lib/hooks/useShortcuts";
import { directoryStore } from "./directory";
import { DirectoryId, getActiveDirectory } from "./DirectoryBase";

export const directorySelection = {
  // Selection helpers
  select: (
    index: number,
    event: React.MouseEvent | KeyboardEvent | undefined,
    directoryId: DirectoryId,
  ) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );

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

  getSelectionShortcuts: (
    count: number,
    directoryId: DirectoryId,
  ): ShortcutInput[] => [
    {
      key: [{ key: "a", metaKey: true }],
      handler: (e) => {
        directoryStore.send({
          type: "setSelection",
          indexes: new Set(Array.from({ length: count }).map((_, i) => i)),
          last: count - 1,
          directoryId,
        });
        e?.preventDefault();
      },
      label: "Select all items",
    },
    {
      key: ["ArrowUp", "k", "K"],
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected - 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected - 1,
            directoryId,
          });
        } else {
          if (lastSelected - 1 < 0) {
            directorySelection.select(count - 1, e, directoryId);
          } else {
            directorySelection.select(lastSelected - 1, e, directoryId);
          }
        }
        e?.preventDefault();
      },
      label: "Select previous item",
    },
    {
      key: ["ArrowDown", "j", "J"],
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        if (state.selection.indexes.has(lastSelected + 1)) {
          const newSet = new Set(state.selection.indexes);
          newSet.delete(lastSelected);
          directoryStore.send({
            type: "setSelection",
            indexes: newSet,
            last: lastSelected + 1,
            directoryId,
          });
        } else {
          if (lastSelected + 1 === count) {
            directorySelection.select(0, e, directoryId);
          } else {
            directorySelection.select(lastSelected + 1, e, directoryId);
          }
        }
        e?.preventDefault();
      },
      label: "Select next item",
    },
    {
      key: "ArrowLeft",
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directorySelection.select(lastSelected - 10, e, directoryId);
        e?.preventDefault();
      },
      label: "Jump 10 items up",
    },
    {
      key: "ArrowRight",
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directorySelection.select(lastSelected + 10, e, directoryId);
        e?.preventDefault();
      },
      label: "Jump 10 items down",
    },
    {
      key: "G",
      handler: (e) => {
        // Go to the bottom (like vim G)
        directorySelection.select(count - 1, e, directoryId);
        e?.preventDefault();
      },
      label: "Go to last item",
    },
    {
      // Go to the top (like vim gg)
      sequence: ["g", "g"],
      handler: (e) => {
        directorySelection.select(0, e, directoryId);
        e?.preventDefault();
      },
      label: "Go to first item",
    },
    {
      key: { key: "d", ctrlKey: true },
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directorySelection.select(
          Math.min(lastSelected + 10, count - 1),
          e,
          directoryId,
        );
        e?.preventDefault();
      },
      label: "Page down",
    },
    {
      key: { key: "u", ctrlKey: true },
      handler: (e) => {
        const state = getActiveDirectory(
          directoryStore.getSnapshot().context,
          directoryId,
        );
        const lastSelected = state.selection.last ?? 0;
        directorySelection.select(
          Math.max(lastSelected - 10, 0),
          e,
          directoryId,
        );
        e?.preventDefault();
      },
      label: "Page up",
    },
  ],

  resetSelection: (directoryId: DirectoryId) => {
    directoryStore.send({ type: "resetSelection", directoryId });
  },

  isSelected: (index: number, directoryId: DirectoryId) => {
    const state = getActiveDirectory(
      directoryStore.getSnapshot().context,
      directoryId,
    );
    return state.selection.indexes.has(index);
  },

  selectManually: (index: number, directoryId: DirectoryId) => {
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
