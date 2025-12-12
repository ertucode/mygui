import "./App.css";
import { FileBrowser } from "./features/file-browser/FileBrowser";
import { ConfirmationProvider } from "./lib/hooks/useConfirmation";
import { ToastProvider } from "./lib/components/toast";

function App() {
  return (
    <ToastProvider>
      <ConfirmationProvider>
        <FileBrowser />
        {/* <DocxConverter /> */}
      </ConfirmationProvider>
    </ToastProvider>
  );
}

export default App;
