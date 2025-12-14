import { spawn } from "child_process";
import { expandHome } from "./expand-home.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import { rgPath } from "./get-vendor-path.js";
import os from "os";

export function listFilesRecursively(target: string, signal?: AbortSignal) {
  return new Promise<GenericResult<string[]>>((resolve, reject) => {
    const files: string[] = [];

    const errors: string[] = [];

    const expandedTarget = expandHome(target);
    const isHomeDir = expandedTarget === os.homedir();

    const args = [
      "--files",
      "--hidden",
      "--glob=!**/.git/**",
      "--smart-case",
    ];

    // Only exclude Library and Trash when searching from home directory
    if (isHomeDir) {
      args.splice(3, 0, "--glob=!Library/**", "--glob=!.Trash", "--glob=!.Trash/**");
    }

    const child = spawn(rgPath, args, {
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
      console.error("rg stderr data:", chunk.toString());
      errors.push(chunk.toString());
    });

    child.on("error", (err) => {
      console.error("rg onerror error:", err);
      resolve(GenericError.Unknown(err));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.log(`rg exited with ${code}`);
        return resolve(
          GenericError.Message(`rg exited with ${code} 
${errors.map((e) => e.trim()).join("\n")}`),
        );
      }
      resolve(Result.Success(files));
    });
  });
}
