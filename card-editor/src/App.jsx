import { Route, Routes } from 'react-router-dom';
import Layout from './layout';
import Home from './components/Home/Home';
import Login from './components/Login/Login';
import TermsOfPurchasing from './components/TermsOfPurchasing/TermsOfPurchasing';
import PrivacyPolicy from './components/PrivacyPolicy/PrivacyPolicy';
import Admin from './Admin/Admin';
import CartOrdersAdmin from './Admin/CartOrdersAdmin';
import UpdateAvaible from './components/UpdateAvaible/UpdateAvaible';
import UpdateIcons from './components/UpdateIcons/UpdateIcons';
import LanguageGuard from './LanguageGuard';
import './App.css';
import Contacts from './components/Contacts/Contacts';
import QuickGuide from './components/QuickGuide/QuickGuide';
import UpdateBaner from './components/UpdateBaner/UpdateBaner';



function App() {
  // Виносимо спільні маршрути в змінну, щоб не дублювати код
  const mainRoutes = (
    <>
      <Route index element={<Home />} />
      <Route path="login" element={<Login />} />
      <Route path="terms-of-purchasing" element={<TermsOfPurchasing />} />
      <Route path="privacy-policy" element={<PrivacyPolicy />} />
      <Route path="contacts" element={<Contacts />} />
      <Route path="quick-guide" element={<QuickGuide />} />
      <Route path="admin" element={<Admin />} />
      <Route path="admin/cart-orders" element={<CartOrdersAdmin />} />
      <Route path="admin/update-avaible" element={<UpdateAvaible />} />
      <Route path="admin/update-avaible/icon" element={<UpdateIcons />} />
      <Route path="admin/update-baner" element={<UpdateBaner />} />
    </>
  );

  return (
    <div className="app">
      <Routes>
        {/* АНГЛІЙСЬКА: Доступна просто за посиланням / (без /en) */}
        <Route path="/" element={<LanguageGuard isDefault={true} />}>
          <Route element={<Layout />}>{mainRoutes}</Route>
        </Route>

        {/* ІНШІ МОВИ: Доступні за посиланням /ua, /de тощо */}
        <Route path="/:lng" element={<LanguageGuard isDefault={false} />}>
          <Route element={<Layout />}>{mainRoutes}</Route>
        </Route>

        {/* Глобальна 404 */}
        <Route
          path="*"
          element={
            <div style={{ textAlign: 'center' }}>
              <h1>404</h1>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
