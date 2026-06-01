"use client";


import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { useUIStore } from "@/stores/uiStore";
import { AuthGuard } from "@/components/providers/AuthGuard";
import { ConnectionStatusBanner } from "@/components/ui/ConnectionStatusBanner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSound } from "@/hooks/useSound";
import { IncomingCallModal } from "@/components/voice/IncomingCallModal";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showSettings = useUIStore((s) => s.showSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);

  useNetworkStatus();
  useSound(); // Preloads all sound assets when entering the main app

  return (
    <AuthGuard>
      <ConnectionStatusBanner />
      <TooltipProvider>
        <div className="flex h-screen overflow-hidden">
          {children}
        </div>

        {/* Global call popup modal portal */}
        <IncomingCallModal />

        {/* Settings Overlay */}
        {showSettings && <SettingsOverlay onClose={closeSettings} />}
      </TooltipProvider>
    </AuthGuard>
  );
}
