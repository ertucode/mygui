import { getWindowElectron } from "@/getWindowElectron";
import { PathHelpers } from "@common/PathHelpers";

export function PDFThumbnail({ fullPath }: { fullPath: string }) {
  const expandedPath = PathHelpers.expandHome(
    getWindowElectron().homeDirectory,
    fullPath,
  );

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-white">
      <iframe
        src={`file://${expandedPath}#page=1&view=FitH&toolbar=0&navpanes=0`}
        className="w-full h-full pointer-events-none scale-[2] origin-center"
        style={{ transform: "scale(0.5)" }}
        title="PDF preview"
      />
    </div>
  );
}
