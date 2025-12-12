import { execFile } from "child_process";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { rgPath } from "./get-vendor-path.js";

export function listFilesRecursively(target: string) {
  return new Promise<GenericResult<string[]>>((resolve, _) => {
    execFile(
      rgPath,
      ["--files", "--hidden", "--follow", "--ignore-file", ".gitignore"],
      { cwd: expandHome(target) },
      (err, stdout) => {
        if (err) return resolve(GenericError.Unknown(err));
        resolve(Result.Success(stdout.trim().split("\n")));
      },
    );
  });
}
