import { useEffect, useState } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { CopyIcon } from "lucide-react";

type FilePreviewProps = {
  filePath: string | null;
  isFile: boolean;
};

export function FilePreview({ filePath, isFile }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const debouncedFilePath = useDebounce(filePath, 5);

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!debouncedFilePath || !isFile) {
      setContent(null);
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
        } else {
          setContent(result.content);
          setError(null);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load file preview");
        setContent(null);
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

  return (
    <div className="h-full max-h-full flex flex-col">
      <div className="flex-1 overflow-auto bg-base-200 p-3 rounded-xl flex flex-col">
        <button
          className="btn btn-xs btn-ghost self-end"
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
