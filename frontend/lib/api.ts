import axios from "axios";
import { useNetworkStore } from "@/stores/networkStore";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle 401 and 429
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429 && !error.config.__retried) {
      error.config.__retried = true;
      const retryAfter = parseInt(error.response.headers?.['retry-after'] || '2', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return api.request(error.config);
    }

    if (!error.response && error.code === "ERR_NETWORK") {
      // Only mark disconnected for non-file-upload requests.
      // File upload failures should NOT cascade into WebSocket disconnection.
      const isFileUpload = error.config?.url?.includes("/files/");
      if (!isFileUpload) {
        useNetworkStore.getState().setWsStatus("disconnected");
      }
    }

    const config = error.config;
    const isAuthRequest =
      config?.url?.includes("/auth/login") ||
      config?.url?.includes("/auth/register") ||
      config?.url?.includes("/auth/google");

    if (error.response?.status === 401 && !isAuthRequest) {
      if (typeof window !== "undefined") {
        import("@/stores/authStore").then(({ useAuthStore }) => {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        });
      }
    }
    return Promise.reject(error);
  }
);
