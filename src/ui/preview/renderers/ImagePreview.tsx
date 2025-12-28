import { PreviewHelpers } from "../PreviewHelpers";

export function ImagePreview({
  data: { fullPath },
}: PreviewHelpers.PreviewRendererProps) {
  const src = `file://${fullPath}`;

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 p-3 rounded-xl flex items-center justify-center">
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}
