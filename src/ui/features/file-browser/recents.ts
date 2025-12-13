import { createStore } from "@xstate/store";
import { z } from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";

const recentItemSchema = z.object({
  fullPath: z.string(),
  timestamp: z.number(),
  type: z.enum(["file", "dir"]),
});

const recentsSchema = z.array(recentItemSchema);

export type RecentItem = z.infer<typeof recentItemSchema>;

const MAX_RECENTS = 30;

// Create localStorage persistence helper
const recentsPersistence = createLocalStoragePersistence(
  "file-browser-recents",
  recentsSchema,
);

// Create the store
export const recentsStore = createStore({
  context: {
    recents: recentsPersistence.load([]),
  },
  on: {
    addRecent: (context, event: { item: Omit<RecentItem, "timestamp"> }) => {
      const isLastItemEquivalent =
        context.recents.length > 0 && context.recents[0].fullPath === event.item.fullPath;
      if (isLastItemEquivalent) return context;

      // Remove if already exists
      const filtered = context.recents.filter(
        (recent) => recent.fullPath !== event.item.fullPath,
      );
      // Add to beginning with current timestamp
      const updated = [{ ...event.item, timestamp: Date.now() }, ...filtered];
      // Keep only the most recent items
      return {
        ...context,
        recents: updated.slice(0, MAX_RECENTS),
      };
    },

    removeRecent: (context, event: { fullPath: string }) => ({
      ...context,
      recents: context.recents.filter(
        (recent) => recent.fullPath !== event.fullPath,
      ),
    }),

    clearRecents: (context) => ({
      ...context,
      recents: [],
    }),
  },
});

// Subscribe to store changes for persistence
recentsStore.subscribe((state) => {
  // Persist state changes to localStorage
  recentsPersistence.save(state.context.recents);
});

// Selector functions for common use cases
export const selectRecents = (state: ReturnType<typeof recentsStore.get>) =>
  state.context.recents;