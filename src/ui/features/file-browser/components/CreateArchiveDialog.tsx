import { createFormDialog } from "@/lib/libs/form/createFormDialog";
import { FileArchiveIcon } from "lucide-react";
import z from "zod";
import { directoryHelpers, directoryStore } from "../directoryStore/directory";
import { GenericError } from "@common/GenericError";
import { ArchiveFormat, getArchiveExtension } from "@common/archive-types";

type CreateArchiveDialogItem = { 
  filePaths: string[]; 
  suggestedName?: string;
  format?: ArchiveFormat;
};

const archiveFormats: Array<{ value: ArchiveFormat; label: string }> = [
  { value: "zip", label: "ZIP (.zip) - Universal" },
  { value: "tar", label: "TAR (.tar) - No compression" },
  { value: "tar.gz", label: "TAR.GZ (.tar.gz) - Good compression" },
  { value: "tgz", label: "TGZ (.tgz) - Same as tar.gz" },
  { value: "tar.bz2", label: "TAR.BZ2 (.tar.bz2) - Better compression" },
  { value: "tbz2", label: "TBZ2 (.tbz2) - Same as tar.bz2" },
  { value: "tar.xz", label: "TAR.XZ (.tar.xz) - Best compression" },
  { value: "txz", label: "TXZ (.txz) - Same as tar.xz" },
  { value: "7z", label: "7Z (.7z) - Excellent compression" },
  { value: "gz", label: "GZIP (.gz) - Single file only" },
  { value: "bz2", label: "BZIP2 (.bz2) - Single file only" },
  { value: "xz", label: "XZ (.xz) - Single file only" },
];

export const CreateArchiveDialog = createFormDialog<
  CreateArchiveDialogItem,
  { archiveName: string; format: ArchiveFormat },
  {}
>({
  schema: z.object({
    archiveName: z.string().min(1, "Archive name is required"),
    format: z.enum(["zip", "tar", "tar.gz", "tgz", "gz", "7z", "rar", "tar.bz2", "tar.xz", "bz2", "xz", "tbz2", "txz"] as const),
  }),
  action: (body, _, item) => {
    if (!item?.filePaths || item.filePaths.length === 0) {
      return Promise.resolve(
        GenericError.Message("No files selected for archiving"),
      );
    }
    
    // Ensure the archive name has the correct extension
    const extension = getArchiveExtension(body.format);
    const finalArchiveName = body.archiveName.endsWith(extension)
      ? body.archiveName
      : `${body.archiveName}${extension}`;
    
    return directoryHelpers.createArchive(
      item.filePaths,
      finalArchiveName,
      body.format,
      directoryStore.getSnapshot().context.activeDirectoryId,
    );
  },
  getConfigs: () => [
    {
      field: "archiveName",
      label: "Archive name",
      type: "input",
    },
    {
      field: "format",
      label: "Archive format",
      type: "select",
      options: archiveFormats,
    },
  ],
  getFormParams: (item) => ({
    values: {
      archiveName: item?.suggestedName?.replace(/\.(zip|tar|gz|tgz|tar\.gz)$/i, "") || "archive",
      format: "zip" as ArchiveFormat,
    },
  }),
  getTexts: () => ({
    title: "Create Archive",
    buttonLabel: "Create",
    buttonIcon: FileArchiveIcon,
  }),
});
