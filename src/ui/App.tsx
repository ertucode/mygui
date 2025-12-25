import "./App.css";
import { FlexLayoutManager } from "./features/tile-manager";
import { ConfirmationProvider } from "./lib/hooks/useConfirmation";
import { ToastProvider } from "./lib/components/toast";
import { TaskProgressWindow } from "./features/tasks/TaskProgressWindow";
import { useEffect } from "react";
import { initializeTasksStore, cleanupTasksStore } from "./features/tasks/tasksStore";

function App() {
  useEffect(() => {
    initializeTasksStore();
    return () => cleanupTasksStore();
  }, []);

  return (
    <ToastProvider>
      <ConfirmationProvider>
        <FlexLayoutManager />
        <TaskProgressWindow />
      </ConfirmationProvider>
    </ToastProvider>
  );
}

export default App;
