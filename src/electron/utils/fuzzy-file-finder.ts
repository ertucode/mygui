import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { listFilesRecursively } from "./list-files-recursively.js";
import { fuzzyPerformant } from "./fuzzy-performant.js";

type CachedDirectory = {
  path: string;
  files: string[];
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

export async function fuzzyFileFinder(
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

  // Load files if directory changed, not cached, or cache expired
  const now = Date.now();
  const isCacheExpired = cachedDirectory && (now - cachedDirectory.timestamp) > CACHE_DURATION_MS;
  
  if (!cachedDirectory || cachedDirectory.path !== directory || isCacheExpired) {
    const abortController = new AbortController();
    const promise = listFilesRecursively(directory, abortController.signal);
    
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
        files: result.data,
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

  // If no query, return first 100 files
  if (!query.trim()) {
    return Result.Success(cachedDirectory.files.slice(0, 100));
  }

  // Perform fuzzy search
  const result = await fuzzyPerformant(cachedDirectory.files, query);
  if (!result.success) {
    return result;
  }

  // Return top 100 results
  return Result.Success(result.data.slice(0, 100));
}
