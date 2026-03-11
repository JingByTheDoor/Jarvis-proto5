import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { JarvisApp } from "./app";
import "./styles/app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Renderer root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <JarvisApp />
  </StrictMode>
);
