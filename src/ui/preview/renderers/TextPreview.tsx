import { useEffect, useState } from "react";
import { CopyIcon } from "lucide-react";
import { getWindowElectron } from "@/getWindowElectron";
import { PreviewHelpers } from "../PreviewHelpers";

export function TextPreview({
  data: {
    preview: { filePath },
  },
  allowBigSize,
  error,
  setError,
  loading,
  setLoading,
}: PreviewHelpers.PreviewRendererProps) {
  const [content, setContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getWindowElectron()
      .readFilePreview(filePath, allowBigSize)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          setContent(null);
        } else if (result.contentType === "text") {
          setContent(result.content);
          setError(null);
        } else {
          setError("Invalid content type for text preview");
          setContent(null);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load file preview");
        setContent(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filePath, allowBigSize]);

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
