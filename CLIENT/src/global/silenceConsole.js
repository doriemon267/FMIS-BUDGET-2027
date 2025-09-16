// Silences console output in production builds.
// Customize via env flags injected at build time if needed.
(function () {
  try {
    const isProd = typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'production' || process.env.VITE_SILENCE_CONSOLE === 'true');
    if (!isProd) return;

    const noop = () => {};
    // Keep console.error by default; silence others
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;

    // Optionally silence errors if explicitly requested
    if (process.env && process.env.VITE_SILENCE_ERRORS === 'true') {
      console.error = noop;
    }
  } catch (_) {
    // ignore
  }
})();
