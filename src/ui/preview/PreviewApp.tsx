import { useEffect, useRef, useState } from "react";
import { CopyIcon, FilmIcon, AlertCircleIcon } from "lucide-react";
import { renderAsync } from "docx-preview";
import { getWindowElectron } from "@/getWindowElectron";
import { fileSizeTooLarge } from "@common/file-size-too-large";

type ContentType =
  | "image"
  | "pdf"
  | "text"
  | "docx"
  | "xlsx"
  | "video"
  | "video-unsupported";

type PreviewData = {
  filePath: string;
  isFile: boolean;
  fileSize: number | null;
  fileExt: string | null;
};

export function PreviewApp() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>("text");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "preview-file") {
        setPreviewData(event.data.payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleCopy = async () => {
    if (content && contentType === "text") {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchPreview = (path: string, allowBigSize?: boolean) => {
    setLoading(true);
    setError(null);

    getWindowElectron()
      .readFilePreview(path, allowBigSize)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          setContent(null);
          setContentType("text");
        } else {
          setContent(result.content);
          setContentType(result.contentType);
          setError(null);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load file preview");
        setContent(null);
        setContentType("text");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const XLSX_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

  const ext = previewData?.fileExt || "";
  const isXlsx = XLSX_EXTENSIONS.has(ext);
  const { isTooLarge, limit: fileSizeLimit } = previewData?.fileSize
    ? fileSizeTooLarge(ext, previewData.fileSize)
    : { isTooLarge: false, limit: Infinity };

  useEffect(() => {
    if (!previewData?.filePath || !previewData.isFile) {
      setContent(null);
      setContentType("text");
      setError(null);
      setLoading(false);
      return;
    }

    if (isTooLarge) {
      setContent(null);
      setContentType("text");
      setError(null);
      setLoading(false);
      return;
    }

    // Allow big size if file size is known (already checked in UI)
    const allowBigSize = previewData.fileSize != null;
    fetchPreview(previewData.filePath, allowBigSize);
  }, [previewData, isTooLarge]);

  if (!previewData?.filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No file selected
      </div>
    );
  }

  if (!previewData.isFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Directory preview not available
      </div>
    );
  }

  if (isTooLarge && !content && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center gap-2">
        <div>
          File too large for preview
          <br />
          <span className="text-xs">
            ({((previewData.fileSize ?? 0) / 1024 / 1024).toFixed(2)}MB, max
            {fileSizeLimit}MB)
          </span>
        </div>
        <button
          className="btn btn-xs btn-ghost"
          onClick={() =>
            previewData.filePath && fetchPreview(previewData.filePath, true)
          }
        >
          Preview anyway
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <span className="loading loading-spinner size-10" />
      </div>
    );
  }

  if (error) {
    // Handle FILE_TOO_LARGE error specifically
    if (error === "FILE_TOO_LARGE") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center gap-2">
          <div>
            File too large for preview
            <br />
            <span className="text-xs">(max {isXlsx ? "10" : "1"}MB)</span>
          </div>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() =>
              previewData?.filePath && fetchPreview(previewData.filePath, true)
            }
          >
            Preview anyway
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4">
        {error}
      </div>
    );
  }

  if (content === null) {
    return null;
  }

  if (contentType === "image") {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto bg-base-200 p-3 rounded-xl flex items-center justify-center">
          <img
            src={content}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (contentType === "pdf") {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 bg-base-200 rounded-xl overflow-hidden">
          <iframe
            src={content}
            title="PDF Preview"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    );
  }

  if (contentType === "docx") {
    return <DocxPreview base64Content={content} />;
  }

  if (contentType === "xlsx") {
    return <XlsxPreview jsonContent={content} />;
  }

  if (contentType === "video") {
    return <VideoPreview src={content} />;
  }

  if (contentType === "video-unsupported") {
    return <VideoUnsupportedPreview jsonContent={content} />;
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 p-3 rounded-xl flex flex-col">
        <button
          className="btn btn-xs btn-ghost self-end flex-shrink-0"
          onClick={handleCopy}
          title="Copy contents"
        >
          <CopyIcon className="size-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
        <pre className="text-[10px] leading-tight whitespace-pre-wrap break-words font-mono">
          {content}
        </pre>
      </div>
    </div>
  );
}

function DocxPreview({ base64Content }: { base64Content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !base64Content) return;

    const renderDocx = async () => {
      try {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // Clear previous content
        containerRef.current!.innerHTML = "";

        // Render the DOCX
        await renderAsync(arrayBuffer, containerRef.current!, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          ignoreFonts: false,
          breakPages: false,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render DOCX");
      }
    };

    renderDocx();
  }, [base64Content]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <style>{`
        .docx-preview .docx-wrapper {
          background: white;
          padding: 0;
        }
        .docx-preview .docx-wrapper > section.docx {
          box-shadow: none;
          margin-bottom: 0;
          padding: 0;
          width: 100% !important;
          min-width: 0 !important;
        }
        .docx-preview {
          padding: 1rem !important;
max-width: 100% !important;
        }

.docx-preview-wrapper {
padding: 0 !important;
}
      `}</style>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-white rounded-xl p-2"
      />
    </div>
  );
}

function XlsxPreview({ jsonContent }: { jsonContent: string }) {
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Record<string, unknown[][]>>({});

  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonContent) as Record<string, unknown[][]>;
      setSheets(parsed);
      const sheetNames = Object.keys(parsed);
      if (sheetNames.length > 0 && !activeSheet) {
        setActiveSheet(sheetNames[0]);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse spreadsheet data",
      );
    }
  }, [jsonContent]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-4">
        {error}
      </div>
    );
  }

  const sheetNames = Object.keys(sheets);
  const currentData = sheets[activeSheet] || [];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {sheetNames.length > 1 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {sheetNames.map((name) => (
            <button
              key={name}
              className={`btn btn-xs ${activeSheet === name ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 rounded-xl">
        <table className="table table-xs table-pin-rows table-pin-cols">
          <tbody>
            {currentData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex === 0 ? "bg-base-300 font-semibold" : ""}
              >
                {(row as unknown[]).map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-base-300 px-2 py-1 text-[10px] whitespace-nowrap"
                  >
                    {cell != null ? String(cell) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VideoPreview({ src }: { src: string }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 p-4 text-center">
          <div>
            <AlertCircleIcon className="size-8 mx-auto mb-2" />
            <div>{error}</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden bg-base-200 rounded-xl flex items-center justify-center p-2">
          <video
            src={src}
            controls
            className="max-w-full max-h-full rounded"
            onError={() =>
              setError("Failed to load video. Format may not be supported.")
            }
          >
            Your browser does not support video playback.
          </video>
        </div>
      )}
    </div>
  );
}

function VideoUnsupportedPreview({ jsonContent }: { jsonContent: string }) {
  const [metadata, setMetadata] = useState<{
    path: string;
    size: string;
    format: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      setMetadata(JSON.parse(jsonContent));
    } catch {
      // ignore parse errors
    }
  }, [jsonContent]);

  if (!metadata) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Unable to load video metadata
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-3">
        <FilmIcon className="size-12 text-gray-400" />
        <div className="space-y-1">
          <div className="text-sm font-medium">{metadata.format} Video</div>
          <div className="text-xs text-gray-500">{metadata.size}</div>
        </div>
        <div className="text-xs text-gray-400 max-w-[200px]">
          {metadata.message}
        </div>
      </div>
    </div>
  );
}
