import { CanvasProvider } from "./contexts/CanvasContext";
import Canvas from "./components/Canvas/Canvas";
import Toolbar from "./components/Toolbar/Toolbar";
import TextList from "./components/TextList/TextList";
import IconMenu from "./components/IconMenu/IconMenu";
import TopToolbar from "./components/TopToolbar/TopToolbar";
import Accessories from "./components/Accessories/Accessories";
import ShapeProperties from "./components/ShapeProperties/ShapeProperties";
import "./App.css";

function App() {
  return (
    <CanvasProvider>
      <div className="app">
        <div className="sidebar">
          <Toolbar />
          <Accessories />
          {/* <IconMenu /> */}
        </div>
        <div className="main-content">
          <TopToolbar className="topToolbar" />
          <Canvas className="canvas" />
          <TextList />
        </div>
        <ShapeProperties />
      </div>
    </CanvasProvider>
  );
}

export default App;
