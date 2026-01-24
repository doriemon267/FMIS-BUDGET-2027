import axios from "axios";
import env from "../utils/env";
import { getStoredWorkflowRef } from "../hooks/useWorkflowRef";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";

// Increase default timeout and allow override via env
const REQUEST_TIMEOUT = Number(env("REQUEST_TIMEOUT_MS")) || 30000; // default 30s

const api = axios.create({
  baseURL: IS_PRODUCTION ? env("SERVER_URL_PROD") : env("SERVER_URL_DEV"),
  withCredentials: true,
});

// In-memory cache for CSRF token fetched from the server
let _csrfToken = null;
// In-memory dev user (avoid reading sensitive user info from localStorage)
let _devUser = null;
export function setDevUser(user) {
  _devUser = user;
}
const fetchCsrfToken = async () => {
  if (_csrfToken) return _csrfToken;
  try {
    // CSRF endpoint is served by the main API server (same origin as protected routes)
    const csrfBase = env("SERVER_URL_PROD") || env("SERVER_URL_DEV");
    if (!csrfBase) return null;
    const resp = await axios.get(`${csrfBase}/csrf-token`, { withCredentials: true });
    _csrfToken = resp.data && resp.data.csrfToken;
    return _csrfToken;
  } catch (err) {
    // If CSRF endpoint is not available or request fails, proceed without token
    return null;
  }
};

// Attach token to requests
api.interceptors.request.use(
  async (config) => {
    // Authentication now uses httpOnly cookies (authToken) set by the auth server.
    // Do NOT attach tokens from localStorage; this prevents JS-accessible storage of tokens.

    // Ensure X-CSRF-Token is present for state-changing requests
    const method = (config.method || 'get').toUpperCase();
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const token = await fetchCsrfToken();
      if (token && !config.headers['X-CSRF-Token']) {
        config.headers['X-CSRF-Token'] = token;
      }
    }

    const workflowRef = getStoredWorkflowRef();
    if (workflowRef) {
      const hasWorkflowHeader = Object.keys(config.headers || {}).some(
        (key) => key?.toLowerCase() === "x-workflow-ref"
      );
      if (!hasWorkflowHeader) {
        config.headers["X-Workflow-Ref"] = workflowRef;
      }
    }

    // Dev-only header to tell the backend which userId to use when ACCOUNT_USER_API_URL is not set
    try {
      const currentUser = _devUser;
      if (currentUser) {
        // Prefer Username (often holds the external employee/user number used for assignments)
        const devUserId = (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username) || currentUser?.userId || currentUser?.id || currentUser?.userCode || currentUser?.UserCode || currentUser?.Id;
        if (devUserId) {
         config.headers['X-Dev-User-Id'] = String(devUserId);
        }
        if (currentUser?.Roles) {
          const rolesArr = Array.isArray(currentUser.Roles) ? currentUser.Roles : [currentUser.Roles];
          config.headers['X-Dev-Roles'] = rolesArr.join(',');
        }
      }
    } catch (_error) {
      // ignore
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Retry on transient timeouts with exponential backoff (max 2 retries)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
    if (!config || !isTimeout) return Promise.reject(error);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= 2) return Promise.reject(error);
    config.__retryCount += 1;
    const delay = Math.min(1000 * 2 ** (config.__retryCount - 1), 5000);
    await new Promise((res) => setTimeout(res, delay));
    return api.request(config);
  }
);

export default api;

export const authApi = axios.create({
  baseURL: env("AUTH_SERVER_URL"),
  withCredentials: true,
});