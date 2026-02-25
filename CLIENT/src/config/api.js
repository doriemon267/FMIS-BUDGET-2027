import axios from "axios";
import env from "../utils/env";
import { getStoredWorkflowRef } from "../hooks/useWorkflowRef";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import { getErrorMessage } from "../utils/errorHandler";
import { toast } from "react-toastify";
import { goTo } from "../global/navigation";

// Increase default timeout and allow override via env
const REQUEST_TIMEOUT = Number(env("REQUEST_TIMEOUT_MS")) || 30000; // default 30s
const apiPrefix = "/api";

// Get base URL and ensure it doesn't end with /api to prevent double prefix
const getBaseURL = () => {
  const base = IS_PRODUCTION ? "/" : env("SERVER_URL_DEV");
  if (!base || base === "/") return "/";
  // Remove trailing /api if present to prevent double prefix
  return base.replace(/\/api\/?$/, "") || "/";
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

// In-memory cache for CSRF token fetched from the server
let _csrfToken = null;
// In-memory dev user (avoid reading sensitive user info from localStorage)
let _devUser = null;
export function setDevUser(user) {
  _devUser = user;
}

// Auth token for budget API when auth server is on a different origin (cookie not sent cross-origin).
// Set from: redirect URL (?token= / #access_token=) or get-user response (auth server returns token).
let _authToken = null;
export function setAuthToken(token) {
  _authToken = token || null;
}
export function getAuthToken() {
  return _authToken || null;
}
const fetchCsrfToken = async () => {
  if (_csrfToken) return _csrfToken;
  try {
    // Use same origin as api so cookie works. Avoid double /api when SERVER_URL_DEV ends with /api (e.g. https://budget.fmis.local/api)
    const rawBase = IS_PRODUCTION ? "" : env("SERVER_URL_DEV");
    const csrfBase = rawBase ? rawBase.replace(/\/api\/?$/, "") || "" : "";
    const url = csrfBase ? `${csrfBase}${apiPrefix}/csrf-token` : `${apiPrefix}/csrf-token`;
    const resp = await axios.get(url, { withCredentials: true });
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
    const normalizeUrl = (url) => {
      if (!url || typeof url !== "string") return url;
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
        return url;
      }
      if (url.startsWith("/uploads")) return url;
      // Remove any existing /api prefix to prevent double /api/api/
      let cleanUrl = url.startsWith(apiPrefix) ? url.substring(apiPrefix.length) : url;
      // Ensure it starts with /
      const normalized = cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`;
      return `${apiPrefix}${normalized}`;
    };

    if (config.url) {
      config.url = normalizeUrl(config.url);
    }
    // Auth: cookie is sent only to same origin as auth server. When budget API is different origin,
    // send token in header (set from redirect URL or get-user response).
    const authToken = getAuthToken();
    if (authToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

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
    if (!IS_PRODUCTION) {
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

// Detect Super Admin not whitelisted / Role-ID not authorized for environment (show AccessGuard instead of broken dashboard)
const isUnauthorizedSuperAdminResponse = (res) => {
  if (!res?.data) return false;
  const code = res.data.code;
  const err = res.data.error || res.data.message || '';
  const errStr = String(err);
  return (
    code === 'UNAUTHORIZED_SUPER_ADMIN' ||
    /Super Admin ID is not authorized/i.test(errStr) ||
    /Your Role\/ID is not authorized for this environment/i.test(errStr) ||
    /not authorized for this environment/i.test(errStr)
  );
};

// Handle auth-related 401/403 by attempting a silent session/user refresh
api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error || {};
  if (!config || !response) return Promise.reject(error);

  // 403/483 Role or ID not authorized for this environment -> show AccessGuard (no broken dashboard in production)
  const isAccessDeniedForEnvironment = (response.status === 403 || response.status === 483) && isUnauthorizedSuperAdminResponse(response);
  if (isAccessDeniedForEnvironment) {
    if (typeof window.__onUnauthorizedSuperAdmin === 'function') {
      window.__onUnauthorizedSuperAdmin();
    }
    return Promise.reject(error);
  }

  // Only try once per request
  if (config.__isRetryRequest) return Promise.reject(error);

  if (response.status === 401 || response.status === 403) {
    try {
      config.__isRetryRequest = true;
      // Attempt to refresh user session by calling auth server's get-user endpoint
      const refreshRes = await authApi.get('/get-user');
      const refreshedUser = refreshRes?.data?.user || null;
      if (refreshedUser) {
        if (refreshRes?.data?.token) setAuthToken(refreshRes.data.token);
        try {
          setDevUser(refreshedUser);
        } catch (e) {
          // ignore
        }
        return api.request(config);
      }
    } catch (refreshErr) {
      // If refresh also returns Super Admin unauthorized, show AccessGuard
      const refreshRes = refreshErr?.response;
      if (refreshRes && isUnauthorizedSuperAdminResponse(refreshRes)) {
        if (typeof window.__onUnauthorizedSuperAdmin === 'function') {
          window.__onUnauthorizedSuperAdmin();
        }
        return Promise.reject(error);
      }
      // If refresh fails, redirect appropriately for better UX
      try {
        if (!config.__diagnosticRan) {
          config.__diagnosticRan = true;
          const [whoami, myAccess] = await Promise.allSettled([
            authApi.get('/get-user'),
            api.get('/api/hierarchical-rbac/my-access')
          ]);
          console.debug('Auth diagnostic - get-user result:', whoami.status === 'fulfilled' ? whoami.value.data : whoami.reason?.response?.data || whoami.reason?.message);
          console.debug('Auth diagnostic - my-access result:', myAccess.status === 'fulfilled' ? myAccess.value.data : myAccess.reason?.response?.data || myAccess.reason?.message);
        }
      } catch (diagErr) {
        console.debug('Auth diagnostic failed:', diagErr?.message || diagErr);
      }
      // Redirect: 401 -> login, 403 -> not-authorized (avoids stuck UI)
      if (response.status === 401) {
        goTo('/login');
        toast.error('Session expired. Please log in again.');
      } else if (response.status === 403) {
        goTo('/not-authorized');
        toast.error('You do not have permission to perform this action.');
      }
      return Promise.reject(error);
    }
  }
  return Promise.reject(error);
});

// Global API error handler: show toast for failed requests (except 401/403 handled by auth), no console logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (error?.response && status !== 401 && status !== 403) {
      const message = getErrorMessage(error);
      toast.error(message, { autoClose: 12000, closeButton: true, draggable: true });
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = axios.create({
  baseURL: IS_PRODUCTION ? env("AUTH_SERVER_URL_PROD") : env("AUTH_SERVER_URL_DEV"),
  withCredentials: true,
});