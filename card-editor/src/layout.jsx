import { Outlet } from 'react-router-dom';
import Header from './components/Header/Header';
import { CanvasProvider } from './contexts/CanvasContext';
import CookieConsent from './components/CookieConsent/CookieConsent';
import Footer from './components/Footer/Footer';
import Breadcrumbs from './components/Breadcrumbs/Breadcrumbs';
import Providers from './store/provider';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import ScrollToHash from './components/ScrollToHash/ScrollToHash';

export default function Layout() {
  return (
    <Providers>
      <CanvasProvider>
        <ScrollToTop/>
        <ScrollToHash />
        <header>
          <Header />
        </header>

        <main>
          <Breadcrumbs />
          <Outlet /> {/* Тут рендеряться внутрішні сторінки */}
        </main>

        <footer>
          <Footer />
        </footer>

        <CookieConsent />
      </CanvasProvider>
    </Providers>
  );
}
