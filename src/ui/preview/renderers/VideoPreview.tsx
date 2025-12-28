import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { PreviewHelpers } from "../PreviewHelpers";

export function VideoPreview({
  data: {
    preview: { filePath },
  },
}: PreviewHelpers.PreviewRendererProps) {
  const [error, setError] = useState<string | null>(null);
  const src = `file://${filePath}`;

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
