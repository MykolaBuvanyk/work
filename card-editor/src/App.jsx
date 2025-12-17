import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './components/Home/Home';
import Login from './components/Login/Login';
import Layout from './layout';
import TermsOfPurchasing from './components/TermsOfPurchasing/TermsOfPurchasing';
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy';
import Admin from './Admin/Admin';
import UpdateAvaible from './components/UpdateAvaible/UpdateAvaible';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms-of-purchasing" element={<TermsOfPurchasing />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/update-avaible" element={<UpdateAvaible />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
