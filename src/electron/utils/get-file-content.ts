import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { expandHome } from "./expand-home.js";
import {
  isImageExtension,
  isVideoExtension,
} from "../../common/file-category.js";
import { fileSizeTooLarge } from "../../common/file-size-too-large.js";

const PDF_EXTENSIONS = new Set([".pdf"]);
const DOCX_EXTENSIONS = new Set([".docx", ".doc"]);
const XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

// Video formats that Chromium can play natively
const PLAYABLE_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".ogv",
  ".ogg",
  ".mov", // QuickTime - works on macOS
]);

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export type FileContentType =
  | "image"
  | "pdf"
  | "text"
  | "docx"
  | "xlsx"
  | "video"
  | "video-unsupported";

export async function getFileContent(filePath: string, allowBigSize?: boolean) {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    const ext = path.extname(fullPath).toLowerCase();

    const isImage = isImageExtension(ext);
    const isPdf = PDF_EXTENSIONS.has(ext);
    const isXlsx = XLSX_EXTENSIONS.has(ext);
    const isVideo = isVideoExtension(ext);
    const isPlayableVideo = PLAYABLE_VIDEO_EXTENSIONS.has(ext);

    const stat = await fs.stat(fullPath);
    if (!allowBigSize && fileSizeTooLarge(filePath, stat.size).isTooLarge) {
      return { error: "FILE_TOO_LARGE" };
    }

    // Handle video files - just return file:// URL, browser streams it
    if (isVideo) {
      const stat = await fs.stat(fullPath);
      const fileSizeMB = (stat.size / 1024 / 1024).toFixed(2);

      if (isPlayableVideo) {
        // Return file URL for native playback - no data loading needed
        return {
          content: `file://${fullPath}`,
          isTruncated: false,
          contentType: "video" as const,
        };
      } else {
        // Unsupported format - return metadata
        return {
          content: JSON.stringify({
            path: fullPath,
            size: `${fileSizeMB} MB`,
            format: ext.replace(".", "").toUpperCase(),
            message:
              "This video format cannot be played in the browser. Use an external player.",
          }),
          isTruncated: false,
          contentType: "video-unsupported" as const,
        };
      }
    }

    // Handle image files
    if (isImage) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        content: dataUrl,
        isTruncated: false,
        contentType: "image" as const,
      };
    }

    // Handle PDF files
    if (isPdf) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");
      const mimeType = MIME_TYPES[ext] || "application/pdf";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        content: dataUrl,
        isTruncated: false,
        contentType: "pdf" as const,
      };
    }

    // Handle DOCX files
    if (DOCX_EXTENSIONS.has(ext)) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");

      return {
        content: base64,
        isTruncated: false,
        contentType: "docx" as const,
      };
    }

    // Handle XLSX/XLS/CSV files
    if (isXlsx) {
      const MAX_ROWS = 5000;
      const buffer = await fs.readFile(fullPath);
      const workbook = XLSX.read(buffer, { type: "buffer" });

      // Convert all sheets to JSON, limiting to MAX_ROWS total
      const sheets: Record<string, unknown[][]> = {};
      let totalRows = 0;
      let isTruncated = false;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
        }) as unknown[][];

        const remainingRows = MAX_ROWS - totalRows;
        if (remainingRows <= 0) {
          isTruncated = true;
          break;
        }

        if (rows.length > remainingRows) {
          sheets[sheetName] = rows.slice(0, remainingRows);
          totalRows += remainingRows;
          isTruncated = true;
        } else {
          sheets[sheetName] = rows;
          totalRows += rows.length;
        }
      }

      return {
        content: JSON.stringify(sheets),
        isTruncated,
        contentType: "xlsx" as const,
      };
    }

    // Read text file content
    const content = await fs.readFile(fullPath, "utf-8");

    return { content, isTruncated: false, contentType: "text" as const };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Unknown error reading file" };
  }
}
