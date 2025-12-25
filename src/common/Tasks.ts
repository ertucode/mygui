import { ArchiveTypes } from "./ArchiveTypes";
import { GenericResult } from "./GenericError";

export type TaskDefinition = Tasks.Base & (Tasks.Archive | Tasks.Unarchive);

export type TaskDefinitionWithoutId = Omit<TaskDefinition, "id">;

export namespace Tasks {
  export type Base = {
    id: string;
    progress: number;
  };

  export type Archive = {
    type: "archive";
    metadata: {
      type: ArchiveTypes.ArchiveType;
    } & ArchiveTypes.ArchiveOpts;
    result?: ArchiveTypes.ArchiveResult;
  };

  export type Unarchive = {
    type: "unarchive";
    metadata: {
      type: ArchiveTypes.ArchiveType;
    } & ArchiveTypes.UnarchiveOpts;
    result?: ArchiveTypes.UnarchiveResult;
  };
}

export type TaskEvents =
  | {
      type: "create";
      task: TaskDefinition;
    }
  | {
      type: "progress";
      id: string;
      progress: number;
    }
  | {
      type: "result";
      id: string;
      result: GenericResult<unknown>;
    };
