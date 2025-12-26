import "./App.css";
import { FlexLayoutManager } from "./features/tile-manager";
import { ConfirmationProvider } from "./lib/hooks/useConfirmation";
import { ToastProvider } from "./lib/components/toast";
import { TaskMonitor } from "./features/TaskMonitor";
import { subscribeToTasks } from "./features/taskSubscription";

subscribeToTasks();

function App() {
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
