import { spawn } from "child_process";
import os from "os";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { fdPath } from "./get-vendor-path.js";
import { errorToString } from "../../common/errorToString.js";
import { fuzzyPerformant } from "./fuzzy-performant.js";

type CachedDirectory = {
  path: string;
  folders: string[];
  timestamp: number;
};

type PendingRequest = {
  directory: string;
  promise: Promise<GenericResult<string[]>>;
  abortController: AbortController;
};

const CACHE_DURATION_MS = 5000; // 5 seconds

let cachedDirectory: CachedDirectory | null = null;
let pendingRequest: PendingRequest | null = null;

export async function fuzzyFolderFinder(
  directory: string,
  query: string,
): Promise<GenericResult<string[]>> {
  // If there's a pending request for a different directory, cancel it
  if (pendingRequest && pendingRequest.directory !== directory) {
    pendingRequest.abortController.abort();
    pendingRequest = null;
  }

  // If there's a pending request for the same directory, wait for it
  if (pendingRequest && pendingRequest.directory === directory) {
    try {
      await pendingRequest.promise;
    } catch (error) {
      // Ignore errors from aborted requests
      if ((error as Error).name === "AbortError") {
        // Request was aborted, continue with current request
      }
    }
  }

  // Load folders if directory changed, not cached, or cache expired
  const now = Date.now();
  const isCacheExpired =
    cachedDirectory && now - cachedDirectory.timestamp > CACHE_DURATION_MS;

  if (
    !cachedDirectory ||
    cachedDirectory.path !== directory ||
    isCacheExpired
  ) {
    const abortController = new AbortController();
    const promise = listFoldersRecursively(directory, abortController.signal);

    pendingRequest = {
      directory,
      promise,
      abortController,
    };

    try {
      const result = await promise;

      // Clear pending request only if it's still ours
      if (pendingRequest?.directory === directory) {
        pendingRequest = null;
      }

      if (!result.success) {
        return result;
      }
      cachedDirectory = {
        path: directory,
        folders: result.data,
        timestamp: Date.now(),
      };
    } catch (error) {
      // Clear pending request on error
      if (pendingRequest?.directory === directory) {
        pendingRequest = null;
      }

      // Re-throw abort errors to be handled by caller
      if ((error as Error).message === "AbortError") {
        throw error;
      }

      return GenericError.Unknown(error);
    }
  }

  // If no query, return first 100 folders
  if (!query.trim()) {
    return Result.Success(cachedDirectory.folders.slice(0, 100));
  }

  // Perform fuzzy search
  const result = await fuzzyPerformant(cachedDirectory.folders, query);
  if (!result.success) {
    return result;
  }

  // Return top 100 results
  return Result.Success(result.data.slice(0, 100));
}

function listFoldersRecursively(
  target: string,
  signal?: AbortSignal,
): Promise<GenericResult<string[]>> {
  return new Promise<GenericResult<string[]>>((resolve, reject) => {
    const expandedTarget = expandHome(target);
    const isHomeDir = expandedTarget === os.homedir();

    const args = [
      "--type",
      "d", // directories only
      "--hidden",
      "--follow",
      "--exclude",
      ".git",
      "--exclude",
      "node_modules",
    ];

    // Only exclude Library and Trash when searching from home directory
    if (isHomeDir) {
      args.push("--exclude", "Library", "--exclude", ".Trash");
    }

    args.push(".", ".");

    const child = spawn(fdPath, args, {
      cwd: expandedTarget,
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
      console.error("fd stderr:", chunk.toString());
    });

    child.on("error", (err) => {
      console.error(err);
      resolve(GenericError.Message(errorToString(err)));
    });

    child.on("close", (code) => {
      // fd exits with code 1 when no matches found, which is not an error
      if (code !== 0 && code !== 1) {
        return resolve(GenericError.Unknown(`fd exited with ${code}`));
      }

      const folders = output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          // Remove leading "./" if present
          if (line.startsWith("./")) {
            return line.slice(2);
          }
          return line;
        })
        // Remove trailing slashes
        .map((line) => (line.endsWith("/") ? line.slice(0, -1) : line));

      resolve(Result.Success(folders));
    });
  });
}
