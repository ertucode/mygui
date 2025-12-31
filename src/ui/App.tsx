// import "../../wdyr/wdyr.js";
import "./App.css";
import { FlexLayoutManager } from "./features/tile-manager";
import { ConfirmationRenderer } from "./lib/components/confirmation";
import { ToastRenderer } from "./lib/components/toast";
import { TaskMonitor } from "./features/TaskMonitor";
import { subscribeToTasks } from "./features/taskSubscription";
import { subscribeToGenericEvents } from "./features/genericEventListener";
import { PathInput } from "./lib/libs/form/PathInput2";

subscribeToTasks();
subscribeToGenericEvents();
//
// function App() {
//   const handleWindowFocus = useCallback(() => {
//     const context = directoryStore.getSnapshot().context;
//
//     for (const directoryId of context.directoryOrder) {
//       directoryHelpers.reloadIfChanged(directoryId);
//     }
//   }, []);
//
//   useWindowFocus(handleWindowFocus);
//
//   return (
//     <>
//       <ToastRenderer />
//       <ConfirmationRenderer />
//       <div className="h-30 flex items-center justify-center">
//         <PathInput />
//       </div>
//
//       <FlexLayoutManager />
//       <TaskMonitor />
//     </>
//   );
// }
//
function App() {
  return (
    <div className="bg-red-100 h-200 flex items-center justify-center">
      <ToastRenderer />
      <ConfirmationRenderer />
      <div className="bg-blue-300 fixed [contain:layout_style_paint]">
        <PathInput />
      </div>
      <div className="bg-blue-300 w-200">{/* <PathInput /> */}</div>
      <FlexLayoutManager />
      <TaskMonitor />
    </div>
  );
}

export default App;
