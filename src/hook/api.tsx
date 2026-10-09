import axios from "axios";

const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

export const API_BASE_URL = baseUrl;
const withCredentials = process.env.NEXT_PUBLIC_WITH_CREDENTIALS !== "false";

const createApiInstance = () => {
  const instance = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    withCredentials,
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error?.config || {};
      const silent = Boolean(config.silent);

      // If not silent, Log minimal info to help debugging failing requests
      if (!silent) {
        try {
          const rawUrl = error?.config?.url;
          const base = error?.config?.baseURL || baseUrl;
          const reqUrl = rawUrl ? new URL(rawUrl, base).toString() : "unknown";
          console.error(
            `API request failed: ${reqUrl} - status: ${error.response?.status}`,
            error.response?.data
          );
        } catch {
        }
      }

      const status = error.response?.status;
      const failedUrl = error?.config?.url || "";
      const isLogoutRequest = failedUrl.includes("/auth/logout");

      // If silent, skip auto-logout behavior as well
      if (!silent && status === 401 && !isLogoutRequest) {
        try {
          await instance.post("/auth/logout");
        } catch (logoutError) {
          return Promise.reject(logoutError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export const api = createApiInstance();
