import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, useNavigate } from "react-router-dom";
import App from "./App.jsx";
import queryClient from "./config/queryClient.js";
import SearchProvider from "./context/SearchContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ToastWrapper from "./global/components/ToastWrapper.jsx";
import ErrorBoundary from "./global/components/ErrorBoundary.jsx";
import setupRegionInterceptor from "./middleware/regionMiddleware.jsx";
import { setNavigate } from "./global/navigation";
import { installPnpkiSignerBridge } from "./utils/pnpkiSignerBridge.js";
import "./index.css";
import "./global/silenceConsole";
import "./global/extensionMessageHandler"; // Handle extension communication gracefully
import "./global/components/GlobalNotifications"; // Initialize global notifications

// Setup the region interceptor
setupRegionInterceptor();
installPnpkiSignerBridge();

// Bridge component to capture navigate from React Router
function NavigationBridge() {
  const navigate = useNavigate();
  setNavigate(navigate);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          {/* Provide navigate to global helper */}
          <NavigationBridge />
          {/* Wrap ToastWrapper in an error boundary */}
          <ErrorBoundary>
            <ToastWrapper />
          </ErrorBoundary>
          <SearchProvider>
            <App />
          </SearchProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
