import { CanvasProvider } from './contexts/CanvasContext';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Toolbar/Toolbar';

function App() {
  return (
    <CanvasProvider>
      <div className="app">
        <h1>Редактор візиток</h1>
        <Toolbar />
        <Canvas />
      </div>
    </CanvasProvider>
  );
}

export default App;