/**
 * middlewares/security_headers.js
 *
 * Single source of truth for HTTP security headers (VAPT: A04 / missing headers).
 * Express owns these headers. IIS only strips server-identifying headers
 * (see web.config) so nothing is sent twice.
 *
 * Mount it FIRST, before express.static, so static files and index.html
 * get the headers too.
 *
 * Environment variables (comma-separated origins, all optional):
 *   CSP_CONNECT_SRC      extra API origins the browser calls
 *                        e.g. https://fmis.nia.gov.ph,https://accounts.nia.gov.ph
 *   CSP_IMG_SRC          extra image origins (e.g. https://fmis.nia.gov.ph for signatures)
 *   CSP_FRAME_SRC        extra origins allowed inside <iframe> (e.g. contract PDFs)
 *   FRAME_OPTIONS        "DENY" (default) or "SAMEORIGIN".
 *                        DENY  -> X-Frame-Options: DENY + frame-ancestors 'none'
 *                                 (use on bcd.nia.gov.ph; matches the CERT-PH example)
 *                        SAMEORIGIN -> use only if the app iframes its OWN URLs
 *                                 (FMIS previews /uploads contract PDFs this way)
 *   CSP_FRAME_ANCESTORS  other sites allowed to embed THIS app (SAMEORIGIN mode only)
 *   CSP_REPORT_ONLY      "true" = send Content-Security-Policy-Report-Only
 *                        (use in staging only; scanners need the enforcing header)
 *   ENABLE_HSTS          "false" disables HSTS (default: on when production)
 */
const helmet = require("helmet");

const list = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isProduction = () =>
  process.env.NODE_ENV === "production" || Boolean(process.env.PRODUCTION_MODE);

// Browser features the app does not use. Denying them limits what injected
// script could do.
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "bluetooth=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  "interest-cohort=()",
].join(", ");

function securityHeaders() {
  const prod = isProduction();
  const reportOnly = process.env.CSP_REPORT_ONLY === "true";
  const hstsEnabled = prod && process.env.ENABLE_HSTS !== "false";
  const frameDeny =
    (process.env.FRAME_OPTIONS || "DENY").toUpperCase() !== "SAMEORIGIN";
  const frameAncestors = frameDeny
    ? ["'none'"]
    : ["'self'", ...list(process.env.CSP_FRAME_ANCESTORS)];

  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      reportOnly,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        manifestSrc: ["'self'"],

        // Vite production builds emit external script files only.
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],

        // MUI/Emotion injects <style> tags at runtime, so inline styles are
        // required. Google Fonts CSS is imported from index.css.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],

        // blob: covers generated previews; data: covers inline icons.
        imgSrc: ["'self'", "data:", "blob:", ...list(process.env.CSP_IMG_SRC)],

  
        connectSrc: ["'self'", ...list(process.env.CSP_CONNECT_SRC)],

        // PDF reports are previewed in <iframe src="blob:...">.
        frameSrc: ["'self'", "blob:", ...list(process.env.CSP_FRAME_SRC)],
        workerSrc: ["'self'", "blob:"],

        frameAncestors,

        // Only meaningful behind HTTPS; browsers ignore it in report-only mode.
        upgradeInsecureRequests: prod && !reportOnly ? [] : null,
      },
    },

    strictTransportSecurity: hstsEnabled
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,

    // Legacy clickjacking header for old browsers; CSP frame-ancestors wins
    // in modern browsers.
    xFrameOptions: { action: frameDeny ? "deny" : "sameorigin" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // same-site (not same-origin) so *.nia.gov.ph apps can still load each
    // other's images/files.
    crossOriginResourcePolicy: { policy: "same-site" },
    // COEP would block Google Fonts and cross-origin images.
    crossOriginEmbedderPolicy: false,
    originAgentCluster: true,
    xDnsPrefetchControl: { allow: false },
    xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
    xDownloadOptions: true,
    // Modern guidance is to disable the old XSS auditor ("0").
    xXssProtection: true,
    xPoweredBy: true, // removes X-Powered-By: Express
  });

  return function securityHeadersMiddleware(req, res, next) {
    res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);

    // Financial data must not be stored by browsers or shared proxies.
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    helmetMiddleware(req, res, next);
  };
}

module.exports = securityHeaders;
