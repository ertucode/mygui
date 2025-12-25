import compressing from "compressing";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { createGunzip } from "zlib";
import { exec } from "child_process";
import { promisify } from "util";
import tarStream from "tar-stream";
import { expandHome } from "./expand-home.js";
import { sevenZPath, unrarPath } from "./get-vendor-path.js";
import { GenericError, GenericResult } from "../../common/GenericError.js";
import { Result } from "../../common/Result.js";
import {
  ArchiveFormat,
  ArchiveEntry,
  getArchiveFormat,
} from "../../common/archive-types.js";

const execAsync = promisify(exec);

// Get the appropriate binary path with fallback to system binary
function getBinaryPath(vendorPath: string, systemCommand: string): string {
  return existsSync(vendorPath) ? vendorPath : systemCommand;
}

const sevenZ = getBinaryPath(sevenZPath, "7z");
const unrar = getBinaryPath(unrarPath, "unrar");

/**
 * Read contents of an archive file
 */
export async function readArchiveContents(
  archivePath: string,
): Promise<GenericResult<ArchiveEntry[]>> {
  try {
    const expandedPath = expandHome(archivePath);
    const format = getArchiveFormat(path.basename(expandedPath));

    if (!format) {
      return GenericError.Message("Unsupported archive format");
    }

    // Formats that don't support listing contents
    if (["gz", "bz2", "xz"].includes(format)) {
      return GenericError.Message(
        "This archive format doesn't support listing contents",
      );
    }

    const entries: ArchiveEntry[] = [];

    switch (format) {
      case "zip": {
        // Use AdmZip for better ZIP support
        const zip = new AdmZip(expandedPath);
        const zipEntries = zip.getEntries();
        zipEntries.forEach((entry) => {
          entries.push({
            name: entry.entryName,
            isDirectory: entry.isDirectory,
            size: entry.header.size,
            compressedSize: entry.header.compressedSize,
            comment: entry.comment,
          });
        });
        break;
      }

      case "tar":
      case "tar.gz":
      case "tgz":
      case "tar.bz2":
      case "tbz2":
      case "tar.xz":
      case "txz": {
        // Use tar-stream for tar-based formats
        const extract = await getTarStream(expandedPath, format);
        await new Promise<void>((resolve, reject) => {
          extract.on("entry", (header, stream, next) => {
            entries.push({
              name: header.name,
              isDirectory: header.type === "directory",
              size: header.size || 0,
            });
            stream.on("end", () => next());
            stream.resume();
          });
          extract.on("finish", resolve);
          extract.on("error", reject);
        });
        break;
      }

      case "7z": {
        // Use 7z command to list contents
        try {
          const { stdout } = await execAsync(`"${sevenZ}" l -slt "${expandedPath}"`);
          const lines = stdout.split("\n");
          let currentEntry: Partial<ArchiveEntry> = {};
          
          for (const line of lines) {
            if (line.startsWith("Path = ")) {
              const name = line.substring(7);
              if (currentEntry.name) {
                entries.push(currentEntry as ArchiveEntry);
              }
              currentEntry = { name };
            } else if (line.startsWith("Size = ")) {
              currentEntry.size = parseInt(line.substring(7)) || 0;
            } else if (line.startsWith("Folder = ")) {
              currentEntry.isDirectory = line.substring(9) === "+";
            }
          }
          
          if (currentEntry.name) {
            entries.push(currentEntry as ArchiveEntry);
          }
        } catch (error) {
          return GenericError.Message(
            "7Z listing requires 7z command-line tool (brew install p7zip)",
          );
        }
        break;
      }
      
      case "rar": {
        // Use unrar command to list contents
        try {
          const { stdout } = await execAsync(`"${unrar}" l -v "${expandedPath}"`);
          const lines = stdout.split("\n");
          
          for (const line of lines) {
            // Parse unrar output format
            const match = line.match(/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);
            if (match) {
              const [, size, , name] = match;
              entries.push({
                name: name.trim(),
                isDirectory: size === "0" && name.endsWith("/"),
                size: parseInt(size) || 0,
              });
            }
          }
        } catch (error) {
          return GenericError.Message(
            "RAR listing requires unrar command-line tool (brew install unrar)",
          );
        }
        break;
      }

      default:
        return GenericError.Message("Unsupported archive format");
    }

    return Result.Success(entries);
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}

/**
 * Extract an archive file
 */
export async function extractArchive(
  archivePath: string,
  destinationFolder: string,
): Promise<GenericResult<{ path: string }>> {
  try {
    const expandedArchivePath = expandHome(archivePath);
    const expandedDestination = expandHome(destinationFolder);
    const format = getArchiveFormat(path.basename(expandedArchivePath));

    if (!format) {
      return GenericError.Message("Unsupported archive format");
    }

    // Ensure destination directory exists
    await fs.mkdir(expandedDestination, { recursive: true });

    switch (format) {
      case "zip": {
        // Use AdmZip for ZIP files
        const zip = new AdmZip(expandedArchivePath);
        zip.extractAllTo(expandedDestination, false);
        break;
      }

      case "tar": {
        await compressing.tar.uncompress(
          expandedArchivePath,
          expandedDestination,
        );
        break;
      }

      case "tar.gz":
      case "tgz": {
        await compressing.tgz.uncompress(
          expandedArchivePath,
          expandedDestination,
        );
        break;
      }

      case "gz": {
        await compressing.gzip.uncompress(
          expandedArchivePath,
          expandedDestination,
        );
        break;
      }

      case "bz2": {
        // For bz2, we need to decompress to a file
        const outputFile = path.join(
          expandedDestination,
          path.basename(expandedArchivePath, ".bz2"),
        );
        await decompressBz2(expandedArchivePath, outputFile);
        break;
      }

      case "tar.bz2":
      case "tbz2": {
        // Decompress bz2 first, then extract tar
        const tempTarFile = path.join(
          expandedDestination,
          "_temp_extract.tar",
        );
        await decompressBz2(expandedArchivePath, tempTarFile);
        await compressing.tar.uncompress(tempTarFile, expandedDestination);
        await fs.unlink(tempTarFile);
        break;
      }

      case "xz": {
        // For xz, decompress to a file
        const outputFile = path.join(
          expandedDestination,
          path.basename(expandedArchivePath, ".xz"),
        );
        await decompressXz(expandedArchivePath, outputFile);
        break;
      }

      case "tar.xz":
      case "txz": {
        // Decompress xz first, then extract tar
        const tempTarFile = path.join(
          expandedDestination,
          "_temp_extract.tar",
        );
        await decompressXz(expandedArchivePath, tempTarFile);
        await compressing.tar.uncompress(tempTarFile, expandedDestination);
        await fs.unlink(tempTarFile);
        break;
      }

      case "7z": {
        // Extract using 7z command
        try {
          await execAsync(`"${sevenZ}" x "${expandedArchivePath}" -o"${expandedDestination}" -y`);
        } catch (error) {
          return GenericError.Message(
            "7Z extraction requires 7z command-line tool (brew install p7zip)",
          );
        }
        break;
      }

      case "rar": {
        // Extract using unrar command
        try {
          await execAsync(`"${unrar}" x -y "${expandedArchivePath}" "${expandedDestination}/"`);
        } catch (error) {
          return GenericError.Message(
            "RAR extraction requires unrar command-line tool (brew install unrar)",
          );
        }
        break;
      }

      default:
        return GenericError.Message("Unsupported archive format");
    }

    return Result.Success({ path: expandedDestination });
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}

/**
 * Create an archive from files
 */
export async function createArchive(
  filePaths: string[],
  destinationArchivePath: string,
  format: ArchiveFormat = "zip",
): Promise<GenericResult<{ path: string }>> {
  try {
    const expandedDestination = expandHome(destinationArchivePath);
    const expandedFilePaths = filePaths.map(expandHome);

    // Auto-detect format from destination path if not explicitly set
    const detectedFormat = getArchiveFormat(path.basename(expandedDestination));
    const finalFormat = detectedFormat || format;

    switch (finalFormat) {
      case "zip": {
        // Use AdmZip for ZIP files
        const zip = new AdmZip();

        for (const filePath of expandedFilePaths) {
          const stat = await fs.stat(filePath);
          const baseName = path.basename(filePath);

          if (stat.isDirectory()) {
            zip.addLocalFolder(filePath, baseName);
          } else {
            zip.addLocalFile(filePath);
          }
        }

        zip.writeZip(expandedDestination);
        break;
      }

      case "tar": {
        if (expandedFilePaths.length === 1) {
          const stat = await fs.stat(expandedFilePaths[0]);
          if (stat.isDirectory()) {
            await compressing.tar.compressDir(expandedFilePaths[0], expandedDestination);
          } else {
            await compressing.tar.compressFile(expandedFilePaths[0], expandedDestination);
          }
        } else {
          // For multiple files, create a tar with all files
          const tarStream = new compressing.tar.Stream();
          for (const filePath of expandedFilePaths) {
            await tarStream.addEntry(filePath);
          }
          const destStream = createWriteStream(expandedDestination);
          await new Promise<void>((resolve, reject) => {
            tarStream.pipe(destStream).on("finish", () => resolve()).on("error", reject);
          });
        }
        break;
      }

      case "tar.gz":
      case "tgz": {
        if (expandedFilePaths.length === 1) {
          const stat = await fs.stat(expandedFilePaths[0]);
          if (stat.isDirectory()) {
            await compressing.tgz.compressDir(expandedFilePaths[0], expandedDestination);
          } else {
            await compressing.tgz.compressFile(expandedFilePaths[0], expandedDestination);
          }
        } else {
          const tgzStream = new compressing.tgz.Stream();
          for (const filePath of expandedFilePaths) {
            await tgzStream.addEntry(filePath);
          }
          const destStream = createWriteStream(expandedDestination);
          await new Promise<void>((resolve, reject) => {
            tgzStream.pipe(destStream).on("finish", () => resolve()).on("error", reject);
          });
        }
        break;
      }

      case "gz": {
        if (expandedFilePaths.length !== 1) {
          return GenericError.Message("GZIP can only compress single files");
        }
        await compressing.gzip.compressFile(expandedFilePaths[0], expandedDestination);
        break;
      }

      case "tar.bz2":
      case "tbz2": {
        // Create tar.bz2 using tar command-line tool
        try {
          const filesList = expandedFilePaths.map(p => `"${p}"`).join(" ");
          await execAsync(`tar -cjf "${expandedDestination}" ${filesList}`);
        } catch (error) {
          return GenericError.Message(
            "TAR.BZ2 creation requires the 'tar' command with bzip2 support to be installed",
          );
        }
        break;
      }

      case "tar.xz":
      case "txz": {
        // Create tar.xz using tar command-line tool
        try {
          const filesList = expandedFilePaths.map(p => `"${p}"`).join(" ");
          await execAsync(`tar -cJf "${expandedDestination}" ${filesList}`);
        } catch (error) {
          return GenericError.Message(
            "TAR.XZ creation requires the 'tar' command with xz support to be installed",
          );
        }
        break;
      }

      case "bz2": {
        // Single file bz2 compression
        if (expandedFilePaths.length !== 1) {
          return GenericError.Message("BZIP2 can only compress single files");
        }
        try {
          await execAsync(`bzip2 -c "${expandedFilePaths[0]}" > "${expandedDestination}"`);
        } catch (error) {
          return GenericError.Message(
            "BZ2 creation requires the 'bzip2' command to be installed",
          );
        }
        break;
      }

      case "xz": {
        // Single file xz compression
        if (expandedFilePaths.length !== 1) {
          return GenericError.Message("XZ can only compress single files");
        }
        try {
          await execAsync(`xz -c "${expandedFilePaths[0]}" > "${expandedDestination}"`);
        } catch (error) {
          return GenericError.Message(
            "XZ creation requires the 'xz' command to be installed",
          );
        }
        break;
      }

      case "7z": {
        // 7z creation using 7z command-line tool
        try {
          const filesList = expandedFilePaths.map(p => `"${p}"`).join(" ");
          await execAsync(`"${sevenZ}" a "${expandedDestination}" ${filesList}`);
        } catch (error) {
          return GenericError.Message(
            "7Z creation requires the '7z' or '7za' command-line tool to be installed (brew install p7zip)",
          );
        }
        break;
      }

      case "rar": {
        return GenericError.Message(
          "RAR creation is not supported. RAR is a proprietary format - please use ZIP or 7Z instead.",
        );
      }

      default:
        return GenericError.Message(
          `Creating ${finalFormat} archives is not yet supported. Supported formats: zip, tar, tar.gz, tgz, gz, tar.bz2, tar.xz, bz2, xz, 7z`,
        );
    }

    return Result.Success({ path: expandedDestination });
  } catch (error) {
    if (error instanceof Error) {
      return GenericError.Message(error.message);
    }
    return GenericError.Unknown(error);
  }
}

// Helper functions for bz2 and xz decompression using Node.js streams
async function decompressBz2(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  // BZ2 decompression using bzip2 command-line tool
  try {
    await execAsync(`bzip2 -dc "${inputPath}" > "${outputPath}"`);
  } catch {
    throw new Error(
      "BZ2 decompression requires the 'bzip2' command-line tool to be installed",
    );
  }
}

async function decompressXz(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  // XZ decompression using xz command-line tool
  try {
    await execAsync(`xz -dc "${inputPath}" > "${outputPath}"`);
  } catch {
    throw new Error(
      "XZ decompression requires the 'xz' command-line tool to be installed",
    );
  }
}

async function getTarStream(
  archivePath: string,
  format: ArchiveFormat,
): Promise<tarStream.Extract> {
  const extract = tarStream.extract();
  const fileStream = createReadStream(archivePath);

  switch (format) {
    case "tar":
      fileStream.pipe(extract);
      break;
    case "tar.gz":
    case "tgz":
      fileStream.pipe(createGunzip()).pipe(extract);
      break;
    case "tar.bz2":
    case "tbz2":
      throw new Error("BZ2 decompression not yet implemented for listing");
    case "tar.xz":
    case "txz":
      throw new Error("XZ decompression not yet implemented for listing");
  }

  return extract;
}
