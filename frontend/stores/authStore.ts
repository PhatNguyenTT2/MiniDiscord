import { create } from "zustand";
import type { User, LoginRequest, RegisterRequest, AuthResponse, ApiResponse } from "@/types";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: LoginRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setOwnStatus: (status: "ONLINE" | "OFFLINE") => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", data);
      const { token, user } = res.data.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Login failed";
      set({ error: message, isLoading: false });
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/google", { idToken });
      const { token, user } = res.data.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Google login failed";
      set({ error: message, isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/register", data);
      const { token, user } = res.data.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Registration failed";
      set({ error: message, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_data");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  setUser: (user) => set({ user }),

  setOwnStatus: (status) => set((state) => ({
    user: state.user ? { ...state.user, status } : null
  })),

  hydrate: async () => {
    const token = localStorage.getItem("token");
    if (token) {
      const cachedUser = localStorage.getItem("user_data");
      let parsedUser = null;
      if (cachedUser) {
        try {
          parsedUser = JSON.parse(cachedUser);
        } catch (e) {
          console.error("Corrupted user cache data");
          localStorage.removeItem("user_data");
        }
      }

      set({ token, isAuthenticated: true, user: parsedUser });

      try {
        const res = await api.get<ApiResponse<User>>("/users/me");
        const freshUser = res.data.data;
        set({ user: freshUser });
        localStorage.setItem("user_data", JSON.stringify(freshUser));
      } catch (err) {
        console.warn("[Auth] Using cached user data (offline or API error)", err);
      }
    }
  },
}));
