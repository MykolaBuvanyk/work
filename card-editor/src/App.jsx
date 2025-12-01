import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './components/Home/Home';
import { CanvasProvider } from './contexts/CanvasContext';
import Login from './components/Login/Login';
import Layout from './layout';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
