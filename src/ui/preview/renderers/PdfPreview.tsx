import { PreviewHelpers } from "../PreviewHelpers";

export function PdfPreview({
  data: { fullPath },
}: PreviewHelpers.PreviewRendererProps) {
  const src = `file://${fullPath}`;

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 bg-base-200 rounded-xl overflow-hidden">
        <iframe
          src={src}
          title="PDF Preview"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
