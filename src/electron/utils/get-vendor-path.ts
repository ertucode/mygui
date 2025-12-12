import path from "path";
import os from "os";

const base =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "vendor-bin")
    : path.join(process.resourcesPath, "vendor-bin");

const arch = os.arch();

function getRg() {
  if (arch === "arm64") return path.join(base, "rg-macos-arm64");
  else return path.join(base, "rg-macos-x64");
}

export const rgPath = getRg();
export const fzyPath = path.join(base, "fzy", "fzy");
