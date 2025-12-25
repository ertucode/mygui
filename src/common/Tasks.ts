import { ArchiveTypes } from "./ArchiveTypes";

export type Task = Tasks.Base & (Tasks.Archive | Tasks.Unarchive);

export namespace Tasks {
  export type Base = {
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
