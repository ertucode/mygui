// scripts/build-unrar.mjs
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

console.log("→ Attempting to get unrar...");

// Try multiple sources for unrar
const UNRAR_URLS = [
  "https://www.rarlab.com/rar/rarmacos-x64-700.tar.gz",
  "https://www.rarlab.com/rar/rarmacos-arm-700.tar.gz",
];

let success = false;

for (const UNRAR_URL of UNRAR_URLS) {
  if (success) break;
  
  console.log(`→ Trying ${UNRAR_URL}...`);
  const tmpFile = path.join(os.tmpdir(), "unrar.tar.gz");

  try {
    await download(UNRAR_URL, tmpFile);

    console.log("→ Extracting...");
    const tmpDir = path.join(os.tmpdir(), "unrar-extract");
    await fs.mkdir(tmpDir, { recursive: true });
    await exec(`tar -xzf "${tmpFile}" -C "${tmpDir}"`);

    // Look for unrar or rar binary
    const dirContents = await fs.readdir(tmpDir);
    
    for (const item of dirContents) {
      const itemPath = path.join(tmpDir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && (item === "rar" || item === "unrar")) {
        // Look inside the directory
        const subItems = await fs.readdir(itemPath);
        const binary = subItems.find(f => f === "unrar" || f === "rar");
        if (binary) {
          const sourcePath = path.join(itemPath, binary);
          const sourcestat = await fs.stat(sourcePath);
          if (sourcestat.isFile()) {
            const destPath = path.join(OUT, "unrar");
            await fs.copyFile(sourcePath, destPath);
            await fs.chmod(destPath, 0o755);
            console.log("✔ unrar installed into vendor-bin/unrar");
            success = true;
            break;
          }
        }
      } else if (stat.isFile() && (item === "unrar" || item === "rar")) {
        const destPath = path.join(OUT, "unrar");
        await fs.copyFile(itemPath, destPath);
        await fs.chmod(destPath, 0o755);
        console.log("✔ unrar installed into vendor-bin/unrar");
        success = true;
        break;
      }
    }

    // Cleanup
    await fs.rm(tmpDir, { recursive: true }).catch(() => {});
    await fs.unlink(tmpFile).catch(() => {});
  } catch (err) {
    console.log(`  Failed: ${err.message}`);
  }
}

if (!success) {
  console.log("→ Checking if unrar is available via Homebrew...");
  
  try {
    const brewPath = "/opt/homebrew/bin/unrar";
    try {
      await fs.access(brewPath);
      await fs.copyFile(brewPath, path.join(OUT, "unrar"));
      await fs.chmod(path.join(OUT, "unrar"), 0o755);
      console.log("✔ unrar copied from Homebrew installation");
      success = true;
    } catch {
      // Try Intel Homebrew path
      const intelBrewPath = "/usr/local/bin/unrar";
      await fs.access(intelBrewPath);
      await fs.copyFile(intelBrewPath, path.join(OUT, "unrar"));
      await fs.chmod(path.join(OUT, "unrar"), 0o755);
      console.log("✔ unrar copied from Homebrew installation (Intel)");
      success = true;
    }
  } catch {
    console.log("⚠ Could not install unrar. Install manually: brew install unrar");
  }
}
