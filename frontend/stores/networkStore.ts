import { create } from "zustand";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface NetworkState {
  isOnline: boolean;
  wsStatus: ConnectionStatus;
  lastDisconnectedAt: number | null;

  setOnline: (online: boolean) => void;
  setWsStatus: (status: ConnectionStatus) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof window !== "undefined" ? navigator.onLine : true,
  wsStatus: "connected",
  lastDisconnectedAt: null,

  setOnline: (online) => set({
    isOnline: online,
    lastDisconnectedAt: online ? null : Date.now()
  }),

  setWsStatus: (status) => set({ wsStatus: status }),
}));
