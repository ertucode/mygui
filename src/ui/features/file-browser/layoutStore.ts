import { createStore } from "@xstate/store";
import { z } from "zod";
import { createLocalStoragePersistence } from "./utils/localStorage";
import { IJsonModel } from "flexlayout-react";
import { TAG_COLORS } from "./tags";

// Schema for directory data (same as in initializeDirectory.ts)
const DirectoryDataSchema = z.array(
  z
    .object({
      id: z.string(),
    })
    .and(
      z
        .object({
          fullPath: z.string(),
          type: z.literal("path"),
        })
        .or(
          z.object({
            type: z.literal("tags"),
            color: z.enum(TAG_COLORS),
          }),
        ),
    ),
);

export const CustomLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  layoutJson: z.any() as z.ZodType<IJsonModel>,
  directories: DirectoryDataSchema.optional().default([]),
  activeDirectoryId: z.string().optional().default(""),
  createdAt: z.number(),
  isDefault: z.boolean().default(false),
});

export type CustomLayout = z.infer<typeof CustomLayoutSchema>;
export type DirectoryData = z.infer<typeof DirectoryDataSchema>;

const LayoutStoreSchema = z.object({
  layouts: z.array(CustomLayoutSchema),
});

export type LayoutStoreContext = z.infer<typeof LayoutStoreSchema>;

const defaultContext: LayoutStoreContext = {
  layouts: [],
};

// Create localStorage persistence helper
const layoutPersistence = createLocalStoragePersistence(
  "customLayouts",
  LayoutStoreSchema,
);

// Create the store
export const layoutStore = createStore({
  context: {
    ...layoutPersistence.load(defaultContext),
  },
  on: {
    addLayout: (context, event: { layout: CustomLayout }) => {
      // If this layout is marked as default, unmark all others
      const updatedLayouts = event.layout.isDefault
        ? context.layouts.map((l) => ({ ...l, isDefault: false }))
        : context.layouts;

      return {
        ...context,
        layouts: [...updatedLayouts, event.layout],
      };
    },

    updateLayout: (context, event: { id: string; layout: Partial<CustomLayout> }) => ({
      ...context,
      layouts: context.layouts.map((l) =>
        l.id === event.id ? { ...l, ...event.layout } : l
      ),
    }),

    deleteLayout: (context, event: { id: string }) => ({
      ...context,
      layouts: context.layouts.filter((l) => l.id !== event.id),
    }),

    setDefaultLayout: (context, event: { id: string }) => ({
      ...context,
      layouts: context.layouts.map((l) => ({
        ...l,
        isDefault: l.id === event.id,
      })),
    }),

    reorderLayouts: (context, event: { layouts: CustomLayout[] }) => ({
      ...context,
      layouts: event.layouts,
    }),
  },
});

// Subscribe to store changes for persistence
layoutStore.subscribe((state) => {
  layoutPersistence.save(state.context);
});

// Helper functions for common operations
export const layoutStoreHelpers = {
  addLayout: (layout: CustomLayout) =>
    layoutStore.send({ type: "addLayout", layout }),

  updateLayout: (id: string, layout: Partial<CustomLayout>) =>
    layoutStore.send({ type: "updateLayout", id, layout }),

  deleteLayout: (id: string) =>
    layoutStore.send({ type: "deleteLayout", id }),

  setDefaultLayout: (id: string) =>
    layoutStore.send({ type: "setDefaultLayout", id }),

  reorderLayouts: (layouts: CustomLayout[]) =>
    layoutStore.send({ type: "reorderLayouts", layouts }),

  createLayout: (
    name: string,
    layoutJson: IJsonModel,
    directories: DirectoryData,
    activeDirectoryId: string,
  ): CustomLayout => ({
    id: Math.random().toString(36).slice(2),
    name,
    layoutJson,
    directories,
    activeDirectoryId,
    createdAt: Date.now(),
    isDefault: false,
  }),
};

// Selector functions
export const selectLayouts = (state: ReturnType<typeof layoutStore.get>) =>
  state.context.layouts;

export const selectDefaultLayout = (
  state: ReturnType<typeof layoutStore.get>,
) => state.context.layouts.find((l) => l.isDefault);

export const selectLayoutById = (id: string) => (
  state: ReturnType<typeof layoutStore.get>,
) => state.context.layouts.find((l) => l.id === id);
