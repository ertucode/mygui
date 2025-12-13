import { z } from "zod";

/**
 * Load data from localStorage with schema validation
 * @param key - localStorage key
 * @param schema - Zod schema for validation
 * @param defaultValue - Default value if loading fails
 * @returns Validated data or default value
 */
export const loadFromLocalStorage = <T>(
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

/**
 * Save data to localStorage with schema validation
 * @param key - localStorage key
 * @param schema - Zod schema for validation
 * @param value - Value to save
 */
export const saveToLocalStorage = <T>(
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

/**
 * Create a localStorage persistence helper for xstate stores
 * @param key - localStorage key
 * @param schema - Zod schema for validation
 * @returns Object with load and save functions
 */
export const createLocalStoragePersistence = <T>(
  key: string,
  schema: z.ZodType<T>,
) => ({
  load: (defaultValue: T) => loadFromLocalStorage(key, schema, defaultValue),
  save: (value: T) => saveToLocalStorage(key, schema, value),
});