import Fuse from "fuse.js";

import { getFilePaths, GetFilePathsOptions } from "./get-file-paths.js";
import os from "os";

export type GetInitializedFuzzyFinderOptions = {
  filePathOptions?: GetFilePathsOptions;
};
export async function getInitializedFuzzyFinder(
  opts?: GetInitializedFuzzyFinderOptions,
) {
  const homeDir = os.homedir();
  const files = (await getFilePaths(opts?.filePathOptions)).map((path) => {
    return {
      actual: path,
      key: path.replace(homeDir, "~"),
    };
  });

  return new Fuse(files, {
    threshold: 0.6,
    minMatchCharLength: 1,
    keys: ["key"],
  });
}
