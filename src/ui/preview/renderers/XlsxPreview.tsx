import { useEffect, useState } from "react";
import { getWindowElectron } from "@/getWindowElectron";
import { PreviewHelpers } from "../PreviewHelpers";

export function XlsxPreview({
  data: { fullPath },
  allowBigSize,
  error,
  setError,
  loading,
  setLoading,
}: PreviewHelpers.PreviewRendererProps) {
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheets, setSheets] = useState<Record<string, unknown[][]>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);

    getWindowElectron()
      .readFilePreview(fullPath, allowBigSize)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          setSheets({});
        } else if (result.contentType === "xlsx") {
          try {
            const parsed = JSON.parse(result.content) as Record<
              string,
              unknown[][]
            >;
            setSheets(parsed);
            const sheetNames = Object.keys(parsed);
            if (sheetNames.length > 0) {
              setActiveSheet(sheetNames[0]);
            }
            setError(null);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to parse spreadsheet data",
            );
            setSheets({});
          }
        } else {
          setError("Invalid content type for XLSX preview");
          setSheets({});
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load spreadsheet file");
        setSheets({});
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fullPath, allowBigSize]);

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

  const sheetNames = Object.keys(sheets);
  const currentData = sheets[activeSheet] || [];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {sheetNames.length > 1 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {sheetNames.map((name) => (
            <button
              key={name}
              className={`btn btn-xs ${activeSheet === name ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto bg-base-200 rounded-xl">
        <table className="table table-xs table-pin-rows table-pin-cols">
          <tbody>
            {currentData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={rowIndex === 0 ? "bg-base-300 font-semibold" : ""}
              >
                {(row as unknown[]).map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-base-300 px-2 py-1 text-[10px] whitespace-nowrap"
                  >
                    {cell != null ? String(cell) : ""}
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
