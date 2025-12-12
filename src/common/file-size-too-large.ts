import { FileCategory } from "./Contracts.js";
import { getCategoryFromExtension } from "./file-category.js";

export const fileSizeLimits: Partial<Record<FileCategory, number>> = {
  document: 1,
  spreadsheet: 10,
  video: 10,
};

const defaultLimit = 1;

export function fileSizeTooLarge(extension: string, size: number) {
  const category = getCategoryFromExtension(extension);
  const limit = fileSizeLimits[category] ?? defaultLimit;
  return {
    isTooLarge: size > limit * 1024 * 1024,
    limit,
  };
}
