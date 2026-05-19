"use client";

import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { SettingsOverlay } from "@/components/settings/SettingsOverlay";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { useUIStore } from "@/stores/uiStore";
import { AuthGuard } from "@/components/providers/AuthGuard";
import { ConnectionStatusBanner } from "@/components/ui/ConnectionStatusBanner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showSettings = useUIStore((s) => s.showSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);

  useNetworkStatus();

  return (
    <AuthGuard>
      <ConnectionStatusBanner />
      <TooltipProvider>
        <div className="flex h-screen overflow-hidden">
          {children}
        </div>

        {/* Settings Overlay */}
        {showSettings && <SettingsOverlay onClose={closeSettings} />}
      </TooltipProvider>
    </AuthGuard>
  );
}
