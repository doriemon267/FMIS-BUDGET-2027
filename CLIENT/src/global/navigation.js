// Simple global navigation helper for React Router v6
// Allows non-component code (e.g., global notifications) to navigate SPA-style
let navigateRef = null;

export const setNavigate = (navigateFn) => {
  navigateRef = navigateFn;
};

export const goTo = (path, options) => {
  if (navigateRef) {
    // Use React Router navigation if available
    navigateRef(path, options);
  } else if (typeof window !== 'undefined') {
    // Fallback to full reload if router not ready
    window.location.href = path;
  }
};