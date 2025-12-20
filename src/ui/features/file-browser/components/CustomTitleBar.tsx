import { NavigationButtons } from "./NavigationButtons";

export function CustomTitleBar() {
  return (
    <div
      className="flex items-center w-full h-12 border-b border-base-content/10"
      style={{
        WebkitAppRegion: "drag",
        WebkitUserSelect: "none",
      } as React.CSSProperties}
    >
      {/* Space for macOS traffic lights */}
      <div className="w-20 flex-shrink-0" />
      
      {/* Navigation buttons */}
      <div
        className="flex items-center gap-2"
        style={{
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties}
      >
        <NavigationButtons />
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
