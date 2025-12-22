import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import {
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
} from "lucide-react";

export namespace CategoryHelpers {
  export function getIcon(
    category: GetFilesAndFoldersInDirectoryItem["category"],
  ) {
    switch (category) {
      case "image":
        return ImageIcon;
      case "video":
        return VideoIcon;
      case "audio":
        return MusicIcon;
      case "document":
        return FileTextIcon;
      case "spreadsheet":
        return FileSpreadsheetIcon;
      case "archive":
        return FileArchiveIcon;
      case "code":
        return FileCodeIcon;
      default:
        return FileIcon;
    }
  }
}
