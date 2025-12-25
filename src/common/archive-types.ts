/**
 * Common types and utilities for archive handling
 */

export type ArchiveFormat =
  | "zip"
  | "7z"
  | "rar"
  | "tar"
  | "tar.gz"
  | "tar.bz2"
  | "tar.xz"
  | "gz"
  | "bz2"
  | "xz"
  | "tgz"
  | "tbz2"
  | "txz";

export type ArchiveEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  comment?: string;
};

/**
 * Get archive format from file extension
 */
export function getArchiveFormat(filename: string): ArchiveFormat | null {
  const lower = filename.toLowerCase();
  
  // Check compound extensions first
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".tar.bz2")) return "tar.bz2";
  if (lower.endsWith(".tar.xz")) return "tar.xz";
  if (lower.endsWith(".tgz")) return "tgz";
  if (lower.endsWith(".tbz2")) return "tbz2";
  if (lower.endsWith(".txz")) return "txz";
  
  // Check simple extensions
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".7z")) return "7z";
  if (lower.endsWith(".rar")) return "rar";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".gz")) return "gz";
  if (lower.endsWith(".bz2")) return "bz2";
  if (lower.endsWith(".xz")) return "xz";
  
  return null;
}

/**
 * Get human-readable archive type name
 */
export function getArchiveTypeName(format: ArchiveFormat): string {
  const names: Record<ArchiveFormat, string> = {
    "zip": "ZIP Archive",
    "7z": "7-Zip Archive",
    "rar": "RAR Archive",
    "tar": "TAR Archive",
    "tar.gz": "TAR.GZ Archive",
    "tar.bz2": "TAR.BZ2 Archive",
    "tar.xz": "TAR.XZ Archive",
    "gz": "GZIP Archive",
    "bz2": "BZIP2 Archive",
    "xz": "XZ Archive",
    "tgz": "TGZ Archive",
    "tbz2": "TBZ2 Archive",
    "txz": "TXZ Archive",
  };
  return names[format] || format.toUpperCase();
}

/**
 * Check if an archive format supports listing contents efficiently
 */
export function canListContents(format: ArchiveFormat): boolean {
  // ZIP and TAR-based formats can list contents efficiently
  // Compressed-only formats (gz, bz2, xz) cannot list contents
  return !["gz", "bz2", "xz"].includes(format);
}

/**
 * Check if a file is an archive
 */
export function isArchiveFile(filename: string): boolean {
  return getArchiveFormat(filename) !== null;
}

/**
 * Get suggested archive extension for a format
 */
export function getArchiveExtension(format: ArchiveFormat): string {
  const extensions: Record<ArchiveFormat, string> = {
    "zip": ".zip",
    "7z": ".7z",
    "rar": ".rar",
    "tar": ".tar",
    "tar.gz": ".tar.gz",
    "tar.bz2": ".tar.bz2",
    "tar.xz": ".tar.xz",
    "gz": ".gz",
    "bz2": ".bz2",
    "xz": ".xz",
    "tgz": ".tgz",
    "tbz2": ".tbz2",
    "txz": ".txz",
  };
  return extensions[format] || `.${format}`;
}
