import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/russo-one/400.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/board.css";
import "./styles/pages.css";
import App from "./App";

// Único ponto em que o React "monta" a aplicação na página.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
