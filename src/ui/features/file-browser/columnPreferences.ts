import { createStore } from "@xstate/store";
import { z } from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";

export const columnPreferenceSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});

export const columnPreferencesSchema = z.array(columnPreferenceSchema);

export type ColumnPreference = z.infer<typeof columnPreferenceSchema>;

// Schema for per-directory column preferences
const perDirectoryPreferencesSchema = z.record(
  z.string(), // directory path
  columnPreferencesSchema,
);

// Create localStorage persistence helpers
const globalPersistence = createLocalStoragePersistence(
  "file-browser-column-preferences-global",
  columnPreferencesSchema,
);

const localPersistence = createLocalStoragePersistence(
  "file-browser-column-preferences-local",
  perDirectoryPreferencesSchema,
);

// Create the store
export const columnPreferencesStore = createStore({
  context: {
    global: globalPersistence.load([]),
    local: localPersistence.load({}),
  },
  on: {
    setGlobalPreferences: (context, event: { preferences: ColumnPreference[] }) => ({
      ...context,
      global: event.preferences,
    }),

    setLocalPreferences: (
      context,
      event: { directoryPath: string; preferences: ColumnPreference[] },
    ) => ({
      ...context,
      local: {
        ...context.local,
        [event.directoryPath]: event.preferences,
      },
    }),

    clearGlobalPreferences: (context) => ({
      ...context,
      global: [],
    }),

    clearLocalPreferences: (context, event: { directoryPath: string }) => {
      const newLocal = { ...context.local };
      delete newLocal[event.directoryPath];
      return {
        ...context,
        local: newLocal,
      };
    },

    clearAllLocalPreferences: (context) => ({
      ...context,
      local: {},
    }),
  },
});

// Subscribe to store changes for persistence
columnPreferencesStore.subscribe((state) => {
  globalPersistence.save(state.context.global);
  localPersistence.save(state.context.local);
});

// Selector functions
export const selectGlobalPreferences = (
  state: ReturnType<typeof columnPreferencesStore.get>,
) => state.context.global;

export const selectLocalPreferences = (directoryPath: string) => (
  state: ReturnType<typeof columnPreferencesStore.get>,
) => state.context.local[directoryPath] || null;

export const selectEffectivePreferences = (directoryPath: string) => (
  state: ReturnType<typeof columnPreferencesStore.get>,
) => {
  // Local preferences override global
  return state.context.local[directoryPath] || state.context.global;
};
