import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { PathHelpers } from "@common/PathHelpers";
import { replacePlaceholders } from "@common/PlaceholderHelpers";

export type CaseConversion = "none" | "upper" | "lower" | "sentence" | "title";

export type BatchRenameOptions = {
  mask: string;
  findReplace?: {
    find: string;
    replace: string;
    useRegex: boolean;
    multiString: boolean; // Use | separator for multiple find strings
  };
  caseConversion: CaseConversion;
  counterStart: number;
  counterStep: number;
  counterPadding: number;
};

export type RenamePreview = {
  item: GetFilesAndFoldersInDirectoryItem;
  oldName: string;
  newName: string;
  error?: string;
};

/**
 * Parse mask placeholders and generate new filename
 * Supported placeholders:
 * - [N]: Original filename (without extension)
 * - [N1-5]: Characters 1-5 of filename
 * - [N2,3]: 3 characters starting at position 2
 * - [E]: File extension
 * - [C]: Counter
 * - [d]: Current date (YYYY-MM-DD)
 * - [t]: Current time (HH-MM-SS)
 * - [P]: Parent folder name
 *
 * Escaping: Use \[N\] to get literal "[N]" in the output
 */
export function applyMask(
  item: GetFilesAndFoldersInDirectoryItem,
  mask: string,
  counterValue: number,
  counterPadding: number,
): string {
  // Use the common placeholder replacement for base placeholders
  let result = replacePlaceholders(mask, {
    name: item.name,
    fullPath: item.fullPath,
    ext: item.ext as PathHelpers.DottedExtension,
    type: item.type,
  });

  // [C] - Counter with padding (specific to batch rename)
  result = result.replace(
    /\[C\]/g,
    counterValue.toString().padStart(counterPadding, "0"),
  );

  return result;
}

/**
 * Apply find and replace with support for masks in replacement string
 * Regex mode supports capture groups: $1, $2, etc.
 */
export function applyFindReplace(
  name: string,
  findReplace: BatchRenameOptions["findReplace"],
  item: GetFilesAndFoldersInDirectoryItem,
  counterValue: number,
  counterPadding: number,
): string {
  if (!findReplace || !findReplace.find) {
    return name;
  }

  const { find, replace, useRegex, multiString } = findReplace;

  // Helper function to process replacement text with masks
  const processReplacement = (
    replacementText: string,
    matchedText?: string,
    ...captureGroups: string[]
  ): string => {
    let processed = replacementText;

    // First, replace regex capture groups ($1, $2, etc.) if in regex mode
    if (useRegex && captureGroups.length > 0) {
      captureGroups.forEach((group, index) => {
        if (group !== undefined) {
          processed = processed.replace(
            new RegExp(`\\$${index + 1}`, "g"),
            group,
          );
        }
      });
      // Also support $0 for the full match
      if (matchedText !== undefined) {
        processed = processed.replace(/\$0/g, matchedText);
      }
    }

    // Then apply mask placeholders to the replacement string
    // We create a temporary item with the current name for mask processing
    const tempItem = { ...item, name: matchedText || name };
    processed = applyMask(tempItem, processed, counterValue, counterPadding);

    return processed;
  };

  if (multiString && !useRegex) {
    // Multi-string mode: split by | and replace each
    const findStrings = find.split("|");
    let result = name;
    for (const findStr of findStrings) {
      const processedReplace = processReplacement(replace);
      result = result.split(findStr).join(processedReplace);
    }
    return result;
  } else if (useRegex) {
    try {
      const regex = new RegExp(find, "g");
      return name.replace(regex, (match, ...args) => {
        // args contains: capture groups..., offset, string, groups object
        const captureGroups = args.slice(0, -2); // Remove offset and string
        return processReplacement(replace, match, ...captureGroups);
      });
    } catch (e) {
      // Invalid regex, return original
      return name;
    }
  } else {
    // Simple find/replace
    const processedReplace = processReplacement(replace);
    return name.split(find).join(processedReplace);
  }
}

/**
 * Apply case conversion
 */
export function applyCaseConversion(
  name: string,
  caseType: CaseConversion,
): string {
  switch (caseType) {
    case "upper":
      return name.toUpperCase();
    case "lower":
      return name.toLowerCase();
    case "sentence":
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    case "title":
      return name
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");
    case "none":
    default:
      return name;
  }
}

/**
 * Generate preview for all items
 */
export function generateRenamePreview(
  items: GetFilesAndFoldersInDirectoryItem[],
  options: BatchRenameOptions,
): RenamePreview[] {
  return items.map((item, index) => {
    try {
      const counterValue = options.counterStart + index * options.counterStep;

      // Step 1: Apply mask
      let newName = applyMask(
        item,
        options.mask,
        counterValue,
        options.counterPadding,
      );

      // Step 2: Apply find/replace (now with mask support)
      newName = applyFindReplace(
        newName,
        options.findReplace,
        item,
        counterValue,
        options.counterPadding,
      );

      // Step 3: Apply case conversion
      newName = applyCaseConversion(newName, options.caseConversion);

      // Validate the new name
      if (!newName || newName.trim() === "") {
        return {
          item,
          oldName: item.name,
          newName: item.name,
          error: "New name cannot be empty",
        };
      }

      // Check for invalid characters
      if (/[<>:"|?*]/.test(newName)) {
        return {
          item,
          oldName: item.name,
          newName: item.name,
          error: "Name contains invalid characters",
        };
      }

      return {
        item,
        oldName: item.name,
        newName,
      };
    } catch (error) {
      return {
        item,
        oldName: item.name,
        newName: item.name,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}

/**
 * Check for duplicate names in the preview
 */
export function checkDuplicates(previews: RenamePreview[]): RenamePreview[] {
  const nameCount = new Map<string, number>();

  // Count occurrences
  for (const preview of previews) {
    if (!preview.error) {
      nameCount.set(preview.newName, (nameCount.get(preview.newName) || 0) + 1);
    }
  }

  // Mark duplicates
  return previews.map((preview) => {
    if (!preview.error && nameCount.get(preview.newName)! > 1) {
      return {
        ...preview,
        error: "Duplicate name",
      };
    }
    return preview;
  });
}
