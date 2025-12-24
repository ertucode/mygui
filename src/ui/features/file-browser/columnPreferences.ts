import { createStore } from "@xstate/store";
import { createLocalStoragePersistence } from "./utils/localStorage";
import {
  ColumnPreference,
  ColumnPreferenceStore,
  perDirectoryPreferencesSchema,
  preferencesWithSortSchema,
  SortState,
} from "./schemas";

// Create localStorage persistence helpers
const globalPersistence = createLocalStoragePersistence(
  "file-browser-column-preferences-global",
  preferencesWithSortSchema,
);

const pathPersistence = createLocalStoragePersistence(
  "file-browser-column-preferences-local",
  perDirectoryPreferencesSchema,
);

const initialStore: ColumnPreferenceStore = {
  global: globalPersistence.load({ columns: [], sort: undefined }),
  path: pathPersistence.load({}),
};

// Create the store
export const columnPreferencesStore = createStore({
  context: initialStore,
  on: {
    setGlobalPreferences: (
      context,
      event: { preferences: ColumnPreference[] },
    ) => ({
      ...context,
      global: {
        ...context.global,
        columns: event.preferences,
      },
    }),

    setPathPreferences: (
      context,
      event: { directoryPath: string; preferences: ColumnPreference[] },
    ) => ({
      ...context,
      path: {
        ...context.path,
        [event.directoryPath]: {
          ...context.path[event.directoryPath],
          columns: event.preferences,
        },
      },
    }),

    setGlobalSort: (context, event: { sort: SortState }) => ({
      ...context,
      global: {
        ...context.global,
        sort: event.sort,
      },
    }),

    setPathSort: (
      context,
      event: { directoryPath: string; sort: SortState },
    ) => ({
      ...context,
      path: {
        ...context.path,
        [event.directoryPath]: {
          columns: context.path[event.directoryPath]?.columns || [],
          sort: event.sort,
        },
      },
    }),

    clearGlobalPreferences: (context) => ({
      ...context,
      global: { columns: [], sort: undefined },
    }),

    clearPathPreferences: (context, event: { directoryPath: string }) => {
      const newPath = { ...context.path };
      delete newPath[event.directoryPath];
      return {
        ...context,
        path: newPath,
      };
    },

    clearAllPathPreferences: (context) => ({
      ...context,
      path: {},
    }),
  },
});

// Subscribe to store changes for persistence
columnPreferencesStore.subscribe((state) => {
  globalPersistence.save(state.context.global);
  pathPersistence.save(state.context.path);
});

// Selector functions
export const selectGlobalPreferences = (
  state: ReturnType<typeof columnPreferencesStore.get>,
) => state.context.global.columns;

export const selectPathPreferences =
  (directoryPath: string) =>
  (state: ReturnType<typeof columnPreferencesStore.get>) =>
    state.context.path[directoryPath]?.columns || null;

export const selectEffectivePreferences =
  (directoryPath: string) =>
  (state: ReturnType<typeof columnPreferencesStore.get>) => {
    // Local preferences override global
    return (
      state.context.path[directoryPath]?.columns || state.context.global.columns
    );
  };

export const selectGlobalSort = (
  state: ReturnType<typeof columnPreferencesStore.get>,
) => state.context.global.sort;

export const selectPathSort =
  (directoryPath: string) =>
  (state: ReturnType<typeof columnPreferencesStore.get>) =>
    state.context.path[directoryPath]?.sort || null;

export const selectEffectiveSort =
  (directoryPath: string) =>
  (state: ReturnType<typeof columnPreferencesStore.get>) => {
    // Local sort state overrides global
    return state.context.path[directoryPath]?.sort || state.context.global.sort;
  };

export function resolveGlobalOrPathSort(directoryPath: string) {
  const c = columnPreferencesStore.getSnapshot().context;
  if (directoryPath === "") return c.global.sort;
  return c.path[directoryPath]?.sort || c.global.sort;
}
