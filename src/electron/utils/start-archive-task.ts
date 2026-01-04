import { ArchiveTypes } from "../../common/ArchiveTypes.js";
import { GenericError } from "../../common/GenericError.js";
import { Tasks } from "../../common/Tasks.js";
import { TaskManager } from "../TaskManager.js";
import { Archive } from "./archive/Archive.js";
import { expandHome } from "./expand-home.js";

type StartArchiveRequest = {
  archiveType: ArchiveTypes.ArchiveType;
  source: string[];
  destination: string;
  clientMetadata: Tasks.ClientMetadata;
};

type StartUnarchiveRequest = {
  archiveType: ArchiveTypes.ArchiveType;
  source: string;
  destination: string;
  clientMetadata: Tasks.ClientMetadata;
};

export async function startArchive(
  request: StartArchiveRequest,
): Promise<void> {
  const { archiveType, source, destination, clientMetadata } = request;

  // Expand home paths
  const expandedSource = source.map(expandHome);
  const expandedDestination = expandHome(destination);

  // Create a dummy abort controller and progress callback
  const dummyAbortController = new AbortController();
  const dummyProgressCallback = () => {};

  // Create the task in TaskManager and get the ID
  const taskId = TaskManager.create({
    type: "archive",
    progress: 0,
    metadata: {
      type: archiveType,
      source: expandedSource,
      destination: expandedDestination,
      progressCallback: dummyProgressCallback,
      abortSignal: dummyAbortController.signal,
    },
    clientMetadata,
  });

  // Start the archive operation asynchronously
  // We don't await this - it runs in the background
  (async () => {
    try {
      const abortSignal = TaskManager.getAbortSignal(taskId);
      if (!abortSignal) {
        throw new Error("Task not found after creation");
      }

      const opts: ArchiveTypes.ArchiveOpts = {
        source: expandedSource,
        destination: expandedDestination,
        progressCallback: (progress: number) => {
          TaskManager.progress(taskId, progress);
        },
        abortSignal,
      };

      const result = await Archive.archive(archiveType, opts);

      // Report the result
      TaskManager.result(taskId, result);
    } catch (error) {
      // Report error result
      TaskManager.result(taskId, GenericError.Unknown(error));
    }
  })();

  // Return immediately - the task will run asynchronously
}

export async function startUnarchive(
  request: StartUnarchiveRequest,
): Promise<void> {
  const { archiveType, source, destination, clientMetadata } = request;

  // Expand home paths
  const expandedSource = expandHome(source);
  const expandedDestination = expandHome(destination);

  // Create a dummy abort controller and progress callback
  const dummyAbortController = new AbortController();
  const dummyProgressCallback = () => {};

  // Create the task in TaskManager and get the ID
  const taskId = TaskManager.create({
    type: "unarchive",
    progress: 0,
    metadata: {
      type: archiveType,
      source: expandedSource,
      destination: expandedDestination,
      progressCallback: dummyProgressCallback,
      abortSignal: dummyAbortController.signal,
    },
    clientMetadata,
  });

  // Start the unarchive operation asynchronously
  // We don't await this - it runs in the background
  (async () => {
    try {
      const abortSignal = TaskManager.getAbortSignal(taskId);
      if (!abortSignal) {
        throw new Error("Task not found after creation");
      }

      const opts: ArchiveTypes.UnarchiveOpts = {
        source: expandedSource,
        destination: expandedDestination,
        progressCallback: (progress: number) => {
          TaskManager.progress(taskId, progress);
        },
        abortSignal,
      };

      const result = await Archive.unarchive(archiveType, opts);

      // Report the result
      TaskManager.result(taskId, result);
    } catch (error) {
      // Report error result
      TaskManager.result(taskId, GenericError.Unknown(error));
    }
  })();

  // Return immediately - the task will run asynchronously
}
