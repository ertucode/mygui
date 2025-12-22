import fsP from "fs/promises";
import fs from "fs";
import path from "path";
import { expandHome } from "./expand-home.js";
import { fileSizeTooLarge } from "../../common/file-size-too-large.js";
import { parse } from "csv-parse";
import { WindowElectron } from "../../common/Contracts.js";
import { xlsxWorkerPool } from "./xlsx-worker-pool.js";

const DOCX_EXTENSIONS = new Set([".docx", ".doc"]);
const XLSX_EXTENSIONS = new Set([".xlsx", ".xls"]);

// Note: images, PDFs, and videos are now handled directly in the frontend
// using file:// URLs without making IPC calls

export type FileContentType = "text" | "docx" | "xlsx";

export async function getFileContent(
  filePath: string,
  allowBigSize?: boolean,
  fullSize: boolean = false,
): ReturnType<WindowElectron["readFilePreview"]> {
  try {
    // Expand home directory if needed
    const fullPath = expandHome(filePath);
    const ext = path.extname(fullPath).toLowerCase();

    const isXlsx = XLSX_EXTENSIONS.has(ext);

    const stat = await fsP.stat(fullPath);
    if (!allowBigSize && fileSizeTooLarge(filePath, stat.size).isTooLarge) {
      return { error: "FILE_TOO_LARGE" };
    }

    // Handle DOCX files
    if (DOCX_EXTENSIONS.has(ext)) {
      const buffer = await fsP.readFile(fullPath);
      const base64 = buffer.toString("base64");

      return {
        content: base64,
        isTruncated: false,
        contentType: "docx" as const,
      };
    }

    if (ext === ".csv")
      return {
        content: JSON.stringify({ csv: await readCsvWithLimit(fullPath, 50) }),
        isTruncated: false,
        contentType: "xlsx" as const,
      };

    // Handle XLSX/XLS/CSV files - use worker pool to avoid blocking main thread
    if (isXlsx) {
      const MAX_ROWS = fullSize ? 5000 : 50;
      
      try {
        const result = await xlsxWorkerPool.processXlsx(fullPath, MAX_ROWS);
        
        if (result.success) {
          return {
            content: JSON.stringify(result.sheets),
            isTruncated: result.isTruncated,
            contentType: "xlsx" as const,
          };
        } else {
          return { error: result.error };
        }
      } catch (error) {
        return { 
          error: error instanceof Error ? error.message : "Failed to read XLSX file" 
        };
      }
    }

    // Read text file content
    const content = await fsP.readFile(fullPath, "utf-8");

    return { content, isTruncated: false, contentType: "text" as const };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Unknown error reading file" };
  }
}
export async function readCsvWithLimit(
  filePath: string,
  maxRows: number,
): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    const stream = fs.createReadStream(filePath);

    const parser = parse({
      relax_quotes: true,
      relax_column_count: true,
    });

    parser.on("readable", () => {
      let record;
      while ((record = parser.read())) {
        rows.push(record);

        if (rows.length >= maxRows) {
          stream.destroy(); // stop reading file
          parser.end(); // stop parser
          resolve(rows);
          return;
        }
      }
    });

    parser.on("error", reject);
    parser.on("end", () => resolve(rows));

    stream.pipe(parser);
  });
}


