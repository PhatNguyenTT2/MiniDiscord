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

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response && error.code === "ERR_NETWORK") {
      useNetworkStore.getState().setWsStatus("disconnected");
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
