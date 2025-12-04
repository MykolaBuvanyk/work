import { Outlet } from 'react-router-dom';
import Header from './components/Header/Header';
import { CanvasProvider } from './contexts/CanvasContext';
import CookieConsent from './components/CookieConsent/CookieConsent';

export default function Layout() {
  return (
    <CanvasProvider>
      <header>
        <Header />
      </header>

      <main>
        <Outlet /> {/* Тут рендеряться внутрішні сторінки */}
      </main>

      {/*<footer>FOOTER</footer>
       */}
      
      <CookieConsent />
    </CanvasProvider>
  );
}
