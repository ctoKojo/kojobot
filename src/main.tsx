import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupOfflineSync } from "./lib/offlineQueue";

// Set up offline message queue sync
setupOfflineSync();

// Remove inline loader before React renders
const loader = document.getElementById("initial-loader");
if (loader) loader.remove();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
