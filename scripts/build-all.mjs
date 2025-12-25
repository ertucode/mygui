import { exec } from "node:child_process";

function run(script) {
  return new Promise((resolve, reject) => {
    const child = exec(`node scripts/${script}`, (err) => {
      if (err) reject(err);
      else resolve();
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

console.log("=== Building ripgrep ===");
const rg = run("build-rg.mjs");

console.log("=== Building fzy ===");
const fzy = run("build-fzy.mjs");

console.log("=== Building fd ===");
const fd = run("build-fd.mjs");

console.log("=== Building ffmpeg ===");
const ffmpeg = run("build-ffmpeg.mjs");

console.log("=== Building 7z ===");
const sevenZ = run("build-7z.mjs");

console.log("=== Building unrar ===");
const unrar = run("build-unrar.mjs");

Promise.all([rg, fzy, fd, ffmpeg, sevenZ, unrar])
  .then(() => console.log("✔ All vendors built"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
