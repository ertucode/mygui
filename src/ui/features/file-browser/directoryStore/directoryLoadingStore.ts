import { createStore, StoreSnapshot } from "@xstate/store";
import { useSelector } from "@xstate/store/react";
import { DirectoryId } from "./DirectoryBase";

type DirectoryLoadingContext = {
  loadingCounts: Map<DirectoryId, number>;
};

export const directoryLoadingStore = createStore({
  context: {
    loadingCounts: new Map<DirectoryId, number>(),
  } as DirectoryLoadingContext,
  on: {
    incrementLoading: (context, event: { directoryId: DirectoryId }) => {
      const newCounts = new Map(context.loadingCounts);
      const currentCount = newCounts.get(event.directoryId) ?? 0;
      newCounts.set(event.directoryId, currentCount + 1);
      return {
        ...context,
        loadingCounts: newCounts,
      };
    },
    decrementLoading: (context, event: { directoryId: DirectoryId }) => {
      const newCounts = new Map(context.loadingCounts);
      const currentCount = newCounts.get(event.directoryId) ?? 0;
      const newCount = Math.max(0, currentCount - 1);

      if (newCount === 0) {
        newCounts.delete(event.directoryId);
      } else {
        newCounts.set(event.directoryId, newCount);
      }

      return {
        ...context,
        loadingCounts: newCounts,
      };
    },
  },
});

// Helper functions
export const directoryLoadingHelpers = {
  startLoading: (directoryId: DirectoryId) => {
    directoryLoadingStore.send({ type: "incrementLoading", directoryId });
  },
  endLoading: (directoryId: DirectoryId) => {
    directoryLoadingStore.send({ type: "decrementLoading", directoryId });
  },
};

// Selector
export const selectIsDirectoryLoading =
  (directoryId: DirectoryId) =>
  (state: StoreSnapshot<DirectoryLoadingContext>) => {
    const count = state.context.loadingCounts.get(directoryId);
    return count !== undefined && count > 0;
  };

// Hook
export function useDirectoryLoading(directoryId: DirectoryId): boolean {
  return useSelector(
    directoryLoadingStore,
    selectIsDirectoryLoading(directoryId),
  );
}
