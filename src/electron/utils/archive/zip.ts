import fs from "fs";
import archiver from "archiver";
import unzipper from "unzipper";
import { PathHelpers } from "../../../common/PathHelpers.js";
import { Archive } from "./Archive.js";
import { Result } from "../../../common/Result.js";
import { GenericError } from "../../../common/GenericError.js";

export namespace Zip {
  export function archive(
    opts: Archive.ArchiveOpts,
  ): Promise<Archive.ArchiveResult> {
    return new Promise<Archive.ArchiveResult>((resolve) => {
      const { source, destination, progressCallback, abortSignal } = opts;

      const zipPath = PathHelpers.withExtension(destination, ".zip");
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      let settled = false;
      let completedSuccessfully = false;

      const cleanupPartialZip = async () => {
        if (completedSuccessfully) return;

        try {
          await fs.promises.unlink(zipPath);
        } catch (err: any) {
          // Ignore missing file or concurrent cleanup
          if (err?.code !== "ENOENT") {
            console.warn("Failed to cleanup partial zip:", err);
          }
        }
      };

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;

        archive.removeAllListeners();
        output.removeAllListeners();

        if (err) {
          // fire-and-forget cleanup
          void cleanupPartialZip();
          resolve(GenericError.Unknown(err));
        } else {
          completedSuccessfully = true;
          resolve(Result.Success(undefined));
        }
      };

      // -----------------
      // SUCCESS
      // -----------------
      output.on("close", () => {
        progressCallback?.(100); // Ensure we reach 100% on completion
        finish();
      });

      // -----------------
      // ERRORS
      // -----------------
      output.on("error", finish);
      archive.on("error", finish);

      archive.on("warning", (err) => {
        if (err.code !== "ENOENT") {
          finish(err);
        }
      });

      // -----------------
      // PROGRESS
      // -----------------
      if (progressCallback) {
        archive.on("progress", ({ fs }) => {
          if (fs.totalBytes > 0) {
            progressCallback((fs.processedBytes / fs.totalBytes) * 100);
          }
        });
      }

      // -----------------
      // CANCELLATION
      // -----------------
      const cancel = () => {
        const err = new Error("Archive cancelled");

        archive.abort(); // stop compression
        output.destroy(err); // release fd immediately

        finish(err);
      };

      if (abortSignal.aborted) {
        return cancel();
      }
      abortSignal.addEventListener("abort", cancel, { once: true });

      // -----------------
      // PIPE + INPUT
      // -----------------
      archive.pipe(output);

      try {
        // Add all source files/directories to the archive
        for (const sourcePath of source) {
          if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
            archive.directory(sourcePath, PathHelpers.getLastPathPart(sourcePath));
          } else {
            archive.file(sourcePath, {
              name: PathHelpers.getLastPathPart(sourcePath),
            });
          }
        }

        archive.finalize();
      } catch (err) {
        finish(err as Error);
      }
    });
  }

  export function unarchive(
    opts: Archive.UnarchiveOpts,
  ): Promise<Archive.UnarchiveResult> {
    return new Promise<Archive.UnarchiveResult>((resolve) => {
      const {
        source, // .zip file
        destination, // folder
        progressCallback,
        abortSignal,
      } = opts;

      let settled = false;
      let completedSuccessfully = false;

      const totalBytes = fs.statSync(source).size;
      let processedBytes = 0;

      const cleanupPartialExtract = async () => {
        if (completedSuccessfully) return;

        try {
          await fs.promises.rm(destination, {
            recursive: true,
            force: true,
          });
        } catch {
          // best-effort cleanup
        }
      };

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;

        if (err) {
          void cleanupPartialExtract();
          resolve(GenericError.Unknown(err));
        } else {
          completedSuccessfully = true;
          resolve(Result.Success(undefined));
        }
      };

      // -----------------
      // STREAM SETUP
      // -----------------
      const readStream = fs.createReadStream(source);

      readStream.on("data", (chunk) => {
        processedBytes += chunk.length;
        if (progressCallback && totalBytes > 0) {
          progressCallback((processedBytes / totalBytes) * 100);
        }
      });

      readStream.on("error", finish);

      const extractor = unzipper.Extract({ path: destination });

      extractor.on("close", () => {
        progressCallback?.(100); // Ensure we reach 100% on completion
        finish();
      });
      extractor.on("error", finish);

      // -----------------
      // CANCELLATION
      // -----------------
      const cancel = () => {
        const err = new Error("Unarchive cancelled");

        readStream.destroy(err);
        extractor.destroy(err);

        finish(err);
      };

      if (abortSignal.aborted) {
        return cancel();
      }
      abortSignal.addEventListener("abort", cancel, { once: true });

      // -----------------
      // PIPE
      // -----------------
      readStream.pipe(extractor);
    });
  }
}
