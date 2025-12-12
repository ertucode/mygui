import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useState } from "react";
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

export function useTags() {
  const [tagConfig, setTagConfig] = useLocalStorage(
    "file-browser-tag-config",
    tagConfigSchema,
    defaultTagConfig,
  );

  const [fileTags, setFileTags] = useLocalStorage(
    "file-browser-file-tags",
    fileTagsSchema,
    {},
  );

  const [lastUsedTag, setLastUsedTag] = useLocalStorage(
    "file-browser-last-used-tag",
    lastUsedTagSchema,
    null,
  );

  const getTagName = (color: TagColor): string => {
    return tagConfig[color] || color;
  };

  const setTagName = (color: TagColor, name: string) => {
    setTagConfig((prev) => ({
      ...prev,
      [color]: name,
    }));
  };

  const addTagToFile = (fullPath: string, color: TagColor) => {
    setFileTags((prev) => {
      const currentTags = prev[fullPath] || [];
      if (currentTags.includes(color)) {
        return prev;
      }
      return {
        ...prev,
        [fullPath]: [...currentTags, color],
      };
    });
    setLastUsedTag(color);
  };

  const addTagToFiles = (fullPaths: string[], color: TagColor) => {
    fullPaths.forEach((fullPath) => addTagToFile(fullPath, color));
  };

  const removeTagFromFile = (fullPath: string, color: TagColor) => {
    setFileTags((prev) => {
      const currentTags = prev[fullPath] || [];
      const newTags = currentTags.filter((c) => c !== color);
      if (newTags.length === 0) {
        const { [fullPath]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [fullPath]: newTags,
      };
    });
  };

  const toggleTagOnFile = (fullPath: string, color: TagColor) => {
    console.log("toggling", fullPath, color);
    const currentTags = fileTags[fullPath] || [];
    if (currentTags.includes(color)) {
      removeTagFromFile(fullPath, color);
    } else {
      addTagToFile(fullPath, color);
    }
  };

  const toggleTagOnFiles = (fullPaths: string[], color: TagColor) => {
    fullPaths.forEach((fullPath) => toggleTagOnFile(fullPath, color));
  };

  const getFileTags = (fullPath: string): TagColor[] => {
    return fileTags[fullPath] || [];
  };

  const getFilesWithTag = (color: TagColor): string[] => {
    return Object.entries(fileTags)
      .filter(([, tags]) => tags.includes(color))
      .map(([path]) => path);
  };

  const hasTag = (fullPath: string, color: TagColor): boolean => {
    return (fileTags[fullPath] || []).includes(color);
  };

  const removeFileFromAllTags = (fullPath: string) => {
    setFileTags((prev) => {
      const { [fullPath]: _, ...rest } = prev;
      return rest;
    });
  };

  const everyFileHasSameTags = (fullPaths: string[]) => {
    console.log(fullPaths.map((f) => getFileTags(f)));
    if (fullPaths.length < 2) return true;

    const firstTags = getFileTags(fullPaths[0]);
    return fullPaths.every((fullPath) => {
      const tags = getFileTags(fullPath);
      if (tags.length !== firstTags.length) return false;
      return tags.every((tag) => firstTags.includes(tag));
    });
  };

  return {
    tagConfig,
    fileTags,
    lastUsedTag,
    getTagName,
    setTagName,
    addTagToFile,
    addTagToFiles,
    removeTagFromFile,
    toggleTagOnFile,
    toggleTagOnFiles,
    getFileTags,
    getFilesWithTag,
    hasTag,
    removeFileFromAllTags,
    everyFileHasSameTags,
  };
}
