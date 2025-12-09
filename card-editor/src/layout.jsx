import { Outlet } from 'react-router-dom';
import Header from './components/Header/Header';
import { CanvasProvider } from './contexts/CanvasContext';
import CookieConsent from './components/CookieConsent/CookieConsent';
import Footer from './components/Footer/Footer';
import Providers from './store/provider';

export default function Layout() {
  return (
    <Providers>
      <CanvasProvider>
        <header>
          <Header />
        </header>

        <main>
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
