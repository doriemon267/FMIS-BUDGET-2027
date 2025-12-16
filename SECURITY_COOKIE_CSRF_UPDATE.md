## Cookie & CSRF Security Update

Summary of changes applied to improve authentication security and protect against CSRF:

- Authentication cookie (`authToken`) is now set with **httpOnly** and **SameSite=None** in production to allow cross-site XHR cookies for SPA → API flows. `COOKIE_DOMAIN` is supported for cross-subdomain requirements.
- `secure` is enabled when `NODE_ENV=production`.
- CORS configuration tightened to explicitly allow methods and headers and keep `credentials: true`.
- `helmet` added to apply standard security headers.
- `csurf` middleware added to protect state-changing endpoints; a `/csrf-token` endpoint is exposed so clients can fetch the CSRF token and include it in the `X-CSRF-Token` header for POST/PUT/DELETE/PATCH requests.
- The client `authApi`/`api` was updated to fetch `/csrf-token` and include `X-CSRF-Token` automatically for mutating requests (in-memory cache).

Notes:
- To avoid breaking existing clients immediately, the `/login` endpoint is currently exempted from CSRF enforcement; update clients to fetch the CSRF token and include it in mutation requests.
- Ensure front-end requests use `withCredentials: true` and that the CORS `origin` env vars are configured correctly.

If you'd like, I can:
- Remove the temporary CSRF exemption for `/login` and migrate clients/tests to include the CSRF token, or
- Add automated tests verifying cookie-based login and CSRF enforcement.

---
Generated on: December 17, 2025
