import "./App.css";
import { FlexLayoutManager } from "./features/tile-manager";
import { ConfirmationProvider } from "./lib/hooks/useConfirmation";
import { ToastProvider } from "./lib/components/toast";
import { TaskMonitor } from "./features/TaskMonitor";
import { subscribeToTasks } from "./features/taskSubscription";
import { useCallback } from "react";
import { useWindowFocus } from "./lib/hooks/useWindowFocus";
import { directoryStore } from "./features/file-browser/directoryStore/directory";
import { directoryHelpers } from "./features/file-browser/directoryStore/directoryHelpers";

subscribeToTasks();

function App() {
  const handleWindowFocus = useCallback(() => {
    const context = directoryStore.getSnapshot().context;

    for (const directoryId of context.directoryOrder) {
      directoryHelpers.reloadIfChanged(directoryId);
    }
  }, []);

  useWindowFocus(handleWindowFocus);

  return (
    <ToastProvider>
      <ConfirmationProvider>
        <FlexLayoutManager />
        <TaskMonitor />
      </ConfirmationProvider>
    </ToastProvider>
  );
}

export default App;
