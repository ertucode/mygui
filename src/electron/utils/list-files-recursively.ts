import { spawn } from "child_process";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { rgPath } from "./get-vendor-path.js";

export function listFilesRecursively(
  target: string,
  signal?: AbortSignal,
) {
  return new Promise<GenericResult<string[]>>((resolve, reject) => {
    const files: string[] = [];

    const child = spawn(
      rgPath,
      ["--files", "--hidden", "--follow", "--glob=!**/.git/**", "--smart-case"],
      {
        cwd: expandHome(target),
      },
    );

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

      // Clean up listener when process completes
      child.on("close", () => {
        signal.removeEventListener("abort", onAbort);
      });
    }

    child.stdout.on("data", (chunk) => {
      // chunk is usually a Buffer, can contain multiple files
      files.push(...chunk.toString().split("\n").filter(Boolean));
    });

    child.stderr.on("data", (chunk) => {
      console.error("rg stderr:", chunk.toString());
    });

    child.on("error", (err) => {
      resolve(GenericError.Unknown(err));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return resolve(GenericError.Unknown(`rg exited with ${code}`));
      }
      resolve(Result.Success(files));
    });
  });
}
