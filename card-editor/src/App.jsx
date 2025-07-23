import { CanvasProvider } from './contexts/CanvasContext';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Toolbar/Toolbar';
import TextList from './components/TextList/TextList';
import IconMenu from './components/IconMenu/IconMenu';
function App() {
  return (
    <CanvasProvider>
      <div className="app">
        <div className="sidebar">
          <TextList />
          <Toolbar />
          <IconMenu />
        </div>
        <Canvas />
      </div>
    </CanvasProvider>
  );
}

export default App;