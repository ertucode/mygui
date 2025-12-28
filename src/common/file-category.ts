/**
 * File categorization utility
 * Single source of truth for mapping file extensions to categories.
 * Based on MDN Common MIME types and IANA Media Types Registry.
 */

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "font"
  | "executable"
  | "other";

/**
 * Comprehensive mapping of file extensions to categories.
 * Extensions are lowercase without the leading dot.
 */
export const EXTENSION_CATEGORY_MAP: Record<string, FileCategory> = {
  // ─────────────────────────────────────────────────────────────────
  // IMAGE
  // ─────────────────────────────────────────────────────────────────
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  bmp: "image",
  webp: "image",
  svg: "image",
  ico: "image",
  tiff: "image",
  tif: "image",
  psd: "image",
  ai: "image",
  eps: "image",
  raw: "image",
  cr2: "image",
  nef: "image",
  orf: "image",
  sr2: "image",
  heic: "image",
  heif: "image",
  avif: "image",
  jxl: "image",
  icns: "image",

  // ─────────────────────────────────────────────────────────────────
  // VIDEO
  // ─────────────────────────────────────────────────────────────────
  mp4: "video",
  m4v: "video",
  mkv: "video",
  webm: "video",
  avi: "video",
  mov: "video",
  wmv: "video",
  flv: "video",
  f4v: "video",
  ogv: "video",
  "3gp": "video",
  "3g2": "video",
  mpeg: "video",
  mpg: "video",
  m2ts: "video",
  vob: "video",
  rm: "video",
  rmvb: "video",
  asf: "video",
  divx: "video",

  // ─────────────────────────────────────────────────────────────────
  // AUDIO
  // ─────────────────────────────────────────────────────────────────
  mp3: "audio",
  wav: "audio",
  flac: "audio",
  aac: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  m4a: "audio",
  wma: "audio",
  aiff: "audio",
  aif: "audio",
  ape: "audio",
  mka: "audio",
  mid: "audio",
  midi: "audio",
  ra: "audio",
  amr: "audio",
  ac3: "audio",
  dts: "audio",
  wv: "audio",

  // ─────────────────────────────────────────────────────────────────
  // DOCUMENT
  // ─────────────────────────────────────────────────────────────────
  pdf: "document",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  txt: "document",
  tex: "document",
  wpd: "document",
  pages: "document",
  epub: "document",
  mobi: "document",
  azw: "document",
  azw3: "document",
  djvu: "document",
  xps: "document",
  oxps: "document",

  // ─────────────────────────────────────────────────────────────────
  // SPREADSHEET
  // ─────────────────────────────────────────────────────────────────
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  xlsb: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  numbers: "spreadsheet",

  // ─────────────────────────────────────────────────────────────────
  // PRESENTATION
  // ─────────────────────────────────────────────────────────────────
  ppt: "presentation",
  pptx: "presentation",
  pptm: "presentation",
  odp: "presentation",
  key: "presentation",

  // ─────────────────────────────────────────────────────────────────
  // ARCHIVE
  // ─────────────────────────────────────────────────────────────────
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  "tar.gz": "archive",
  "tar.bz2": "archive",
  "tar.xz": "archive",
  gz: "archive",
  gzip: "archive",
  bz2: "archive",
  xz: "archive",
  lz: "archive",
  lzma: "archive",
  lzo: "archive",
  zst: "archive",
  cab: "archive",
  iso: "archive",
  dmg: "archive",
  img: "archive",
  tgz: "archive",
  tbz2: "archive",
  txz: "archive",
  war: "archive",
  ear: "archive",
  jar: "archive",

  // ─────────────────────────────────────────────────────────────────
  // CODE / CONFIG
  // ─────────────────────────────────────────────────────────────────
  // JavaScript / TypeScript
  js: "code",
  mjs: "code",
  cjs: "code",
  jsx: "code",
  ts: "code",
  mts: "code",
  cts: "code",
  tsx: "code",

  // Web
  html: "code",
  htm: "code",
  xhtml: "code",
  css: "code",
  scss: "code",
  sass: "code",
  less: "code",
  vue: "code",
  svelte: "code",
  astro: "code",

  // Data / Config
  json: "code",
  jsonc: "code",
  json5: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  ini: "code",
  conf: "code",
  cfg: "code",
  env: "code",
  properties: "code",
  xml: "code",
  xsl: "code",
  xslt: "code",
  dtd: "code",

  // Shell / Scripts
  sh: "code",
  bash: "code",
  zsh: "code",
  fish: "code",
  ps1: "code",
  psm1: "code",
  bat: "code",
  cmd: "code",

  // Python
  py: "code",
  pyw: "code",
  pyx: "code",
  pxd: "code",
  pyi: "code",
  ipynb: "code",

  // Ruby
  rb: "code",
  erb: "code",
  rake: "code",
  gemspec: "code",

  // PHP
  php: "code",
  phtml: "code",
  php3: "code",
  php4: "code",
  php5: "code",
  phps: "code",

  // Java / JVM
  java: "code",
  kt: "code",
  kts: "code",
  scala: "code",
  sc: "code",
  groovy: "code",
  gradle: "code",
  clj: "code",
  cljs: "code",
  cljc: "code",

  // C / C++ / Objective-C
  c: "code",
  h: "code",
  cpp: "code",
  cc: "code",
  cxx: "code",
  hpp: "code",
  hh: "code",
  hxx: "code",
  m: "code",
  mm: "code",

  // C# / .NET
  cs: "code",
  vb: "code",
  fs: "code",
  fsx: "code",
  fsi: "code",

  // Go
  go: "code",
  mod: "code",
  sum: "code",

  // Rust
  rs: "code",

  // Swift
  swift: "code",

  // Dart
  dart: "code",

  // Elixir / Erlang
  ex: "code",
  exs: "code",
  erl: "code",
  hrl: "code",

  // Haskell
  hs: "code",
  lhs: "code",

  // Lua
  lua: "code",

  // Perl
  pl: "code",
  pm: "code",

  // R
  r: "code",
  rmd: "code",

  // SQL
  sql: "code",
  mysql: "code",
  pgsql: "code",
  plsql: "code",

  // GraphQL
  graphql: "code",
  gql: "code",

  // Markdown / Docs
  md: "code",
  markdown: "code",
  mdx: "code",
  rst: "code",
  adoc: "code",
  asciidoc: "code",

  // Build / Package
  makefile: "code",
  cmake: "code",
  dockerfile: "code",
  vagrantfile: "code",

  // Assembly
  asm: "code",
  s: "code",

  // Zig
  zig: "code",

  // Nim
  nim: "code",

  // V
  v: "code",

  // OCaml
  ml: "code",
  mli: "code",

  // Diff / Patch
  diff: "code",
  patch: "code",

  // Log
  log: "code",

  // ─────────────────────────────────────────────────────────────────
  // FONT
  // ─────────────────────────────────────────────────────────────────
  ttf: "font",
  otf: "font",
  woff: "font",
  woff2: "font",
  eot: "font",
  fon: "font",
  fnt: "font",
  pfb: "font",
  pfm: "font",

  // ─────────────────────────────────────────────────────────────────
  // EXECUTABLE
  // ─────────────────────────────────────────────────────────────────
  exe: "executable",
  msi: "executable",
  dll: "executable",
  so: "executable",
  dylib: "executable",
  app: "executable",
  deb: "executable",
  rpm: "executable",
  apk: "executable",
  ipa: "executable",
  appimage: "executable",
  flatpak: "executable",
  snap: "executable",
  pkg: "executable",
  bin: "executable",
  run: "executable",
  out: "executable",
  com: "executable",
};

/**
 * Get the file category from a file extension.
 * @param ext - File extension with or without leading dot (e.g., "ts" or ".ts")
 * @returns The file category, or 'other' if not recognized
 */
export function getCategoryFromExtension(ext: string): FileCategory {
  const normalized = ext.toLowerCase().replace(/^\./, "");
  return EXTENSION_CATEGORY_MAP[normalized] ?? "other";
}

/**
 * Get the file category from a filename.
 * @param filename - The filename (e.g., "script.ts" or "Makefile")
 * @returns The file category
 */
export function getCategoryFromFilename(filename: string): FileCategory {
  const lower = filename.toLowerCase();

  // Handle special filenames without extensions
  const specialFiles: Record<string, FileCategory> = {
    makefile: "code",
    dockerfile: "code",
    vagrantfile: "code",
    gemfile: "code",
    rakefile: "code",
    procfile: "code",
    brewfile: "code",
    guardfile: "code",
    podfile: "code",
    fastfile: "code",
    appfile: "code",
    matchfile: "code",
    cartfile: "code",
    dangerfile: "code",
    jenkinsfile: "code",
    cmakelists: "code",
    license: "document",
    readme: "document",
    changelog: "document",
    authors: "document",
    contributors: "document",
  };

  // Check special filenames (without extension)
  const baseName = lower.split(".")[0];
  if (specialFiles[baseName] && !lower.includes(".")) {
    return specialFiles[baseName];
  }
  if (specialFiles[lower]) {
    return specialFiles[lower];
  }

  // Extract extension
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return "other";
  }

  const ext = filename.slice(lastDot + 1);
  return getCategoryFromExtension(ext);
}

/**
 * Extension sets for backwards compatibility with existing code.
 * These mirror the sets previously defined in get-file-content.ts and PreviewApp.tsx
 */
const entries = Object.entries(EXTENSION_CATEGORY_MAP);
export const IMAGE_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "image").map(([ext]) => ext),
);

export const VIDEO_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "video").map(([ext]) => ext),
);

export const AUDIO_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "audio").map(([ext]) => ext),
);

export const DOCUMENT_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "document").map(([ext]) => ext),
);

export const SPREADSHEET_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "spreadsheet").map(([ext]) => ext),
);

export const CODE_EXTENSIONS = new Set(
  entries.filter(([, cat]) => cat === "code").map(([ext]) => ext),
);

/**
 * Check if an extension belongs to a specific category.
 */
export function isImageExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "image";
}

export function isVideoExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "video";
}

export function isAudioExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "audio";
}

export function isDocumentExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "document";
}

export function isSpreadsheetExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "spreadsheet";
}

export function isCodeExtension(ext: string): boolean {
  return getCategoryFromExtension(ext) === "code";
}
