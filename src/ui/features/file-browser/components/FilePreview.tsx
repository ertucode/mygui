import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";

type FilePreviewProps = {
  filePath: string | null;
  isFile: boolean;
  fileSize: number | null | undefined;
  fileExt: string | null | undefined;
};

// Declare webview element type for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          preload?: string;
          nodeintegration?: string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function FilePreview({
  filePath,
  isFile,
  fileSize,
  fileExt,
}: FilePreviewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webviewRef = useRef<any>(null);
  const [isWebviewReady, setIsWebviewReady] = useState(false);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);

  // Get the preview URL - in dev it's the vite server, in prod it's the file
  const previewUrl =
    import.meta.env.MODE === "development"
      ? "http://localhost:5123/preview.html"
      : "./preview.html";

  // Get the preload path on mount
  useEffect(() => {
    window.electron.getPreviewPreloadPath().then(setPreloadPath);
  }, []);

  // Set up dom-ready listener once
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      setIsWebviewReady(true);
    };

    webview.addEventListener("dom-ready", handleDomReady);
    return () => {
      webview.removeEventListener("dom-ready", handleDomReady);
    };
  }, [preloadPath]); // Re-run when preloadPath changes (webview mounts)

  // Send file data to webview when it changes or webview becomes ready
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !isWebviewReady) return;

    webview.send("preview-file", {
      filePath,
      isFile,
      fileSize: fileSize ?? null,
      fileExt: fileExt ?? null,
    });
  }, [filePath, isFile, fileSize, fileExt, isWebviewReady]);

  // Don't render webview until we have the preload path
  if (!preloadPath) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <span className="loading loading-spinner size-6" />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <webview
        ref={webviewRef as any}
        src={previewUrl}
        preload={`file://${preloadPath}`}
        webpreferences="contextIsolation=yes"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
