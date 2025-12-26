const extract = require("extract-zip");
const path = require("path");
const fs = require("fs");

async function unzipRobust(zipPath, outputPath) {
  const fullPath = path.resolve(zipPath);
  const fullOutputDir = path.resolve(outputPath);
  const totalSize = fs.statSync(fullPath).size;
  let processedSize = 0;

  try {
    await extract(fullPath, {
      dir: fullOutputDir,
      onEntry: (entry, zipFile) => {
        // This tracks progress based on entries (files) processed
        processedSize = zipFile.entriesRead;
        console.log(processedSize, zipFile.entryCount);
      },
    });
    console.log("Extraction complete");
  } catch (err) {
    console.error("Extraction failed:", err);
  }
}

// Usage
unzipRobust(
  "/Users/cavitertugrulsirt/dev/react-native/ortak.zip",
  "/Users/cavitertugrulsirt/dev/react-native/ortakkkkkkkkkkk",
);
