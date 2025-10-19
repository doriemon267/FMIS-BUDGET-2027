// Silences console output in production builds.
// Customize via env flags injected at build time if needed.
(function () {
  try {
    let viteEnv = {};
    try {
      // This will work in Vite/ESM; if not available, it will throw and we'll fallback
      viteEnv = import.meta.env || {};
    } catch {
      viteEnv = {};
    }
    const nodeEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};
    const isProd = Boolean(viteEnv.PROD) || nodeEnv.NODE_ENV === 'production' || viteEnv.VITE_SILENCE_CONSOLE === 'true' || nodeEnv.VITE_SILENCE_CONSOLE === 'true';
    if (!isProd) return;

    const noop = () => {};
    // Keep console.error by default; silence others
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;

    // Optionally silence errors if explicitly requested
    const silenceErrors = viteEnv.VITE_SILENCE_ERRORS === 'true' || nodeEnv.VITE_SILENCE_ERRORS === 'true';
    if (silenceErrors) {
      console.error = noop;
    }
  } catch {
    // ignore
  }
})();
