import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { expandHome } from "./expand-home.js";
import { fileSizeTooLarge } from "../../common/file-size-too-large.js";

const DOCX_EXTENSIONS = new Set([".docx", ".doc"]);
const XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

// Note: images, PDFs, and videos are now handled directly in the frontend
// using file:// URLs without making IPC calls

export type FileContentType = "text" | "docx" | "xlsx";

export async function getFileContent(filePath: string, allowBigSize?: boolean) {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    const ext = path.extname(fullPath).toLowerCase();

    const isXlsx = XLSX_EXTENSIONS.has(ext);

    const stat = await fs.stat(fullPath);
    if (!allowBigSize && fileSizeTooLarge(filePath, stat.size).isTooLarge) {
      return { error: "FILE_TOO_LARGE" };
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
