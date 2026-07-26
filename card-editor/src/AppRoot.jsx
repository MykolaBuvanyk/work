import { createElement } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

/**
 * Shared application root for browser rendering and build-time server
 * rendering. The browser continues to use BrowserRouter; the server entry
 * supplies StaticRouter without changing the route tree.
 */
export default function AppRoot({
  Router = BrowserRouter,
  routerProps = {},
  helmetContext,
}) {
  return (
    <HelmetProvider context={helmetContext}>
      {createElement(Router, routerProps, <App />)}
    </HelmetProvider>
  );
}
