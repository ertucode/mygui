import { FileCategory } from "./Contracts.js";
import { getCategoryFromExtension } from "./file-category.js";

export const fileSizeLimits: Partial<Record<FileCategory, number>> = {
  document: 1,
  spreadsheet: 10,
  video: Infinity,
  archive: 100,
  image: 100000,
};

const defaultLimit = 1;

export function fileSizeTooLarge(extension: string, size: number) {
  if (extension === "pdf") return { isTooLarge: false, limit: Infinity };
  const category = getCategoryFromExtension(extension);
  const limit = fileSizeLimits[category] ?? defaultLimit;
  // console.log(extension, size, limit * 1024 * 1024, size > limit * 1024 * 1024);
  return {
    isTooLarge: size > limit * 1024 * 1024,
    limit,
  };
}
