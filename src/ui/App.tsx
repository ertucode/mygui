import "./App.css";
import { FileBrowser } from "./features/file-browser/FileBrowser";
import { ConfirmationProvider } from "./lib/hooks/useConfirmation";

function App() {
  return (
    <ConfirmationProvider>
      <FileBrowser />
      {/* <DocxConverter /> */}
    </ConfirmationProvider>
  );
}

export default App;
