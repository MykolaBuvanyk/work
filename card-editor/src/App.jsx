import { CanvasProvider } from "./contexts/CanvasContext";
import Canvas from "./components/Canvas/Canvas";
import Toolbar from "./components/Toolbar/Toolbar";
import TextList from "./components/TextList/TextList";
import IconMenu from "./components/IconMenu/IconMenu";
import TopToolbar from "./components/TopToolbar/TopToolbar";
import Accessories from "./components/Accessories/Accessories";
import ShapeProperties from "./components/ShapeProperties/ShapeProperties";
import "./App.css";
import Header from "./components/Header/Header";
import TopSidebar from "./components/TopSidebar/TopSidebar";
import GlobalInputFormat from "./components/GlobalInputFormat";

function App() {
  return (
    <CanvasProvider>
      <div className="app">
        <GlobalInputFormat />
        <Header />
        <div className="main-wrapper">
          <div className="sidebar">
            <TopSidebar />
            <Toolbar />
            <Accessories />
            {/* <IconMenu /> */}
          </div>
          <div className="main-content">
            <TopToolbar className="topToolbar" />
            <Canvas className="canvas" />
            <TextList />
          </div>
        </div>
      </div>
    </CanvasProvider>
  );
}

export default App;
