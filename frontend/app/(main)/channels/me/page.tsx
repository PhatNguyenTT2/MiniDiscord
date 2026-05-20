"use client";

import { ServerList } from "@/components/sidebar/ServerList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { DMSidebar } from "@/components/sidebar/DMSidebar";
import { FriendsPage } from "@/components/friends/FriendsPage";
import { ActiveNowPanel } from "@/components/friends/ActiveNowPanel";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useUIStore } from "@/stores/uiStore";
import { useCallback } from "react";

export default function DashboardPage() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const handleResize = useCallback(
    (delta: number) => setSidebarWidth(sidebarWidth + delta),
    [sidebarWidth, setSidebarWidth]
  );

  return (
    <>
      {/* Reserve room so the floating user panel stays above the bottom edge without covering the sidebars. */}
      <div
        className="relative flex shrink-0 flex-col bg-background-tertiary border-r border-border"
        style={{ paddingBottom: "var(--floating-user-panel-offset)" }}
      >
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Column 1: Server List */}
          <ServerList />
          {/* Column 2: DM Sidebar */}
          <DMSidebar />
        </div>
        {/* UserPanel spanning columns 1+2 */}
        <UserPanel />
      </div>

      {/* Resize Handle */}
      <ResizeHandle onResize={handleResize} />

      {/* Column 3: Friends view */}
      <main className="flex flex-1 flex-col min-w-0 bg-[#313338]">
        <FriendsPage />
      </main>

      {/* Column 4: Active Now */}
      <ActiveNowPanel />
    </>
  );
}

