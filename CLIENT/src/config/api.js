import axios from "axios";
import env from "../utils/env";
import CryptoJS from "crypto-js"; // Import CryptoJS

// Function to get the stored token (decrypt it first)
const getToken = () => {
  const encryptedToken = localStorage.getItem("token");
  if (!encryptedToken) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, env("SECRET_KEY"));
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Error decrypting token:", error);
    return null;
  }
};

// Increase default timeout and allow override via env
const REQUEST_TIMEOUT = Number(env("REQUEST_TIMEOUT_MS")) || 30000; // default 30s

const api = axios.create({
  baseURL: env("SERVER_URL"),
  withCredentials: true,
  timeout: REQUEST_TIMEOUT,
});

// Attach token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Dev-only header to tell the backend which userId to use when ACCOUNT_USER_API_URL is not set
    try {
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        // Prefer Username (often holds the external employee/user number used for assignments)
        const devUserId = (Array.isArray(currentUser?.Username) ? currentUser.Username[0] : currentUser?.Username) || currentUser?.userCode || currentUser?.UserCode || currentUser?.userId || currentUser?.Id || currentUser?.id;
        if (devUserId) {
          config.headers['X-Dev-User-Id'] = String(devUserId);
        }
        if (currentUser?.Roles) {
          const rolesArr = Array.isArray(currentUser.Roles) ? currentUser.Roles : [currentUser.Roles];
          config.headers['X-Dev-Roles'] = rolesArr.join(',');
        }
      }
    } catch (e) {
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