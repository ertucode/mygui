import { ArchiveTypes } from "../../../common/ArchiveTypes.js";
import { GenericResult } from "../../../common/GenericError.js";
import { SevenZip } from "./7z.js";
import { Bzip2 } from "./bzip2.js";
import { Gzip } from "./gzip.js";
import { Tar, TarGz, Tgz, TarBz2, Tbz2, TarXz, Txz } from "./tar.js";
import { Zip } from "./zip.js";

export namespace Archive {
  export type ArchiveOpts = {
    source: string;
    destination: string;
    progressCallback: (progress: number) => void;
    abortSignal: AbortSignal;
  };

  export type ArchiveResult = GenericResult<void>;

  export type UnarchiveOpts = ArchiveOpts;

  export type UnarchiveResult = GenericResult<void>;

  function getNamespace(type: ArchiveTypes.ArchiveType): typeof SevenZip {
    switch (type) {
      case ".zip":
        return Zip;
      case ".7z":
        return SevenZip;
      case ".tar":
        return Tar;
      case ".tar.gz":
        return TarGz;
      case ".tgz":
        return Tgz;
      case ".tar.bz2":
        return TarBz2;
      case ".tbz2":
        return Tbz2;
      case ".tar.xz":
        return TarXz;
      case ".txz":
        return Txz;
      case ".gz":
        return Gzip;
      case ".bz2":
        return Bzip2;
      default:
        const _exhaustiveCheck: never = type;
        return _exhaustiveCheck;
    }
  }

  export function archive(
    type: ArchiveTypes.ArchiveType,
    opts: ArchiveOpts,
  ): Promise<ArchiveResult> {
    return getNamespace(type).archive(opts);
  }

  export function unarchive(
    type: ArchiveTypes.ArchiveType,
    opts: UnarchiveOpts,
  ): Promise<UnarchiveResult> {
    return getNamespace(type).unarchive(opts);
  }
}
