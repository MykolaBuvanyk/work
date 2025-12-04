import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './components/Home/Home';
import { CanvasProvider } from './contexts/CanvasContext';
import Login from './components/Login/Login';
import Layout from './layout';
import TermsOfPurchasing from './components/TermsOfPurchasing/TermsOfPurchasing';
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms-of-purchasing" element={<TermsOfPurchasing />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
