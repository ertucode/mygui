/**
 * Task management types for long-running operations
 */

export type TaskType = "archive-extract" | "archive-create" | "archive-read";

export type TaskStatus = "pending" | "running" | "completed" | "error" | "cancelled";

export type Task = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
  metadata: TaskMetadata;
  createdAt: number;
  updatedAt: number;
};

export type TaskMetadata = 
  | {
      type: "archive-extract";
      archivePath: string;
      destinationFolder: string;
      archiveFormat: string;
    }
  | {
      type: "archive-create";
      filePaths: string[];
      destinationPath: string;
      archiveFormat: string;
    }
  | {
      type: "archive-read";
      archivePath: string;
    };

export type TaskUpdate = {
  id: string;
  status?: TaskStatus;
  progress?: number;
  message?: string;
  error?: string;
};
