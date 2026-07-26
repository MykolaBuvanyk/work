import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./index.css";
import AppRoot from "./AppRoot.jsx";
import "./utils/customCaret";

const container = document.getElementById("root");
const app = (
  <StrictMode>
    <AppRoot />
  </StrictMode>
);

if (container.hasChildNodes()) {
  hydrateRoot(container, app, {
    onRecoverableError(error, errorInfo) {
      console.error(
        'React hydration recovery:',
        error,
        errorInfo?.componentStack || ''
      );
    },
  });
} else {
  createRoot(container).render(app);
}
