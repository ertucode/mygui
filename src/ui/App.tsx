import "./App.css";
import { DocxConverter } from "./DocxConverter";
import { FileBrowser } from "./FileBrowser";

function App() {
  return (
    <>
      <FileBrowser />
      <DocxConverter />
    </>
  );
}

export default App;
