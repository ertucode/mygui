import { spawn } from "child_process";
import path from "path";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { rgPath } from "./get-vendor-path.js";
import { errorToString } from "../../common/errorToString.js";
import {
  ContextLine,
  StringSearchOptions,
  StringSearchResult,
} from "../../common/Contracts.js";

const CONTEXT_LINES = 15; // 15 lines before and after = 30 lines total around match

export function searchStringRecursively(
  options: StringSearchOptions,
  signal?: AbortSignal,
) {
  const {
    directory,
    query,
    cwd,
    includePatterns = [],
    excludePatterns = [],
    useRegex = false,
    caseSensitive = false,
    searchHidden = true,
  } = options;

  return new Promise<GenericResult<StringSearchResult[]>>((resolve, reject) => {
    if (!query.trim()) {
      resolve(Result.Success([]));
      return;
    }

    // Build the search directory path
    // If cwd starts with / or ~, treat it as an absolute path
    const isAbsolutePath = cwd && (cwd.startsWith("/") || cwd.startsWith("~"));
    let searchDir: string;

    if (isAbsolutePath) {
      searchDir = expandHome(cwd);
    } else {
      const baseDir = expandHome(directory);
      searchDir = cwd ? path.join(baseDir, cwd) : baseDir;
    }

    // Build ripgrep arguments
    const args: string[] = [
      "--line-number",
      "--no-heading",
      "--glob=!**/.git/**",
      `--context=${CONTEXT_LINES}`,
      "--context-separator=<<<RG_CONTEXT_SEP>>>",
      "--max-count=10", // Limit matches per file since we're getting lots of context
    ];

    // Hidden files toggle
    if (searchHidden) {
      args.push("--hidden");
    }

    // Case sensitivity
    if (caseSensitive) {
      args.push("--case-sensitive");
    } else {
      args.push("--smart-case");
    }

    // Regex mode
    if (!useRegex) {
      args.push("--fixed-strings");
    }

    // Include patterns (glob)
    for (const pattern of includePatterns) {
      if (pattern.trim()) {
        args.push(`--glob=${pattern.trim()}`);
      }
    }

    // Exclude patterns (glob with !)
    for (const pattern of excludePatterns) {
      if (pattern.trim()) {
        args.push(`--glob=!${pattern.trim()}`);
      }
    }

    // Add query and search path
    args.push(query, ".");

    const child = spawn(rgPath, args, {
      cwd: searchDir,
    });

    // Handle abort signal
    if (signal) {
      const onAbort = () => {
        child.kill("SIGTERM");
        reject(new Error("AbortError"));
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });

      child.on("close", () => {
        signal.removeEventListener("abort", onAbort);
      });
    }

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      console.error("rg stderr:", chunk.toString());
    });

    child.on("error", (err) => {
      console.error(err);
      resolve(GenericError.Message(errorToString(err)));
    });

    child.on("close", (code) => {
      // rg exits with code 1 when no matches found, which is not an error
      if (code !== 0 && code !== 1) {
        return resolve(GenericError.Unknown(`rg exited with ${code}`));
      }

      const results = parseRipgrepOutput(output);
      resolve(Result.Success(results.slice(0, 100))); // Limit to 100 results
    });
  });
}

function parseRipgrepOutput(output: string): StringSearchResult[] {
  const results: StringSearchResult[] = [];

  // Split by context separator
  const blocks = output.split("<<<RG_CONTEXT_SEP>>>");

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim());
    if (lines.length === 0) continue;

    const contextLines: ContextLine[] = [];
    let matchLineNumber: number | null = null;
    let matchContent: string | null = null;
    let currentFilePath: string | null = null;

    for (const line of lines) {
      // Format for match: filePath:lineNumber:content
      // Format for context: filePath-lineNumber-content

      // Try to parse as match first (uses :)
      const matchResult = parseLineAsMatch(line);
      if (matchResult) {
        if (currentFilePath === null) {
          currentFilePath = matchResult.filePath;
        }
        // Only process lines from the same file
        if (matchResult.filePath === currentFilePath) {
          if (matchResult.isMatch && matchLineNumber === null) {
            matchLineNumber = matchResult.lineNumber;
            matchContent = matchResult.content;
          }
          contextLines.push({
            lineNumber: matchResult.lineNumber,
            content: matchResult.content,
            isMatch: matchResult.isMatch,
          });
        }
      }
    }

    if (currentFilePath && matchLineNumber !== null && matchContent !== null) {
      // Sort context lines by line number
      contextLines.sort((a, b) => a.lineNumber - b.lineNumber);

      results.push({
        filePath: currentFilePath,
        matchLineNumber,
        matchContent,
        contextLines,
      });
    }
  }

  return results;
}

function parseLineAsMatch(line: string): {
  filePath: string;
  lineNumber: number;
  content: string;
  isMatch: boolean;
} | null {
  // Find the pattern: path followed by : or - then number then : or -
  // We need to handle Windows paths and paths with colons carefully

  // Look for :number: or -number- pattern
  const matchPattern = /:(\d+):/;
  const contextPattern = /-(\d+)-/;

  let isMatch = false;
  let match = line.match(matchPattern);
  if (match && match.index !== undefined) {
    isMatch = true;
    const filePath = line.slice(0, match.index);
    const lineNumber = parseInt(match[1], 10);
    const content = line.slice(match.index + match[0].length);

    if (!isNaN(lineNumber) && filePath) {
      return { filePath, lineNumber, content, isMatch };
    }
  }

  match = line.match(contextPattern);
  if (match && match.index !== undefined) {
    isMatch = false;
    const filePath = line.slice(0, match.index);
    const lineNumber = parseInt(match[1], 10);
    const content = line.slice(match.index + match[0].length);

    if (!isNaN(lineNumber) && filePath) {
      return { filePath, lineNumber, content, isMatch };
    }
  }

  return null;
}
