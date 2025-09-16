import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App.jsx";
import queryClient from "./config/queryClient.js";
import SearchProvider from "./context/SearchContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ToastWrapper from "./global/components/ToastWrapper.jsx";
import ErrorBoundary from "./global/components/ErrorBoundary.jsx";
import setupRegionInterceptor from "./middleware/regionMiddleware.jsx";
import "./index.css";
import "./global/silenceConsole";

// Setup the region interceptor
setupRegionInterceptor();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
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
