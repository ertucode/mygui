import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { getWindowElectron } from "@/getWindowElectron";
import { PreviewHelpers } from "../PreviewHelpers";

export function DocxPreview({
  data: { fullPath },
  allowBigSize,
  error,
  setError,
  loading,
  setLoading,
}: PreviewHelpers.PreviewRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [base64Content, setBase64Content] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getWindowElectron()
      .readFilePreview(fullPath, allowBigSize)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          setBase64Content(null);
        } else if (result.contentType === "docx") {
          setBase64Content(result.content);
          setError(null);
        } else {
          setError("Invalid content type for DOCX preview");
          setBase64Content(null);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load DOCX file");
        setBase64Content(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fullPath, allowBigSize]);

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
