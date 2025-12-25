// scripts/build-7z.mjs
import { download } from "./utils/download.mjs";
import { exec as _exec } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import path from "path";
import os from "os";

const exec = promisify(_exec);

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const OUT = path.join(ROOT, "vendor-bin");
await fs.mkdir(OUT, { recursive: true });

console.log("→ Downloading 7-Zip...");

// Try to download 7-Zip standalone console version for macOS
const SEVENZIP_URL = "https://www.7-zip.org/a/7z2408-mac.tar.xz";
const tmpFile = path.join(os.tmpdir(), "7z.tar.xz");

try {
  await download(SEVENZIP_URL, tmpFile);
  
  console.log("→ Extracting...");
  const tmpDir = path.join(os.tmpdir(), "7z-extract");
  await fs.mkdir(tmpDir, { recursive: true });
  
  // Extract tar.xz
  await exec(`tar -xf "${tmpFile}" -C "${tmpDir}"`);
  
  // Find the 7zz binary (newer versions use 7zz instead of 7z)
  const files = await fs.readdir(tmpDir);
  const binary = files.find((f) => f === "7zz" || f === "7z" || f === "7za");
  
  if (binary) {
    const sourcePath = path.join(tmpDir, binary);
    const destPath = path.join(OUT, "7z");
    await fs.copyFile(sourcePath, destPath);
    await fs.chmod(destPath, 0o755);
    console.log(`✔ 7z installed into vendor-bin/7z (from ${binary})`);
  } else {
    throw new Error("7z binary not found in archive");
  }
  
  // Cleanup
  await fs.rm(tmpDir, { recursive: true });
  await fs.unlink(tmpFile).catch(() => {});
} catch (err) {
  console.error("✗ Failed to download 7z:", err.message);
  console.log("→ Checking if 7z is available via Homebrew...");
  
  // Try to copy from Homebrew installation as fallback
  try {
    const brewPath = "/opt/homebrew/bin/7z";
    try {
      await fs.access(brewPath);
      await fs.copyFile(brewPath, path.join(OUT, "7z"));
      await fs.chmod(path.join(OUT, "7z"), 0o755);
      console.log("✔ 7z copied from Homebrew installation");
    } catch {
      // Try Intel Homebrew path
      const intelBrewPath = "/usr/local/bin/7z";
      await fs.access(intelBrewPath);
      await fs.copyFile(intelBrewPath, path.join(OUT, "7z"));
      await fs.chmod(path.join(OUT, "7z"), 0o755);
      console.log("✔ 7z copied from Homebrew installation (Intel)");
    }
  } catch {
    console.log("⚠ Could not install 7z. Install manually: brew install p7zip");
  }
}
