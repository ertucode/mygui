import path from "path";

const base =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), "vendor-bin")
    : path.join(process.resourcesPath, "vendor-bin");

export const rgPath = path.join(base, "rg");
export const fzyPath = path.join(base, "fzy", "fzy");
