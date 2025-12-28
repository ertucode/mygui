export namespace PreviewHelpers {
  export const PDF_EXTENSIONS = new Set([".pdf"]);
  export const XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
  export const DOCX_EXTENSIONS = new Set([".docx"]);

  // Video formats that Chromium can play natively
  export const PLAYABLE_VIDEO_EXTENSIONS = new Set([
    ".mp4",
    ".m4v",
    ".webm",
    ".ogv",
    ".ogg",
    ".mov",
  ]);

  export type ContentType =
    | "image"
    | "pdf"
    | "text"
    | "docx"
    | "xlsx"
    | "video"
    | "video-unsupported"
    | "archive"
    | "folder";

  export type MessageData = {
    filePath: string;
    isFile: boolean;
    fileSize: number | null;
    fileExt: string | null;
    homePath: string;
  };

  export type DerivedData = {
    preview: MessageData;
    contentType: ContentType;
    fullPath: string;
    shouldSkipPreview: boolean;
    isTooLarge: boolean;
    fileSizeLimit: number;
  };

  export type PreviewRendererProps = {
    data: DerivedData;
    allowBigSize: boolean;
    error: string | null;
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
    loading: boolean;
  };

  export type Messages =
    | {
        type: "preview-file";
        data: MessageData;
      }
    | {
        type: "preview-anyway";
        data: void;
      };
}
