import { createStore } from "@xstate/store";
import { z } from "zod";

// 7 predefined tag colors
export const TAG_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

// Tailwind color classes for each tag color
export const TAG_COLOR_CLASSES: Record<
  TagColor,
  { bg: string; text: string; dot: string }
> = {
  red: { bg: "bg-red-500/20", text: "text-red-400", dot: "bg-red-500" },
  orange: {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    dot: "bg-orange-500",
  },
  yellow: {
    bg: "bg-yellow-500/20",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
  },
  green: { bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-500" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  purple: {
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    dot: "bg-purple-500",
  },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400", dot: "bg-pink-500" },
};

// Schema for tag configuration (color -> name mapping)
const tagConfigSchema = z.record(z.enum(TAG_COLORS), z.string());

// Schema for file-tag assignments (fullPath -> array of tag colors)
const fileTagsSchema = z.record(z.string(), z.array(z.enum(TAG_COLORS)));

// Schema for last used tag
const lastUsedTagSchema = z.enum(TAG_COLORS).nullable();

export type TagConfig = z.infer<typeof tagConfigSchema>;
export type FileTags = z.infer<typeof fileTagsSchema>;

// Default tag names are the color names capitalized
const defaultTagConfig: TagConfig = TAG_COLORS.reduce(
  (acc, color) => {
    acc[color] = color.charAt(0).toUpperCase() + color.slice(1);
    return acc;
  },
  {} as Record<TagColor, string>,
);

// Load data from localStorage
const loadFromLocalStorage = <T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): T => {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    const parsed = JSON.parse(item);
    return schema.parse(parsed);
  } catch {
    return defaultValue;
  }
};

// Save data to localStorage
const saveToLocalStorage = <T>(
  key: string,
  schema: z.ZodType<T>,
  value: T,
): void => {
  try {
    const validated = schema.parse(value);
    localStorage.setItem(key, JSON.stringify(validated));
  } catch {
    // Ignore validation errors
  }
};

// Create the store
export const tagsStore = createStore({
  context: {
    tagConfig: loadFromLocalStorage(
      "file-browser-tag-config",
      tagConfigSchema,
      defaultTagConfig,
    ),
    fileTags: loadFromLocalStorage(
      "file-browser-file-tags",
      fileTagsSchema,
      {},
    ),
    lastUsedTag: loadFromLocalStorage(
      "file-browser-last-used-tag",
      lastUsedTagSchema,
      null,
    ),
  },
  on: {
    setTagName: (context, event: { color: TagColor; name: string }) => ({
      ...context,
      tagConfig: {
        ...context.tagConfig,
        [event.color]: event.name,
      },
    }),

    addTagToFile: (context, event: { fullPath: string; color: TagColor }) => {
      const currentTags = context.fileTags[event.fullPath] || [];
      if (currentTags.includes(event.color)) {
        return context;
      }
      return {
        ...context,
        fileTags: {
          ...context.fileTags,
          [event.fullPath]: [...currentTags, event.color],
        },
        lastUsedTag: event.color,
      };
    },

    addTagToFiles: (
      context,
      event: { fullPaths: string[]; color: TagColor },
    ) => {
      const newFileTags = { ...context.fileTags };

      event.fullPaths.forEach((fullPath) => {
        const currentTags = newFileTags[fullPath] || [];
        if (!currentTags.includes(event.color)) {
          newFileTags[fullPath] = [...currentTags, event.color];
        }
      });

      return {
        ...context,
        fileTags: newFileTags,
        lastUsedTag: event.color,
      };
    },

    removeTagFromFile: (
      context,
      event: { fullPath: string; color: TagColor },
    ) => {
      const currentTags = context.fileTags[event.fullPath] || [];
      const newTags = currentTags.filter((c: TagColor) => c !== event.color);
      const { [event.fullPath]: _, ...rest } = context.fileTags;

      return {
        ...context,
        fileTags:
          newTags.length === 0
            ? rest
            : {
                ...context.fileTags,
                [event.fullPath]: newTags,
              },
      };
    },

    toggleTagOnFile: (
      context,
      event: { fullPath: string; color: TagColor },
    ) => {
      const currentTags = context.fileTags[event.fullPath] || [];
      if (currentTags.includes(event.color)) {
        const newTags = currentTags.filter((c: TagColor) => c !== event.color);
        const { [event.fullPath]: _, ...rest } = context.fileTags;

        return {
          ...context,
          fileTags:
            newTags.length === 0
              ? rest
              : {
                  ...context.fileTags,
                  [event.fullPath]: newTags,
                },
        };
      } else {
        return {
          ...context,
          fileTags: {
            ...context.fileTags,
            [event.fullPath]: [...currentTags, event.color],
          },
          lastUsedTag: event.color,
        };
      }
    },

    toggleTagOnFiles: (
      context,
      event: { fullPaths: string[]; color: TagColor },
    ) => {
      const newFileTags = { ...context.fileTags };

      event.fullPaths.forEach((fullPath) => {
        const currentTags = newFileTags[fullPath] || [];
        if (currentTags.includes(event.color)) {
          const newTags = currentTags.filter(
            (c: TagColor) => c !== event.color,
          );
          if (newTags.length === 0) {
            delete newFileTags[fullPath];
          } else {
            newFileTags[fullPath] = newTags;
          }
        } else {
          newFileTags[fullPath] = [...currentTags, event.color];
        }
      });

      return {
        ...context,
        fileTags: newFileTags,
        lastUsedTag: event.color,
      };
    },

    removeFileFromAllTags: (context, event: { fullPath: string }) => {
      const { [event.fullPath]: _, ...rest } = context.fileTags;
      return {
        ...context,
        fileTags: rest,
      };
    },

    removeFilesFromAllTags: (context, event: { fullPaths: string[] }) => {
      const fileTags = { ...context.fileTags };
      event.fullPaths.forEach((fullPath) => {
        delete fileTags[fullPath];
      });
      console.log({ fileTags });
      return {
        ...context,
        fileTags,
      };
    },
  },
});

// Subscribe to store changes for persistence
tagsStore.subscribe((state) => {
  // Persist state changes to localStorage
  saveToLocalStorage(
    "file-browser-tag-config",
    tagConfigSchema,
    state.context.tagConfig,
  );
  saveToLocalStorage(
    "file-browser-file-tags",
    fileTagsSchema,
    state.context.fileTags,
  );
  saveToLocalStorage(
    "file-browser-last-used-tag",
    lastUsedTagSchema,
    state.context.lastUsedTag,
  );
});

// Selector functions for common use cases
export const selectTagConfig = (state: ReturnType<typeof tagsStore.get>) =>
  state.context.tagConfig;
export const selectFileTags = (state: ReturnType<typeof tagsStore.get>) =>
  state.context.fileTags;
export const selectLastUsedTag = (state: ReturnType<typeof tagsStore.get>) =>
  state.context.lastUsedTag;

// Computed selectors
export const selectTagName =
  (color: TagColor) => (state: ReturnType<typeof tagsStore.get>) =>
    state.context.tagConfig[color] || color;

export const selectFileTagsForPath =
  (fullPath: string) => (state: ReturnType<typeof tagsStore.get>) =>
    state.context.fileTags[fullPath] || [];

export const selectFilesWithTag =
  (color: TagColor) => (state: ReturnType<typeof tagsStore.get>) =>
    Object.entries(state.context.fileTags)
      .filter(([, tags]) => tags.includes(color))
      .map(([path]) => path);

export const selectFileCountWithTag =
  (color: TagColor) => (state: ReturnType<typeof tagsStore.get>) =>
    Object.entries(state.context.fileTags).filter(([, tags]) =>
      tags.includes(color),
    ).length;

export const selectHasTag =
  (fullPath: string, color: TagColor) =>
  (state: ReturnType<typeof tagsStore.get>) =>
    (state.context.fileTags[fullPath] || []).includes(color);

export const selectEveryFileHasSameTags =
  (fullPaths: string[]) => (state: ReturnType<typeof tagsStore.get>) => {
    if (fullPaths.length < 2) return true;

    const firstTags = state.context.fileTags[fullPaths[0]] || [];
    return fullPaths.every((fullPath) => {
      const tags = state.context.fileTags[fullPath] || [];
      if (tags.length !== firstTags.length) return false;
      return tags.every((tag) => firstTags.includes(tag));
    });
  };

