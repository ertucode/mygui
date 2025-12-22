import { getWindowElectron } from "@/getWindowElectron";
import { FileSpreadsheetIcon } from "lucide-react";
import { useState, useEffect } from "react";

export function SpreadsheetThumbnail({ fullPath }: { fullPath: string }) {
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const result = await getWindowElectron().readFilePreview(fullPath);
        if ("error" in result) {
          setPreviewData(null);
        } else if (result.contentType === "xlsx") {
          const sheets = JSON.parse(result.content) as Record<
            string,
            unknown[][]
          >;
          const firstSheetName = Object.keys(sheets)[0];
          if (firstSheetName) {
            const rows = sheets[firstSheetName];
            // Limit to first 20 rows for thumbnail
            const limitedRows = rows
              .slice(0, 20)
              .map((row) =>
                row.map((cell) => (cell != null ? String(cell) : "")),
              );
            setPreviewData(limitedRows);
          }
        }
      } catch {
        setPreviewData(null);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [fullPath]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <FileSpreadsheetIcon className="w-12 h-12 text-base-content/60 animate-pulse" />
      </div>
    );
  }

  if (!previewData || previewData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <FileSpreadsheetIcon className="w-12 h-12 text-base-content/60" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-base-200 p-1">
      <div className="w-full h-full overflow-hidden">
        <table className="w-full text-[6px] leading-tight border-collapse">
          <tbody>
            {previewData.slice(0, 8).map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.slice(0, 4).map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className="border border-base-300 px-0.5 truncate"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
