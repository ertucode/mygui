import fs from "fs/promises";
import path from "path";
import { expandHome } from "./expand-home.js";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".svg",
]);

const PDF_EXTENSIONS = new Set([".pdf"]);

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

export type FileContentType = "image" | "pdf" | "text";

export async function getFileContent(filePath: string) {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    const ext = path.extname(fullPath).toLowerCase();

    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isPdf = PDF_EXTENSIONS.has(ext);

    // Handle image files
    if (isImage) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return { content: dataUrl, isTruncated: false, contentType: "image" as const };
    }

    // Handle PDF files
    if (isPdf) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");
      const mimeType = MIME_TYPES[ext] || "application/pdf";
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return { content: dataUrl, isTruncated: false, contentType: "pdf" as const };
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
