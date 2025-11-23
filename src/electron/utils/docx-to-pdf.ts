import { exec } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import clipboard from "clipboardy";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "docx-to-pdf-"));
}

function getUniqueFilePath(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  let counter = 1;
  let newPath: string;

  do {
    const suffix = counter.toString().padStart(2, "0");
    newPath = path.join(dir, `${baseName} (${suffix})${ext}`);
    counter++;
  } while (fs.existsSync(newPath));

  return newPath;
}

export async function convertDocxToPdf(
  inputFile: string,
  outputFile?: string,
  options?: { returnBase64?: boolean; copyBase64ToClipboard?: boolean },
) {
  return new Promise<string>((resolve, reject) => {
    const absInput = path.resolve(inputFile);
    const tempDir = makeTempDir(); // ← SAFE PLACE

    const basePDFName = path.basename(absInput).replace(/\.docx$/i, ".pdf");

    const finalOutput = outputFile
      ? path.resolve(outputFile)
      : path.join(path.dirname(absInput), basePDFName);

    const safeFinalOutput = getUniqueFilePath(finalOutput);

    const cmd = `/opt/homebrew/bin/soffice --headless --convert-to pdf --outdir "${tempDir}" "${absInput}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);

      const generated = path.join(tempDir, basePDFName);

      if (!fs.existsSync(generated)) {
        return reject(new Error("LibreOffice did not generate a PDF."));
      }

      fs.renameSync(generated, safeFinalOutput);
      fs.rmSync(tempDir, { recursive: true, force: true });

      if (options?.returnBase64 || options?.copyBase64ToClipboard) {
        const pdfBuffer = fs.readFileSync(safeFinalOutput);
        fs.rmSync(safeFinalOutput, { force: true });
        const base64 = pdfBuffer.toString("base64");
        resolve(base64);
        if (options?.copyBase64ToClipboard) {
          clipboard.writeSync(base64);
        }
      } else {
        resolve(safeFinalOutput);
      }
    });
  });
}
