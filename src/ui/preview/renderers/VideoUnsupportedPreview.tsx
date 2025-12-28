import { FilmIcon } from "lucide-react";
import { PreviewHelpers } from "../PreviewHelpers";

export function VideoUnsupportedPreview({
  data: {
    preview: { fileSize, fileExt },
  },
}: PreviewHelpers.PreviewRendererProps) {
  const fileSizeMB = fileSize ? (fileSize / 1024 / 1024).toFixed(2) : "Unknown";
  const format = fileExt ? fileExt.replace(".", "").toUpperCase() : "Unknown";

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-3">
        <FilmIcon className="size-12 text-gray-400" />
        <div className="space-y-1">
          <div className="text-sm font-medium">{format} Video</div>
          <div className="text-xs text-gray-500">{fileSizeMB} MB</div>
        </div>
        <div className="text-xs text-gray-400 max-w-[200px]">
          This video format cannot be played in the browser. Use an external
          player.
        </div>
      </div>
    </div>
  );
}
