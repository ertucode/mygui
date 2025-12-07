import { useEffect, useState } from "react";
import { CopyIcon } from "lucide-react";

type ContentType = "image" | "pdf" | "text";

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

  const fetchPreview = (path: string) => {
    setLoading(true);
    setError(null);

    window.electron
      .readFilePreview(path)
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

  const IMAGE_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".ico",
    ".svg",
  ]);
  const PDF_EXTENSIONS = new Set([".pdf"]);
  const MAX_TEXT_SIZE = 1 * 1024 * 1024; // 1MB

  const ext = previewData?.fileExt || "";
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isPdf = PDF_EXTENSIONS.has(ext);
  const isTextTooLarge =
    !isImage &&
    !isPdf &&
    previewData?.fileSize != null &&
    previewData.fileSize > MAX_TEXT_SIZE;

  useEffect(() => {
    if (!previewData?.filePath || !previewData.isFile) {
      setContent(null);
      setContentType("text");
      setError(null);
      setLoading(false);
      return;
    }

    if (isTextTooLarge) {
      setContent(null);
      setContentType("text");
      setError(null);
      setLoading(false);
      return;
    }

    fetchPreview(previewData.filePath);
  }, [previewData, isTextTooLarge]);

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

  if (isTextTooLarge && !content && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center gap-2">
        <div>
          File too large for preview
          <br />
          <span className="text-xs">
            ({((previewData.fileSize ?? 0) / 1024 / 1024).toFixed(2)}MB, max
            1MB)
          </span>
        </div>
        <button
          className="btn btn-xs btn-ghost"
          onClick={() =>
            previewData.filePath && fetchPreview(previewData.filePath)
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
