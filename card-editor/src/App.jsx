import { CanvasProvider } from './contexts/CanvasContext';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Toolbar/Toolbar';
import TextList from './components/TextList/TextList';

function App() {
  return (
    <CanvasProvider>
      <div className="app">
        <h1>Редактор візиток</h1>
        <TextList />
        <Toolbar />
        <Canvas />
      </div>
    </CanvasProvider>
  );
}

export default App;