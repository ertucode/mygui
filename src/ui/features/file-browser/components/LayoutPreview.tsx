import { IJsonModel, Layout, Model, TabNode } from "flexlayout-react";
import { useMemo } from "react";

interface LayoutPreviewProps {
  layoutJson: IJsonModel;
  className?: string;
}

export function LayoutPreview({
  layoutJson,
  className = "",
}: LayoutPreviewProps) {
  const model = useMemo(() => {
    try {
      return Model.fromJson(layoutJson);
    } catch (e) {
      console.error("Failed to create model from layout JSON:", e);
      return null;
    }
  }, [layoutJson]);

  // Factory function for rendering preview components
  const factory = (_node: TabNode) => {
    return <div className="w-full h-full bg-base-200"></div>;
  };

  if (!model) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center text-base-content/30 text-xs">
          No preview available
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className} layout-preview-container`}>
      <Layout
        model={model}
        factory={factory}
        onRenderTab={(node, renderValues) => {
          if (node.getComponent() === "directory") {
            if (renderValues.content) {
              renderValues.content = <div className="mr-2">Dir</div>;
            }
          }
        }}
      />
    </div>
  );
}
