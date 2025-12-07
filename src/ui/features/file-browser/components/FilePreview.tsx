import { useEffect, useState } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { CopyIcon } from "lucide-react";

type FilePreviewProps = {
  filePath: string | null;
  isFile: boolean;
};

type ContentType = "image" | "pdf" | "text";

export function FilePreview({ filePath, isFile }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>("text");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const debouncedFilePath = useDebounce(filePath, 5);

  const handleCopy = async () => {
    if (content && contentType === "text") {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!debouncedFilePath || !isFile) {
      setContent(null);
      setContentType("text");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    window.electron
      .readFilePreview(debouncedFilePath)
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
  }, [debouncedFilePath, isFile]);

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No file selected
      </div>
    );
  }

  if (!isFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Directory preview not available
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading preview...
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
