import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
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
const DOCX_EXTENSIONS = new Set([".docx", ".doc"]);
const XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

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

export type FileContentType = "image" | "pdf" | "text" | "docx" | "xlsx";

export async function getFileContent(filePath: string) {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    const ext = path.extname(fullPath).toLowerCase();

    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isPdf = PDF_EXTENSIONS.has(ext);
    const isDocx = DOCX_EXTENSIONS.has(ext);
    const isXlsx = XLSX_EXTENSIONS.has(ext);

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

    // Handle DOCX files
    if (DOCX_EXTENSIONS.has(ext)) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString("base64");

      return { content: base64, isTruncated: false, contentType: "docx" as const };
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
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
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
        contentType: "xlsx" as const 
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
