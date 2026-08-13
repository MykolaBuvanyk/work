import { Outlet } from 'react-router-dom';
import Header from './components/Header/Header';
import { CanvasProvider } from './contexts/CanvasContext';
import CookieConsent from './components/CookieConsent/CookieConsent';
import Footer from './components/Footer/Footer';
import Breadcrumbs from './components/Breadcrumbs/Breadcrumbs';
import Providers from './store/provider';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import ScrollToHash from './components/ScrollToHash/ScrollToHash';
import Seo from './Seo';

export default function Layout() {
  return (
    <Providers>
      <CanvasProvider>
        <ScrollToTop/>
        <ScrollToHash />
        <Seo />
        <header>
          <Header />
        </header>

        <main>
          <Breadcrumbs />
          <Outlet /> {/* Тут рендеряться внутрішні сторінки */}
        </main>

        <Footer />

        <CookieConsent />
      </CanvasProvider>
    </Providers>
  );
}
